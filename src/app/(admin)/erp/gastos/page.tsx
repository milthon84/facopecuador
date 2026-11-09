import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import { resolveExpenseArea, resolveFacturaSriClave } from "@/lib/expense-areas";
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
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const activeMonth = searchParams.month ?? currentMonthStr;
  const isAllMonths = activeMonth === "all";
  const activeAreaFilter = (searchParams.area || "all").toLowerCase();

  let from = "";
  let to = "";
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  if (!isAllMonths) {
    const parts = activeMonth.split("-").map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      year = parts[0];
      month = parts[1];
    }
    from = new Date(year, month - 1, 1).toISOString().split("T")[0];
    to   = new Date(year, month, 0).toISOString().split("T")[0];
  }

  // Meses para el selector (últimos 12)
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // 1. Facturas SRI pendientes correspondientes al mes activo (o las más recientes si es "todos")
  let pendingFacturasMes: FacturaRecibida[] = [];
  try {
    let recQuery = supabase
      .from("facturas_recibidas")
      .select("*")
      .or("estado_facop.eq.pendiente,estado_facop.is.null")
      .order("fecha_emision", { ascending: false });

    if (!isAllMonths) {
      recQuery = recQuery.gte("fecha_emision", from).lte("fecha_emision", to);
    } else {
      recQuery = recQuery.limit(100);
    }

    const { data: recData } = await recQuery;
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

  // 3. Consultas principales: Cierres y Gastos
  let expensesQuery = supabase
    .from("expenses")
    .select("*")
    .eq("status", "registered")
    .order("expense_date", { ascending: false });

  if (!isAllMonths) {
    expensesQuery = expensesQuery.gte("expense_date", from).lte("expense_date", to);
  }

  const [
    { data: monthlyRecords },
    { data: annualRecords },
    { data: expenses },
  ] = await Promise.all([
    supabase.from("monthly_closures").select("period").eq("status", "closed"),
    supabase.from("annual_closures").select("year").eq("status", "closed"),
    expensesQuery,
  ]);

  const monthlyClosedList = (monthlyRecords ?? []).map((c: any) => c.period as string);
  const annualClosedYearsList = (annualRecords ?? []).map((a: any) => Number(a.year));

  // Reconciliación automática y mapeo bidireccional de facturas vinculadas
  const registeredClavesSet = new Set<string>();
  const facturasByExpenseId = new Map<string, string>();
  const expenseIds = (expenses ?? []).map((e: any) => e.id);

  if (expenseIds.length > 0) {
    try {
      const { data: linkedFacs } = await supabase
        .from("facturas_recibidas")
        .select("expense_id, clave_acceso")
        .in("expense_id", expenseIds);
      if (linkedFacs) {
        for (const lf of linkedFacs) {
          if (lf.expense_id && lf.clave_acceso) {
            facturasByExpenseId.set(lf.expense_id, lf.clave_acceso);
            registeredClavesSet.add(lf.clave_acceso);
          }
        }
      }
    } catch (err) {
      console.warn("No se pudo consultar facturas_recibidas por expense_id:", err);
    }
  }

  const rawItems = (expenses ?? []).map((exp: any) => {
    const claveFromLinked = facturasByExpenseId.get(exp.id);
    const resolvedClave = claveFromLinked || resolveFacturaSriClave(exp);
    if (resolvedClave) registeredClavesSet.add(resolvedClave);
    return {
      ...exp,
      resolvedArea: resolveExpenseArea(exp),
      factura_recibida_clave_acceso: exp.factura_recibida_clave_acceso || resolvedClave || null,
    };
  });

  const pendingClaves = pendingFacturasMes.map((f) => f.clave_acceso).filter(Boolean);
  if (pendingClaves.length > 0) {
    try {
      const { data: matchedDbExpenses } = await supabase
        .from("expenses")
        .select("id, factura_recibida_clave_acceso, notes")
        .eq("status", "registered")
        .in("factura_recibida_clave_acceso", pendingClaves);

      if (matchedDbExpenses) {
        for (const exp of matchedDbExpenses) {
          const c = resolveFacturaSriClave(exp);
          if (c) registeredClavesSet.add(c);
        }
      }
    } catch {
      // Ignorar si la columna no existe en desarrollo
    }
  }

  if (registeredClavesSet.size > 0) {
    const toUpdate: string[] = [];
    for (const f of pendingFacturasMes) {
      if (registeredClavesSet.has(f.clave_acceso)) toUpdate.push(f.clave_acceso);
    }
    for (const f of allAvailableFacturas) {
      if (registeredClavesSet.has(f.clave_acceso) && !toUpdate.includes(f.clave_acceso)) {
        toUpdate.push(f.clave_acceso);
      }
    }

    if (toUpdate.length > 0) {
      try {
        await supabase
          .from("facturas_recibidas")
          .update({ estado_facop: "registrado" })
          .in("clave_acceso", toUpdate);
      } catch (err) {
        console.warn("No se pudo actualizar estado_facop en lote:", err);
      }

      pendingFacturasMes = pendingFacturasMes.filter(
        (f) => !registeredClavesSet.has(f.clave_acceso)
      );
      allAvailableFacturas = allAvailableFacturas.filter(
        (f) => !registeredClavesSet.has(f.clave_acceso)
      );
    }
  }

  const totalMes      = rawItems.reduce((s: number, e: any) => s + Number(e.total), 0);
  const totalClinica  = rawItems.filter((e: any) => e.resolvedArea === "clinica").reduce((s: number, e: any) => s + Number(e.total), 0);
  const totalCursos   = rawItems.filter((e: any) => e.resolvedArea === "cursos").reduce((s: number, e: any) => s + Number(e.total), 0);
  const totalGeneral  = rawItems.filter((e: any) => e.resolvedArea === "general").reduce((s: number, e: any) => s + Number(e.total), 0);
  const totalIva      = rawItems.reduce((s: number, e: any) => s + Number(e.iva_amount), 0);

  // Filtrar según área seleccionada
  const items = activeAreaFilter === "all"
    ? rawItems
    : rawItems.filter((e: any) => e.resolvedArea === activeAreaFilter);

  const monthLabel = isAllMonths
    ? "todos los meses"
    : new Date(year, month - 1, 1).toLocaleDateString("es-EC", { month: "long", year: "numeric" });

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
