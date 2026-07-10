import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import SkuPreviewBanner from "@/components/SkuPreviewBanner";
import { logAudit } from "@/lib/audit";
import type { UserRole } from "@/lib/roles";
import { assertWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

async function getNextSku(
  supabase: ReturnType<typeof createAdminClient>,
  category: string,
  prefix: string
): Promise<string> {
  const { data } = await supabase
    .from("inventory_products")
    .select("sku")
    .like("sku", `${prefix}-%`);

  let maxNum = 0;
  (data || []).forEach((row) => {
    const parts = row.sku?.split("-");
    if (parts && parts.length === 2) {
      const num = parseInt(parts[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });

  return `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
}

export default async function NewProductPage() {
  await assertWritePermission("/erp/inventario");

  async function saveProduct(formData: FormData) {
    "use server";
    await assertWritePermission("/erp/inventario");
    const supabase = createAdminClient();
    const sessionClient = createClient();
    const { data: { user } } = await sessionClient.auth.getUser();

    const name           = formData.get("name") as string;
    const category       = formData.get("category") as string;
    const prefix         = formData.get("category_prefix") as string;
    const unit_of_measure = formData.get("unit_of_measure") as string;
    const minimum_stock  = Number(formData.get("minimum_stock") || 5);
    const initial_stock  = Number(formData.get("initial_stock") || 0);

    const sku = await getNextSku(supabase, category, prefix || "OTR");

    const { data: product, error: productError } = await supabase
      .from("inventory_products")
      .insert({ name, sku, category, unit_of_measure, minimum_stock, current_stock: 0 })
      .select()
      .single();

    if (productError) throw new Error("Error creando producto");

    if (initial_stock > 0 && product) {
      await supabase.from("inventory_transactions").insert({
        product_id: product.id,
        type: "entrada",
        quantity: initial_stock,
        reason: "Inventario Inicial",
        created_by_id: user?.id ?? null,
        created_by_email: user?.email ?? null,
      });
    }

    await logAudit({
      user_id: user?.id,
      user_email: user?.email,
      user_role: (user?.app_metadata?.role as UserRole) ?? null,
      action: "create",
      resource: "inventory_product",
      resource_id: product?.id,
      description: `Producto creado: ${name} (${sku}) - Categoría: ${category}`,
      metadata: { name, sku, category, unit_of_measure, minimum_stock, initial_stock },
    });

    redirect("/erp/inventario");
  }

  // Leer categorías y unidades desde BD
  const supabase = createAdminClient();
  const [{ data: categories }, { data: units }] = await Promise.all([
    supabase.from("inventory_categories").select("name, prefix").eq("active", true).order("name"),
    supabase.from("inventory_units").select("name").eq("active", true).order("name"),
  ]);

  const defaultCategory = categories?.[0];
  const previewSku = defaultCategory
    ? await getNextSku(supabase, defaultCategory.name, defaultCategory.prefix)
    : "---";

  return (
    <div className="max-w-xl mx-auto">
      <SkuPreviewBanner sku={previewSku} />
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/erp/inventario"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-ink-900">Nuevo Insumo</h1>
      </div>

      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4 sm:p-6">
        <form action={saveProduct} className="space-y-4">

          {/* Nombre */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink-700">
              Nombre del Insumo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              autoFocus
              placeholder="Ej. Resina 3M A2, Guantes Nitrilo M"
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 transition-all"
            />
          </div>

          {/* Categoría */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink-700">
              Categoría <span className="text-red-500">*</span>
            </label>
            <select
              name="category"
              required
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 transition-all"
            >
              {(categories || []).map((cat) => (
                <option key={cat.name} value={cat.name}>{cat.name}</option>
              ))}
            </select>
            {/* Campo oculto para pasar el prefix de la categoría seleccionada */}
            <input type="hidden" name="category_prefix" value={defaultCategory?.prefix ?? "OTR"} />
          </div>

          {/* Unidad de medida */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink-700">
              Unidad de Medida <span className="text-red-500">*</span>
            </label>
            <select
              name="unit_of_measure"
              required
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 transition-all"
            >
              {(units || []).map((u) => (
                <option key={u.name} value={u.name}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Stock mínimo e inicial */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-amber-700">Stock Mínimo (Alerta)</label>
              <input
                type="number"
                name="minimum_stock"
                min="0"
                defaultValue="5"
                className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all font-bold text-amber-900"
              />
              <p className="text-xs text-ink-400">Alerta si el stock llega a este nivel.</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-green-700">Inventario Inicial</label>
              <input
                type="number"
                name="initial_stock"
                min="0"
                defaultValue="0"
                className="w-full bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition-all font-bold text-green-900"
              />
              <p className="text-xs text-ink-400">Cantidad actual en bodega.</p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-6 py-3 rounded-xl transition-colors font-semibold shadow-md shadow-lilac-200"
            >
              <Save size={18} />
              Guardar Insumo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
