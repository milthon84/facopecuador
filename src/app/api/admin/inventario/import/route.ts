import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { hasPermission } from "@/lib/roles";

export const dynamic = "force-dynamic";

async function getNextSkuForCategory(
  supabase: ReturnType<typeof createAdminClient>,
  prefix: string,
  used: Set<string>
): Promise<string> {
  const { data } = await supabase
    .from("inventory_products")
    .select("sku")
    .like("sku", `${prefix}-%`);

  let maxNum = 0;
  (data || []).forEach((row) => {
    const parts = row.sku?.split("-");
    if (parts?.length === 2) {
      const num = parseInt(parts[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });

  let candidate = maxNum + 1;
  let sku = `${prefix}-${String(candidate).padStart(3, "0")}`;
  while (used.has(sku)) {
    candidate++;
    sku = `${prefix}-${String(candidate).padStart(3, "0")}`;
  }
  used.add(sku);
  return sku;
}

export async function POST(req: NextRequest) {
  try {
    const session = createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const role = (user.app_metadata?.role as string) ?? "recepcionista";
    const supabase = createAdminClient();

    let allowedPaths: string[] | null = null;
    if (role !== "admin") {
      const { data } = await supabase
        .from("role_permissions")
        .select("path")
        .eq("role_name", role);
      allowedPaths = (data || []).map((p: any) => p.path);
    }

    // Debe tener permiso de escritura en inventario
    if (!hasPermission(role, "/erp/inventario/modificar", allowedPaths)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

    // Cargar categorías y unidades válidas desde BD
    const [{ data: categoriesData }, { data: unitsData }] = await Promise.all([
      supabase.from("inventory_categories").select("name, prefix").eq("active", true),
      supabase.from("inventory_units").select("name").eq("active", true),
    ]);

    const categoryMap: Record<string, string> = {};
    (categoriesData || []).forEach((c) => { categoryMap[c.name] = c.prefix; });
    const validCategories = Object.keys(categoryMap);
    const validUnits = (unitsData || []).map((u) => u.name);

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    if (rows.length === 0) return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });

    const usedSkus = new Set<string>();
    const errors: string[] = [];
    const toInsert: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const name     = String(row["Nombre"] || "").trim();
      const category = String(row["Categoría"] || row["Categoria"] || "").trim();
      const unit     = String(row["Unidad"] || "").trim();
      const minStock = Number(row["Stock Mínimo"] ?? row["Stock Minimo"] ?? 5);
      const initStock = Number(row["Stock Inicial"] ?? 0);

      if (!name) { errors.push(`Fila ${rowNum}: El nombre es obligatorio.`); continue; }
      if (!validCategories.includes(category)) {
        errors.push(`Fila ${rowNum}: Categoría "${category}" no válida. Use: ${validCategories.join(", ")}.`);
        continue;
      }
      if (unit && !validUnits.includes(unit)) {
        errors.push(`Fila ${rowNum}: Unidad "${unit}" no válida. Use: ${validUnits.join(", ")}.`);
        continue;
      }

      const prefix = categoryMap[category];
      const sku = await getNextSkuForCategory(supabase, prefix, usedSkus);

      toInsert.push({
        sku, name, category,
        unit_of_measure: unit || validUnits[0] || "Unidades",
        minimum_stock: isNaN(minStock) ? 5 : minStock,
        current_stock: 0,
        _init_stock: isNaN(initStock) ? 0 : initStock,
      });
    }

    if (errors.length > 0 && toInsert.length === 0) {
      return NextResponse.json({ error: "No se pudo procesar ninguna fila.", details: errors }, { status: 422 });
    }

    let inserted = 0;
    for (const item of toInsert) {
      const { _init_stock, ...productData } = item;
      const { data: product, error: insertError } = await supabase
        .from("inventory_products")
        .insert(productData)
        .select()
        .single();

      if (insertError) { errors.push(`Error al insertar "${productData.name}": ${insertError.message}`); continue; }

      if (_init_stock > 0 && product) {
        await supabase.from("inventory_transactions").insert({
          product_id: product.id,
          type: "entrada",
          quantity: _init_stock,
          reason: "Importación desde Excel",
        });
      }
      inserted++;
    }

    return NextResponse.json({
      inserted,
      warnings: errors.length > 0 ? errors : undefined,
      message: `${inserted} producto(s) importado(s) correctamente.`,
    });
  } catch (err) {
    console.error("Error importando inventario:", err);
    return NextResponse.json({ error: "Error interno al procesar el archivo" }, { status: 500 });
  }
}
