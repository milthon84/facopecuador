import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/auth-action";
import ActivosReporteClient from "./ActivosReporteClient";
import { AssetInput } from "@/lib/fixed-assets-report";

export const dynamic = "force-dynamic";

export default async function ActivosReportePage() {
  await assertPermission("/erp/activos");
  const supabase = createAdminClient();

  const { data: rawAssets, error } = await supabase
    .from("fixed_assets")
    .select("*")
    .order("purchase_date", { ascending: true });

  if (error) {
    console.error("Error al cargar activos fijos para el reporte:", error);
  }

  const dbAssets: AssetInput[] = (rawAssets || []).map((a: any) => ({
    id: a.id,
    code: a.code || null,
    name: a.name,
    category: a.category || "Otros equipos y maquinaria",
    description: a.description || null,
    purchase_date: a.purchase_date,
    purchase_value: Number(a.purchase_value || 0),
    salvage_value: Number(a.salvage_value || 0),
    useful_life_years: Number(a.useful_life_years || 10),
    supplier_name: a.supplier_name || null,
    invoice_number: a.invoice_number || null,
    status: a.status || "active",
  }));

  const currentYear = new Date().getFullYear();

  return <ActivosReporteClient dbAssets={dbAssets} defaultYear={currentYear} />;
}
