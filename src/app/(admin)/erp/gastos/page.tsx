import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import { resolveExpenseArea } from "@/lib/expense-areas";
import { FacturaRecibida } from "@/lib/expense-types";
import GastosListClient from "./GastosListClient";

export const dynamic = "force-dynamic";

export default async function GastosPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ month?: string; area?: string }>;
}) {
  await assertPermission("/erp/gastos");
  const canEdit = await hasWritePermission("/erp/gastos");
  const searchParams = await searchParamsPromise;
  const supabase = createAdminClient();

  // Mes activo (default: mes actual)
  const now = new Date();
  const activeMonth = searchParams.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const activeAreaFilter = (searchParams.area || "all").toLowerCase();
  const [year, month] = activeMonth.split("-").map(Number);
  const from = new Date(year, month - 1, 1).toISOString().split("T")[0];
  const to   = new Date(year, month, 0).toISOString().split("T")[0];

  // Meses para el selector (últimos 12)
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // 1. Facturas SRI pendientes correspondientes al mes activo
  let pendingFacturasMes: FacturaRecibida[] = [];
  try {
    const { data: recData } = await supabase
      .from("facturas_recibidas")
      .select("*")
      .or("estado_facop.eq.pendiente,estado_facop.is.null")
      .gte("fecha_emision", from)
      .lte("fecha_emision", to)
      .order("fecha_emision", { ascending: false });
    if (recData) pendingFacturasMes = recData as FacturaRecibida[];
  } catch (err) {
    console.warn("Error consultando facturas_recibidas del mes:", err);
  }

  // 2. Facturas SRI disponibles globalmente para relacionar a gastos huérfanos
  let allAvailableFacturas: FacturaRecibida[] = [];
  try {
    const { data: allRecData } = await supabase
      .from("facturas_recibidas")
      .select("*")
      .or("estado_facop.eq.pendiente,estado_facop.is.null")
      .order("fecha_emision", { ascending: false })
      .limit(150);
    if (allRecData) allAvailableFacturas = allRecData as FacturaRecibida[];
  } catch (err) {
    console.warn("Error consultando facturas disponibles:", err);
  }

  const [
    { data: monthlyRecords },
    { data: annualRecords },
    { data: expenses },
  ] = await Promise.all([
    supabase.from("monthly_closures").select("period").eq("status", "closed"),
    supabase.from("annual_closures").select("year").eq("status", "closed"),
    supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", from)
      .lte("expense_date", to)
      .eq("status", "registered")
      .order("expense_date", { ascending: false }),
  ]);

  const monthlyClosedList = (monthlyRecords ?? []).map((c: any) => c.period as string);
  const annualClosedYearsList = (annualRecords ?? []).map((a: any) => Number(a.year));

  const rawItems = (expenses ?? []).map((exp: any) => ({
    ...exp,
    resolvedArea: resolveExpenseArea(exp),
  }));

  const totalMes      = rawItems.reduce((s: number, e: any) => s + Number(e.total), 0);
  const totalClinica  = rawItems.filter((e: any) => e.resolvedArea === "clinica").reduce((s: number, e: any) => s + Number(e.total), 0);
  const totalCursos   = rawItems.filter((e: any) => e.resolvedArea === "cursos").reduce((s: number, e: any) => s + Number(e.total), 0);
  const totalGeneral  = rawItems.filter((e: any) => e.resolvedArea === "general").reduce((s: number, e: any) => s + Number(e.total), 0);
  const totalIva      = rawItems.reduce((s: number, e: any) => s + Number(e.iva_amount), 0);

  // Filtrar según área seleccionada
  const items = activeAreaFilter === "all"
    ? rawItems
    : rawItems.filter((e: any) => e.resolvedArea === activeAreaFilter);

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("es-EC", { month: "long", year: "numeric" });

  return (
    <GastosListClient
      canEdit={canEdit}
      activeMonth={activeMonth}
      monthLabel={monthLabel}
      activeAreaFilter={activeAreaFilter}
      months={months}
      monthlyClosedList={monthlyClosedList}
      annualClosedYearsList={annualClosedYearsList}
      pendingFacturasMes={pendingFacturasMes}
      allAvailableFacturas={allAvailableFacturas}
      rawItems={rawItems}
      items={items}
      totalMes={totalMes}
      totalClinica={totalClinica}
      totalCursos={totalCursos}
      totalGeneral={totalGeneral}
      totalIva={totalIva}
    />
  );
}
