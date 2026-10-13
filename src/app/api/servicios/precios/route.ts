import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/servicios/precios
 * Uso desde n8n (asistente de WhatsApp).
 * Autenticación: Header "Authorization: Bearer <N8N_API_KEY>"
 *
 * Query params opcionales:
 *   - q: texto a buscar en nombre o categoría (ej: ?q=limpieza)
 *   - categoria: filtra por categoría exacta
 *
 * Respuesta:
 *   precio_tarjeta: precio registrado (PVP con tarjeta)
 *   precio_contado: precio con descuento por pago en efectivo/transferencia
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.N8N_API_KEY;
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!apiKey || token !== apiKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q")?.trim();
    const categoria = searchParams.get("categoria")?.trim();

    const supabase = createAdminClient();

    const { data: sriConfig, error: configError } = await supabase
      .from("sri_configs")
      .select("cash_discount_percent")
      .maybeSingle();
    if (configError) {
      return NextResponse.json({ error: configError.message }, { status: 500 });
    }
    // Misma columna y default (6.00) que migration_cash_discount.sql
    const cashDiscountPercent = Number(sriConfig?.cash_discount_percent ?? 6.0);

    let query = supabase
      .from("services")
      .select("id, name, description, category, price")
      .eq("active", true)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (categoria) query = query.eq("category", categoria);
    if (q) query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const servicios = (data || []).map((s) => {
      const tarjeta = Number(s.price || 0);
      const contado = Math.round(tarjeta * (1 - cashDiscountPercent / 100) * 100) / 100;
      return {
        id: s.id,
        nombre: s.name,
        descripcion: s.description,
        categoria: s.category,
        precio_tarjeta: tarjeta,
        precio_contado: contado,
      };
    });

    return NextResponse.json({
      moneda: "USD",
      descuento_contado_porcentaje: cashDiscountPercent,
      total: servicios.length,
      servicios,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al consultar precios" },
      { status: 500 }
    );
  }
}
