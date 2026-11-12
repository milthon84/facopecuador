import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { BookOpen, TrendingUp, TrendingDown, Scale, FileBarChart2, Receipt, FileSpreadsheet, DollarSign, Lock, Building2, ShieldCheck, ListTree, FileCheck2, Calendar, CheckCircle2 } from "lucide-react";
import { assertPermission } from "@/lib/auth-action";
import { formatAsientoCode, formatEgresoCode, formatIngresoCode } from "@/lib/accounting-codes";
import ExportarExcelContableButton from "./ExportarExcelContableButton";
import SincronizarAsientosButton from "./SincronizarAsientosButton";
import { getOfficialExpenseAccountName } from "@/lib/expense-accounts";

export const dynamic = "force-dynamic";

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function periodLabel(period: string) {
  if (period === "all") return "Todo el Historial";
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-EC", { month: "long", year: "numeric" });
}

function getEntryBadge(refType: string, desc: string) {
  const d = (desc || "").toLowerCase();
  if (refType === "invoice") {
    if (d.includes("cobro") || d.includes("recaudaci")) {
      const isCash = d.includes("caja") || d.includes("efectivo");
      return {
        label: isCash ? "Cobro Caja" : "Cobro Banco",
        color: "bg-emerald-50 text-emerald-800 border-emerald-200"
      };
    }
    return { label: "Venta", color: "bg-purple-50 text-purple-800 border-purple-200" };
  }
  if (refType === "credit_note") {
    return { label: "Nota de Crédito", color: "bg-amber-50 text-amber-800 border-amber-200" };
  }
  if (d.includes("depósito") || d.includes("deposito")) {
    return { label: "Depósito Bancario", color: "bg-sky-50 text-sky-800 border-sky-200" };
  }
  if (d.includes("cierre")) {
    return { label: "Cierre", color: "bg-orange-50 text-orange-800 border-orange-200" };
  }
  if (refType === "expense") {
    if (d.startsWith("pago") || d.includes("pago / cruce") || d.includes("cruce bancario") || d.includes("cruce caja")) {
      return { label: "Pago / Cruce", color: "bg-indigo-50 text-indigo-800 border-indigo-200" };
    }
    return { label: "Gasto", color: "bg-rose-50 text-rose-800 border-rose-200" };
  }
  if (d.startsWith("pago") || d.startsWith("cruce")) {
    return { label: "Pago / Cruce", color: "bg-indigo-50 text-indigo-800 border-indigo-200" };
  }
  return { label: "General", color: "bg-gray-50 text-gray-800 border-gray-200" };
}

function cleanEntryTitle(desc: string, badgeLabel?: string): string {
  if (!desc) return "";
  let clean = desc.trim();

  // Eliminar prefijo redundante "Gasto — " o "Gasto -"
  clean = clean.replace(/^Gasto\s*[-—–]\s*/i, "");

  // Si la primera parte es una categoría o cuenta contable que ya se muestra en la tabla inferior:
  if (clean.includes("—") || clean.includes("-")) {
    const parts = clean.split(/\s*[-—–]\s*/);
    if (parts.length >= 2) {
      const firstPart = parts[0].toLowerCase();
      const isKnownCategory = [
        "insumo", "material", "honorario", "arriendo", "alquiler", "servicio", "suministro",
        "mantenimiento", "publicidad", "transporte", "combustible", "impuesto", "financiero",
        "otro", "cuentas por cobrar", "cuentas por pagar", "bancos", "caja", "gasto"
      ].some(k => firstPart.includes(k));

      if (isKnownCategory) {
        clean = parts.slice(1).join(" — ");
      }
    }
  }

  // Eliminar cuentas contables entre paréntesis:
  clean = clean.replace(/\s*\((?:Bancos?|Cuentas? por (?:Cobrar|Pagar)|Caja|Depósito|Transferencia|Préstamo|Prestamo)[^)]*\)/gi, "");

  // Limpiar prefijos de cobro/pago que duplican el badge
  clean = clean.replace(/^(?:Pago\s*\/?\s*Cruce(?:\s*Bancario|\s*Caja Chica)?\s*[-—–]\s*)/i, "");
  clean = clean.replace(/^(?:Cobro\s*(?:Total\s*)?Factura(?:\s*#?\s*)?)/i, "Factura ");

  clean = clean.trim();
  return clean || desc;
}

function cleanLineDescription(lineDesc: string | null | undefined, headerTitle: string): string | null {
  if (!lineDesc) return null;
  let text = lineDesc.trim();
  if (!text) return null;

  const headerNorm = (headerTitle || "").trim().toLowerCase();
  const textNorm = text.toLowerCase();

  // Si la glosa de la línea es idéntica o subcadena del título
  if (headerNorm && (textNorm === headerNorm || headerNorm.includes(textNorm))) {
    return null;
  }

  // Si empieza repitiendo el nombre del proveedor o cliente
  if (headerNorm && textNorm.startsWith(headerNorm)) {
    text = text.slice(headerNorm.length).trim();
  }

  // Si está envuelto en paréntesis, removerlos
  if (text.startsWith("(") && text.endsWith(")")) {
    text = text.slice(1, -1).trim();
  }

  // Si dentro de los paréntesis vuelve a repetir el proveedor/cliente con un guión
  if (headerNorm && text.toLowerCase().startsWith(headerNorm)) {
    text = text.slice(headerNorm.length).replace(/^[-—–\s]+/, "").trim();
  }

  // Si después de limpiar quedó vacío o repite el encabezado
  if (!text || (headerNorm && text.toLowerCase() === headerNorm)) {
    return null;
  }

  return text;
}

// ── Page ───────────────────────────────────────────────────────────────────
export default async function ContabilidadPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ tab?: string; period?: string; view?: string }>;
}) {
  await assertPermission("/erp/contabilidad");
  const searchParams = await searchParamsPromise;
  const tab    = searchParams.tab    ?? "diario";
  const view   = searchParams.view   ?? "tree";
  const now    = new Date();
  const period = searchParams.period
    ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const isAllPeriod = period === "all";

  // Meses disponibles (últimos 12)
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const supabase = createAdminClient();

  // Cargar cierres mensuales, cierres anuales y catálogo de cuentas contables NIIF
  const [
    { data: monthlyRecords },
    { data: annualRecords },
    { data: rawAccounts },
  ] = await Promise.all([
    supabase.from("monthly_closures").select("period").eq("status", "closed"),
    supabase.from("annual_closures").select("year").eq("status", "closed"),
    supabase.from("accounts").select("code, name, is_movement, type, parent_code").order("code", { ascending: true }),
  ]);

  const monthlyClosedSet = new Set((monthlyRecords ?? []).map((c: any) => c.period));
  const annualClosedYears = new Set((annualRecords ?? []).map((a: any) => Number(a.year)));

  // Cargar asientos del período con sus líneas
  let entriesQuery = supabase
    .from("journal_entries")
    .select("*, lines:journal_lines(*)")
    .eq("status", "posted")
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });

  let prevLinesPromise: PromiseLike<{ data: any[] | null }> = Promise.resolve({ data: [] });

  if (!isAllPeriod) {
    const [year, month] = period.split("-").map(Number);
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    entriesQuery = entriesQuery.gte("entry_date", from).lte("entry_date", to);

    prevLinesPromise = supabase
      .from("journal_lines")
      .select("account_code, account_name, debit, credit, journal_entries!inner(entry_date, status)")
      .lt("journal_entries.entry_date", from)
      .eq("journal_entries.status", "posted")
      .limit(50000);
  }

  const [{ data: entries }, { data: rawPrevLines }] = await Promise.all([
    entriesQuery,
    prevLinesPromise,
  ]);

  const allEntries = entries ?? [];

  // Todas las líneas del período
  const allLines = allEntries.flatMap((e: any) =>
    (e.lines ?? []).map((l: any) => ({ ...l, entry_date: e.entry_date, entry_desc: e.description }))
  );

  // ── Agrupación Inteligente: Asientos que se hicieron juntos se muestran juntos ──
  // Primero asociamos los asientos de una misma operación (mismo reference_id en la misma fecha)
  const txBuckets = new Map<string, any[]>();
  for (const entry of allEntries) {
    const txKey = entry.reference_id
      ? `${entry.entry_date}_${entry.reference_type}_${entry.reference_id}`
      : `${entry.entry_date}_single_${entry.id}`;

    if (!txBuckets.has(txKey)) {
      txBuckets.set(txKey, []);
    }
    txBuckets.get(txKey)!.push(entry);
  }

  // Ordenar dentro de cada operación: primero causación/devengo, luego pago/cruce
  const orderedEntries: any[] = [];
  for (const [, groupList] of txBuckets) {
    groupList.sort((a, b) => {
      const aDesc = (a.description || "").toLowerCase();
      const bDesc = (b.description || "").toLowerCase();
      const aIsCash = aDesc.includes("pago") || aDesc.includes("cruce") || aDesc.includes("cobro");
      const bIsCash = bDesc.includes("pago") || bDesc.includes("cruce") || bDesc.includes("cobro");
      if (!aIsCash && bIsCash) return -1;
      if (aIsCash && !bIsCash) return 1;
      return new Date(a.created_at || a.entry_date).getTime() - new Date(b.created_at || b.entry_date).getTime();
    });
    orderedEntries.push(...groupList);
  }

  let runningEntryNum = 1;
  const daysMap = new Map<string, {
    date: string;
    formattedDate: string;
    totalDebit: number;
    totalCredit: number;
    totalEntriesCount: number;
    transactions: Array<{
      key: string;
      title: string;
      badge: { label: string; color: string };
      totalAmount: number;
      entries: Array<{
        entry: any;
        entryNumber: number;
        entryCode: string;
        isPayment: boolean;
        isCollection?: boolean;
        isInvoice?: boolean;
        isExpense?: boolean;
        debitTotal: number;
        creditTotal: number;
      }>;
    }>;
  }>();

  for (const entry of orderedEntries) {
    const entryNumber = entry.entry_number ? Number(entry.entry_number) : runningEntryNum++;
    const lines = entry.lines ?? [];
    const debitTotal = lines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
    const creditTotal = lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
    
    const descLower = (entry.description || "").toLowerCase();
    const isInvoice = entry.reference_type === "invoice";
    const isExpense = entry.reference_type === "expense";
    const isCollection = isInvoice && (descLower.includes("cobro") || descLower.includes("recaudación"));
    const isPayment = !isCollection && (descLower.includes("pago") || descLower.includes("cruce"));
    const isCreditNote = entry.reference_type === "credit_note" || descLower.includes("nota de crédito");

    let entryCode = entry.entry_code;
    if (!entryCode) {
      entryCode = formatAsientoCode(entryNumber, entry.entry_date, "diario");
      if (isCollection) {
        entryCode = formatIngresoCode(entryNumber, entry.entry_date);
      } else if (isPayment) {
        entryCode = formatEgresoCode(entryNumber, entry.entry_date);
      } else if (isCreditNote) {
        entryCode = formatAsientoCode(entryNumber, entry.entry_date, "nc");
      }
    }

    const dKey = entry.entry_date;
    let dayGroup = daysMap.get(dKey);
    if (!dayGroup) {
      let formattedDate = dKey;
      try {
        const [y, m, d] = dKey.split("-").map(Number);
        formattedDate = new Date(y, m - 1, d).toLocaleDateString("es-EC", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
      } catch {
        formattedDate = dKey;
      }

      dayGroup = {
        date: dKey,
        formattedDate,
        totalDebit: 0,
        totalCredit: 0,
        totalEntriesCount: 0,
        transactions: [],
      };
      daysMap.set(dKey, dayGroup);
    }

    dayGroup.totalDebit = Math.round((dayGroup.totalDebit + debitTotal) * 100) / 100;
    dayGroup.totalCredit = Math.round((dayGroup.totalCredit + creditTotal) * 100) / 100;
    dayGroup.totalEntriesCount++;

    const txKey = entry.reference_id
      ? `${entry.reference_type}_${entry.reference_id}`
      : `single_${entry.id}`;

    let tx = dayGroup.transactions.find((t) => t.key === txKey);
    if (!tx) {
      const badge = getEntryBadge(entry.reference_type, entry.description);
      tx = {
        key: txKey,
        title: entry.description,
        badge,
        totalAmount: debitTotal,
        entries: [],
      };
      dayGroup.transactions.push(tx);
    } else {
      tx.totalAmount = Math.max(tx.totalAmount, debitTotal);
    }

    tx.entries.push({
      entry,
      entryNumber,
      entryCode,
      isPayment,
      isCollection,
      isInvoice,
      isExpense,
      debitTotal,
      creditTotal,
    });
  }

  const dayGroups = Array.from(daysMap.values());
  const totalPeriodDebit = allLines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
  const totalPeriodCredit = allLines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
  const isPeriodSquare = Math.abs(totalPeriodDebit - totalPeriodCredit) < 0.01;

  // ── Estado de Resultados ─────────────────────────────────────────────────
  const ingresos = allLines
    .filter((l: any) => l.account_code.startsWith("4."))
    .reduce((s: number, l: any) => s + Number(l.credit) - Number(l.debit), 0);

  const gastos = allLines
    .filter((l: any) => l.account_code.startsWith("5."))
    .reduce((s: number, l: any) => s + Number(l.debit) - Number(l.credit), 0);

  const utilidad = ingresos - gastos;

  // ── Resumen IVA ──────────────────────────────────────────────────────────
  const ivaVentas = allLines
    .filter((l: any) => l.account_code === "2.1.02.01")
    .reduce((s: number, l: any) => s + Number(l.credit), 0);

  const ivaCompras = allLines
    .filter((l: any) => l.account_code === "1.1.03.01")
    .reduce((s: number, l: any) => s + Number(l.debit), 0);

  const ivaPagar = ivaVentas - ivaCompras;

  // ── Balance de Comprobación Acumulado y Mensual (Sumas y Saldos) ──────────
  const isAcreedora = (code: string) =>
    code.startsWith("2") || code.startsWith("3") || code.startsWith("4");

  type BalanceItem = {
    code: string;
    name: string;
    nature: "deudora" | "acreedora";
    prevDebit: number;
    prevCredit: number;
    prevBalance: number;
    monthDebit: number;
    monthCredit: number;
    debit: number;
    credit: number;
    finalDebit: number;
    finalCredit: number;
    finalBalance: number;
  };

  const accountMap: Record<string, BalanceItem> = {};

  const getOrCreateAcc = (code: string, rawName: string): BalanceItem => {
    if (!accountMap[code]) {
      const nature: "deudora" | "acreedora" = isAcreedora(code) ? "acreedora" : "deudora";
      const officialName = getOfficialExpenseAccountName(code, rawName);
      accountMap[code] = {
        code,
        name: officialName,
        nature,
        prevDebit: 0,
        prevCredit: 0,
        prevBalance: 0,
        monthDebit: 0,
        monthCredit: 0,
        debit: 0,
        credit: 0,
        finalDebit: 0,
        finalCredit: 0,
        finalBalance: 0,
      };
    }
    return accountMap[code];
  };

  // 1. Acumular movimientos del mes anterior (histórico previo al período)
  for (const l of (rawPrevLines || []) as any[]) {
    if (!l.account_code) continue;
    const item = getOrCreateAcc(l.account_code, l.account_name);
    item.prevDebit += Number(l.debit || 0);
    item.prevCredit += Number(l.credit || 0);
  }

  // 2. Acumular movimientos del mes actual seleccionado
  for (const l of allLines as any[]) {
    if (!l.account_code) continue;
    const item = getOrCreateAcc(l.account_code, l.account_name);
    item.monthDebit += Number(l.debit || 0);
    item.monthCredit += Number(l.credit || 0);
  }

  // 3. Calcular saldos iniciales (mes anterior), saldos finales acumulados y redondear
  for (const item of Object.values(accountMap)) {
    const isAcreedor = item.nature === "acreedora";

    item.prevDebit = Math.round(item.prevDebit * 100) / 100;
    item.prevCredit = Math.round(item.prevCredit * 100) / 100;
    item.monthDebit = Math.round(item.monthDebit * 100) / 100;
    item.monthCredit = Math.round(item.monthCredit * 100) / 100;

    // Saldo acumulado anterior
    item.prevBalance = isAcreedor
      ? Math.round((item.prevCredit - item.prevDebit) * 100) / 100
      : Math.round((item.prevDebit - item.prevCredit) * 100) / 100;

    // Campos de compatibilidad con vistas y exports existentes
    item.debit = item.monthDebit;
    item.credit = item.monthCredit;

    // Sumas totales acumuladas
    item.finalDebit = Math.round((item.prevDebit + item.monthDebit) * 100) / 100;
    item.finalCredit = Math.round((item.prevCredit + item.monthCredit) * 100) / 100;

    // Saldo final acumulado al cierre del período
    item.finalBalance = isAcreedor
      ? Math.round((item.finalCredit - item.finalDebit) * 100) / 100
      : Math.round((item.finalDebit - item.finalCredit) * 100) / 100;
  }

  const balanceRows = Object.values(accountMap)
    .filter(
      r =>
        Math.abs(r.prevBalance) >= 0.005 ||
        Math.abs(r.monthDebit) >= 0.005 ||
        Math.abs(r.monthCredit) >= 0.005 ||
        Math.abs(r.finalBalance) >= 0.005
    )
    .sort((a, b) => a.code.localeCompare(b.code));

  const totalDebit = balanceRows.reduce((s, r) => s + r.monthDebit, 0);
  const totalCredit = balanceRows.reduce((s, r) => s + r.monthCredit, 0);
  const totalPrevBalance = balanceRows.reduce((s, r) => s + r.prevBalance, 0);
  const totalFinalBalance = balanceRows.reduce((s, r) => s + r.finalBalance, 0);
  const totalFinalDebit = balanceRows.reduce((s, r) => s + r.finalDebit, 0);
  const totalFinalCredit = balanceRows.reduce((s, r) => s + r.finalCredit, 0);

  // ── Construcción de Balance Jerárquico NIIF (con Grupos y Subtotales = TOTAL =) ──
  type HierarchyRow = {
    type: "header" | "movement" | "subtotal";
    code: string;
    name: string;
    level: number;
    saldoAnterior: number;
    debe: number;
    haber: number;
    saldoActual: number;
    isCredit?: boolean;
  };

  const accountsList: Array<{ code: string; name: string; is_movement: boolean; type: string }> = [
    ...(rawAccounts || []).map((a: any) => ({
      code: a.code,
      name: a.name,
      is_movement: Boolean(a.is_movement),
      type: a.type || "",
    })),
  ];

  // Si hay alguna cuenta con movimientos que no esté en el catálogo, agregarla
  for (const code of Object.keys(accountMap)) {
    if (!accountsList.some(a => a.code === code)) {
      accountsList.push({
        code,
        name: accountMap[code].name,
        is_movement: true,
        type: "",
      });
    }
  }

  type NodeRollup = {
    code: string;
    name: string;
    is_movement: boolean;
    saldoAnterior: number;
    debe: number;
    haber: number;
    saldoActual: number;
    hasActivity: boolean;
  };

  const nodeDataMap = new Map<string, NodeRollup>();

  for (const a of accountsList) {
    const mov = accountMap[a.code];
    if (a.is_movement && mov) {
      nodeDataMap.set(a.code, {
        code: a.code,
        name: mov.name,
        is_movement: true,
        saldoAnterior: mov.prevBalance,
        debe: mov.monthDebit,
        haber: mov.monthCredit,
        saldoActual: mov.finalBalance,
        hasActivity:
          Math.abs(mov.prevBalance) >= 0.005 ||
          mov.monthDebit > 0 ||
          mov.monthCredit > 0 ||
          Math.abs(mov.finalBalance) >= 0.005,
      });
    } else {
      nodeDataMap.set(a.code, {
        code: a.code,
        name: a.name,
        is_movement: a.is_movement,
        saldoAnterior: 0,
        debe: 0,
        haber: 0,
        saldoActual: 0,
        hasActivity: false,
      });
    }
  }

  // Acumular sumas en grupos padres (desde los códigos más largos hasta los más cortos)
  const groupAccounts = accountsList
    .filter(a => !a.is_movement)
    .sort((a, b) => b.code.length - a.code.length);

  for (const grp of groupAccounts) {
    const children = accountsList.filter(
      c => c.is_movement && c.code.startsWith(grp.code + ".")
    );
    const ant = children.reduce(
      (s, c) => s + (nodeDataMap.get(c.code)?.saldoAnterior || 0),
      0
    );
    const deb = children.reduce(
      (s, c) => s + (nodeDataMap.get(c.code)?.debe || 0),
      0
    );
    const cred = children.reduce(
      (s, c) => s + (nodeDataMap.get(c.code)?.haber || 0),
      0
    );
    const act = children.reduce(
      (s, c) => s + (nodeDataMap.get(c.code)?.saldoActual || 0),
      0
    );
    const hasAct = children.some(c => nodeDataMap.get(c.code)?.hasActivity);

    const item = nodeDataMap.get(grp.code)!;
    item.saldoAnterior = Math.round(ant * 100) / 100;
    item.debe = Math.round(deb * 100) / 100;
    item.haber = Math.round(cred * 100) / 100;
    item.saldoActual = Math.round(act * 100) / 100;
    item.hasActivity = hasAct;
  }

  // Agrupar nodos por código del padre directo
  const activeNodes = accountsList.filter(a => nodeDataMap.get(a.code)?.hasActivity);
  const nodesByParent = new Map<string, typeof accountsList>();

  for (const node of activeNodes) {
    const parts = node.code.split(".");
    const parentCode = parts.length > 1 ? parts.slice(0, -1).join(".") : "";
    if (!nodesByParent.has(parentCode)) {
      nodesByParent.set(parentCode, []);
    }
    nodesByParent.get(parentCode)!.push(node);
  }

  const hierarchicalRows: HierarchyRow[] = [];

  const traverseNodes = (parentCode: string, level = 0) => {
    const children = (nodesByParent.get(parentCode) || []).sort((a, b) =>
      a.code.localeCompare(b.code)
    );

    for (const child of children) {
      const data = nodeDataMap.get(child.code)!;
      if (!child.is_movement) {
        // Fila de encabezado de grupo
        hierarchicalRows.push({
          type: "header",
          code: `${child.code}.`,
          name: child.name.toUpperCase(),
          level,
          saldoAnterior: 0,
          debe: 0,
          haber: 0,
          saldoActual: 0,
        });

        // Recorrer subgrupos o cuentas hijas
        traverseNodes(child.code, level + 1);

        // Fila de subtotal = TOTAL =
        hierarchicalRows.push({
          type: "subtotal",
          code: "= TOTAL =",
          name: child.name.toUpperCase(),
          level,
          saldoAnterior: data.saldoAnterior,
          debe: data.debe,
          haber: data.haber,
          saldoActual: data.saldoActual,
        });
      } else {
        // Fila de cuenta de movimiento
        hierarchicalRows.push({
          type: "movement",
          code: child.code,
          name: child.name,
          level,
          saldoAnterior: data.saldoAnterior,
          debe: data.debe,
          haber: data.haber,
          saldoActual: data.saldoActual,
          isCredit: isAcreedora(child.code),
        });
      }
    }
  };

  traverseNodes("", 0);

  const tabs = [
    { key: "diario",    label: "Libro Diario",           icon: <BookOpen size={14} /> },
    { key: "resultados",label: "Estado de Resultados",   icon: <TrendingUp size={14} /> },
    { key: "balance",   label: "Bal. de Comprobación",   icon: <Scale size={14} /> },
    { key: "iva",       label: "Resumen IVA (Form. 104)",icon: <Receipt size={14} /> },
  ];

  const quickLinks = [
    { href: "/erp/contabilidad/plan-cuentas",                  label: "Plan de Cuentas",                icon: <ListTree size={14} className="text-teal-600" />,           desc: "Catálogo de cuentas, activos, pasivos y resultados" },
    { href: `/erp/contabilidad/declaraciones?period=${period}`,label: "Respaldos de Declaraciones SRI", icon: <FileCheck2 size={14} className="text-emerald-600" />,       desc: "Archivo mensual organizado de Form. 104, 103, CEP, ATS y justificativos" },
    { href: "/erp/contabilidad/caja-chica-liquidaciones",       label: "Liquidación y Rendición de Caja Chica", icon: <ShieldCheck size={14} className="text-purple-600" />, desc: "Auditoría de comprobantes, restitución de fondo fijo y legalización" },
    { href: "/erp/contabilidad/cierre-anual",                  label: "Cierre Anual Fiscal de Empresas",icon: <Building2 size={14} className="text-amber-600" />,          desc: "Ejercicio fiscal, 15% trabajadores, 25% impuesto a la renta y NIIF" },
    { href: `/erp/contabilidad/cierre?period=${period}`,      label: "Cierre Mensual Contable",        icon: <Lock size={14} className="text-lilac-600" />,           desc: "Consolidación de mes, asientos de cierre y bitácora de auditoría" },
    { href: `/erp/contabilidad/ats?period=${period}`,         label: "ATS — Anexo Transaccional",      icon: <FileSpreadsheet size={14} className="text-lilac-600" />,  desc: "Compras y ventas para SRI" },
    { href: "/erp/contabilidad/dividendos",                    label: "ADI — Dividendos y Utilidades",  icon: <DollarSign size={14} className="text-green-600" />,        desc: "Registro de distribución" },
    { href: `/erp/contabilidad/balance`,                       label: "Balance General",                icon: <Scale size={14} className="text-blue-600" />,              desc: "Situación financiera (Activos / Pasivos / Patrimonio)" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <FileBarChart2 size={22} className="text-lilac-600" />
          <div>
            <h1 className="text-xl font-bold text-ink-900">Contabilidad</h1>
            <p className="text-xs text-ink-400">Libros contables NIIF, reportes financieros y obligaciones tributarias</p>
          </div>
        </div>
      </div>

      {/* Acceso Rápido a Módulos Contables */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {quickLinks.map(l => (
          <Link key={l.href} href={l.href}
            className="flex items-center gap-3 bg-white border border-lilac-100 rounded-xl px-4 py-3 hover:bg-lilac-50 transition-colors shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-lilac-50 flex items-center justify-center shrink-0">{l.icon}</div>
            <div>
              <p className="text-sm font-semibold text-ink-800">{l.label}</p>
              <p className="text-xs text-ink-400">{l.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Tabs de Reportes */}
      <div className="flex gap-1 mb-3 overflow-x-auto">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={`/erp/contabilidad?tab=${t.key}&period=${period}`}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              tab === t.key
                ? "bg-lilac-600 text-white shadow-xs"
                : "bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50"
            }`}
          >
            {t.icon}{t.label}
          </Link>
        ))}
      </div>

      {/* Selector de Período (Meses) — Ubicado sobre Libro Diario */}
      <div className="bg-white border border-lilac-100 rounded-2xl p-2.5 shadow-2xs mb-4 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 pl-1 shrink-0">
          <Calendar size={14} className="text-lilac-600" />
          <span className="text-xs font-bold text-ink-700">Período:</span>
        </div>
        <div className="flex gap-1 items-center overflow-x-auto">
          <Link
            href={`/erp/contabilidad?tab=${tab}&period=all`}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center justify-center font-bold leading-tight ${
              period === "all"
                ? "bg-lilac-600 text-white shadow-xs"
                : "bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50"
            }`}
          >
            Todos
          </Link>
          {months.map(m => {
            const yearNum = Number(m.split("-")[0]);
            const isAnnualClosed = annualClosedYears.has(yearNum);
            const isMonthlyClosed = monthlyClosedSet.has(m);
            const isSelected = m === period;
            const label = new Date(Number(m.split("-")[0]), Number(m.split("-")[1]) - 1, 1)
              .toLocaleDateString("es-EC", { month: "short", year: "2-digit" });

            let pillStyle = "bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50";
            let badgeText = null;

            if (isAnnualClosed) {
              badgeText = "🏢 ANUAL";
              pillStyle = isSelected
                ? "bg-orange-600 text-white font-bold ring-2 ring-orange-400 shadow-sm"
                : "bg-orange-100 border border-orange-300 text-orange-950 hover:bg-orange-200 font-semibold";
            } else if (isMonthlyClosed) {
              badgeText = "🔒 CERRADO";
              pillStyle = isSelected
                ? "bg-yellow-500 text-white font-bold ring-2 ring-yellow-300 shadow-sm"
                : "bg-yellow-100 border border-yellow-300 text-yellow-950 hover:bg-yellow-200 font-semibold";
            } else if (isSelected) {
              pillStyle = "bg-lilac-600 text-white font-bold shadow-xs";
            }

            return (
              <Link
                key={m}
                href={`/erp/contabilidad?tab=${tab}&period=${m}`}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-xs transition-colors flex flex-col items-center justify-center leading-tight ${pillStyle}`}
              >
                {badgeText && (
                  <span className={`text-[8px] font-bold tracking-tight uppercase leading-none mb-0.5 ${
                    isSelected ? "text-white opacity-90" : isAnnualClosed ? "text-orange-800" : "text-yellow-800"
                  }`}>
                    {badgeText}
                  </span>
                )}
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── LIBRO DIARIO (ESPACIO OPTIMIZADO, SIN INDICADORES REDUNDANTES, ASIENTOS JUNTOS) ── */}
      {tab === "diario" && (
        <div className="space-y-3">
          {/* Cabecera compacta del Libro Diario (Una sola barra sin indicadores gigantes) */}
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-2xs p-3 md:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-lilac-600 shrink-0" />
                <h2 className="font-bold text-sm text-ink-900">
                  Libro Diario General NIIF — {periodLabel(period)}
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                  isPeriodSquare ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"
                }`}>
                  {isPeriodSquare ? "✓ Cuadrado" : `Descuadre: $${fmt(Math.abs(totalPeriodDebit - totalPeriodCredit))}`}
                </span>
              </div>
              <p className="text-xs text-ink-500 mt-0.5">
                {allEntries.length} asientos · Débito: <strong className="font-mono text-emerald-700">${fmt(totalPeriodDebit)}</strong> · Crédito: <strong className="font-mono text-blue-700">${fmt(totalPeriodCredit)}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              <SincronizarAsientosButton period={period} />
              <ExportarExcelContableButton
                tab="diario"
                period={period}
                periodLabel={periodLabel(period)}
                entries={orderedEntries}
              />
            </div>
          </div>

          {/* Listado de Asientos Agrupados por Día y por Operación */}
          {dayGroups.length === 0 ? (
            <div className="bg-white border border-lilac-100 rounded-2xl p-10 text-center text-sm text-ink-400 shadow-2xs">
              <BookOpen size={28} className="mx-auto text-lilac-300 mb-2" />
              <p className="font-semibold text-ink-700 text-xs">Sin asientos registrados en este período.</p>
              <p className="text-[11px] text-ink-400 mt-0.5">Las ventas y gastos que se registren en este mes aparecerán aquí numerados automáticamente.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dayGroups.map((dayGroup) => {
                const daySquare = Math.abs(dayGroup.totalDebit - dayGroup.totalCredit) < 0.01;

                return (
                  <div key={dayGroup.date} className="bg-white border border-lilac-100 rounded-2xl shadow-2xs overflow-hidden">
                    {/* Barra de Día con Totales Diarios Compactos */}
                    <div className="px-3.5 py-2 bg-lilac-50/50 border-b border-lilac-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-lilac-700 shrink-0" />
                        <h3 className="text-xs font-bold text-ink-900">
                          {dayGroup.formattedDate}
                        </h3>
                        <span className="text-[10px] bg-white border border-lilac-200 text-ink-600 px-1.5 py-0.2 rounded-full font-semibold">
                          {dayGroup.totalEntriesCount} {dayGroup.totalEntriesCount === 1 ? "asiento" : "asientos"}
                        </span>
                      </div>

                      {/* Totales Diarios en una sola línea */}
                      <div className="flex items-center gap-2 text-xs self-end sm:self-auto flex-wrap">
                        <span className="text-[11px] font-semibold text-ink-500">Total Día:</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold font-mono text-[11px]">
                          Debe: ${fmt(dayGroup.totalDebit)}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-200 font-bold font-mono text-[11px]">
                          Haber: ${fmt(dayGroup.totalCredit)}
                        </span>
                        {daySquare && (
                          <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5">
                            <CheckCircle2 size={11} /> Cuadrado
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Transacciones del Día (Asientos que se hicieron juntos se muestran juntos) */}
                    <div className="p-3 space-y-3">
                      {dayGroup.transactions.map((tx) => {
                        const hasMultiple = tx.entries.length > 1;

                        return (
                          <div
                            key={tx.key}
                            className={`border rounded-xl overflow-hidden transition ${
                              hasMultiple
                                ? "border-lilac-200 bg-lilac-50/10 shadow-2xs"
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            {/* Cabecera de la Transacción (si tiene múltiples asientos vinculados) */}
                            {hasMultiple && (
                              <div className="px-3 py-1.5 bg-gradient-to-r from-lilac-100/70 via-lilac-50/50 to-white border-b border-lilac-200 flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`text-[10px] px-2 py-0.2 rounded-md font-bold border ${tx.badge.color}`}>
                                    {tx.badge.label}
                                  </span>
                                  <h4 className="text-xs font-bold text-ink-900 truncate max-w-md" title={tx.title}>
                                    {cleanEntryTitle(tx.title, tx.badge.label)}
                                  </h4>
                                </div>
                                <span className="text-[10px] font-bold text-lilac-800 bg-white px-2 py-0.5 rounded-full border border-lilac-200 shadow-2xs">
                                  🔗 {tx.entries.length} asientos vinculados ({tx.badge.label === "Venta" ? "Venta + Cobro" : "Devengo + Pago"})
                                </span>
                              </div>
                            )}

                            {/* Asientos de esta Operación */}
                            <div className="divide-y divide-gray-100">
                              {tx.entries.map(({ entry, entryNumber, entryCode, isPayment, isCollection, isInvoice, debitTotal, creditTotal }: any) => {
                                const badge = getEntryBadge(entry.reference_type, entry.description);
                                const cleanTitle = cleanEntryTitle(entry.description, badge.label);
                                const entryTitleForLines = hasMultiple ? cleanEntryTitle(tx.title, tx.badge.label) : cleanTitle;

                                return (
                                  <div key={entry.id} className="p-2.5 sm:p-3 space-y-2">
                                    {/* Cabecera del Asiento: Código Único + Badge + Glosa Limpia */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs tracking-tight shadow-2xs ${
                                        isCollection ? "bg-emerald-700 text-white" : isPayment ? "bg-blue-600 text-white" : "bg-lilac-800 text-white"
                                      }`}>
                                        {entryCode}
                                      </span>

                                      {!hasMultiple && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${badge.color} shrink-0`}>
                                          {badge.label}
                                        </span>
                                      )}

                                      <h5 className="text-xs font-bold text-ink-800">
                                        {hasMultiple
                                          ? (isCollection
                                              ? "Cobro / Recaudación Bancaria / Caja"
                                              : isPayment
                                              ? "Pago / Cruce con Banco"
                                              : isInvoice
                                              ? "Factura de Venta (Devengo)"
                                              : "Causación del Gasto (Devengo)")
                                          : cleanTitle}
                                      </h5>
                                    </div>

                                    {/* Tabla Contable: Código, Cuenta, Débito, Crédito */}
                                    <div className="overflow-x-auto rounded-lg border border-gray-100">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-gray-50/75 border-b border-gray-200 text-ink-400 font-semibold text-[10px] uppercase tracking-wider text-left">
                                            <th className="py-1 px-2.5 w-24">Código</th>
                                            <th className="py-1 px-2.5">Cuenta Contable</th>
                                            <th className="py-1 px-2.5 text-right w-24">Débito (Debe)</th>
                                            <th className="py-1 px-2.5 text-right w-24">Crédito (Haber)</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(entry.lines ?? []).map((l: any, lIdx: number) => {
                                            const deb = Number(l.debit || 0);
                                            const cred = Number(l.credit || 0);
                                            const lineDetail = cleanLineDescription(l.description, entryTitleForLines);

                                            return (
                                              <tr key={l.id || lIdx} className="border-t border-gray-50 hover:bg-gray-50/50">
                                                <td className="py-1 px-2.5 font-mono text-ink-500 text-[11px]">
                                                  {l.account_code}
                                                </td>
                                                <td className="py-1 px-2.5 text-ink-800">
                                                  {deb > 0 ? (
                                                    <span className="font-medium">{l.account_name}</span>
                                                  ) : (
                                                    <span className="pl-4 text-ink-600 flex items-center gap-1">
                                                      <span className="text-gray-400">↳</span> {l.account_name}
                                                    </span>
                                                  )}
                                                  {lineDetail && (
                                                    <span className="block text-[10px] text-ink-400 font-normal italic">
                                                      {lineDetail}
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-1 px-2.5 text-right font-mono font-medium text-emerald-700">
                                                  {deb > 0 ? `$${fmt(deb)}` : "—"}
                                                </td>
                                                <td className="py-1 px-2.5 text-right font-mono font-medium text-blue-700">
                                                  {cred > 0 ? `$${fmt(cred)}` : "—"}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                        <tfoot>
                                          <tr className="bg-lilac-50/30 border-t border-lilac-100 font-bold text-[10px]">
                                            <td colSpan={2} className="py-1 px-2.5 text-right text-ink-500 uppercase tracking-wide">
                                              Total {entryCode}:
                                            </td>
                                            <td className="py-1 px-2.5 text-right font-mono text-emerald-800">
                                              ${fmt(debitTotal)}
                                            </td>
                                            <td className="py-1 px-2.5 text-right font-mono text-blue-800">
                                              ${fmt(creditTotal)}
                                            </td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ESTADO DE RESULTADOS ──────────────────────────────────────────── */}
      {tab === "resultados" && (
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-lilac-50 bg-lilac-50/30 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-sm text-ink-800">Estado de Resultados — {periodLabel(period)}</h2>
              <p className="text-xs text-ink-400">Ingresos, costos y utilidad neta NIIF</p>
            </div>
            <div className="flex items-center gap-2">
              <ExportarExcelContableButton
                tab="resultados"
                period={period}
                periodLabel={periodLabel(period)}
                balanceRows={balanceRows}
                ingresos={ingresos}
                gastos={gastos}
                utilidad={utilidad}
              />
              <Link
                href={`/erp/contabilidad/resultados?period=${period}`}
                className="text-xs font-semibold text-lilac-600 hover:text-lilac-800 hover:underline flex items-center gap-1 bg-white border border-lilac-200 px-3 py-1.5 rounded-xl shadow-2xs"
              >
                Ver más (Reporte completo) →
              </Link>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {/* Ingresos */}
            <div>
              <h3 className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">Ingresos</h3>
              {balanceRows.filter(r => r.code.startsWith("4.") && r.credit > 0).map(r => (
                <div key={r.code} className="flex justify-between text-sm py-1 border-b border-lilac-50">
                  <span className="text-ink-700 flex items-center gap-2">
                    <span className="text-xs font-mono text-ink-400">{r.code}</span>
                    {r.name}
                  </span>
                  <span className="font-medium text-green-700">${fmt(r.credit - r.debit)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-sm pt-2 border-t-2 border-green-200">
                <span>Total Ingresos</span>
                <span className="text-green-700">${fmt(ingresos)}</span>
              </div>
            </div>

            {/* Gastos */}
            <div>
              <h3 className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">Gastos</h3>
              {balanceRows.filter(r => r.code.startsWith("5.") && r.debit > 0).map(r => (
                <div key={r.code} className="flex justify-between text-sm py-1 border-b border-lilac-50">
                  <span className="text-ink-700 flex items-center gap-2">
                    <span className="text-xs font-mono text-ink-400">{r.code}</span>
                    {r.name}
                  </span>
                  <span className="font-medium text-red-600">${fmt(r.debit - r.credit)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-sm pt-2 border-t-2 border-red-200">
                <span>Total Gastos</span>
                <span className="text-red-600">${fmt(gastos)}</span>
              </div>
            </div>

            {/* Resultado */}
            <div className={`flex justify-between text-base font-bold p-4 rounded-xl ${
              utilidad >= 0 ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}>
              <span>{utilidad >= 0 ? "UTILIDAD DEL PERÍODO" : "PÉRDIDA DEL PERÍODO"}</span>
              <span>${fmt(Math.abs(utilidad))}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── BALANCE DE COMPROBACIÓN ───────────────────────────────────────── */}
      {tab === "balance" && (
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-lilac-100 bg-lilac-50/40 flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Scale size={18} className="text-lilac-600" />
                <h2 className="font-bold text-base text-ink-900">
                  Balance de Comprobación — {periodLabel(period)}
                </h2>
              </div>
              <p className="text-xs text-ink-500 mt-0.5">
                {view !== "flat"
                  ? `${hierarchicalRows.length} líneas estructuradas con grupos y subtotales (= TOTAL =)`
                  : `${balanceRows.length} cuentas de movimiento registradas`}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Selector de Vista: Estructurado NIIF vs Lista Plana */}
              <div className="flex items-center bg-white border border-lilac-200 p-0.5 rounded-xl text-xs font-semibold shadow-2xs">
                <Link
                  href={`/erp/contabilidad?tab=balance&period=${period}&view=tree`}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    view !== "flat"
                      ? "bg-lilac-600 text-white shadow-2xs font-bold"
                      : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  Estructurado NIIF (= TOTAL =)
                </Link>
                <Link
                  href={`/erp/contabilidad?tab=balance&period=${period}&view=flat`}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    view === "flat"
                      ? "bg-lilac-600 text-white shadow-2xs font-bold"
                      : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  Solo Cuentas
                </Link>
              </div>

              <ExportarExcelContableButton
                tab="balance"
                period={period}
                periodLabel={periodLabel(period)}
                view={view}
                hierarchicalRows={hierarchicalRows}
                balanceRows={balanceRows}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead className="bg-slate-50 text-ink-700 text-xs uppercase font-bold border-b-2 border-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left w-36 font-bold">CODIGO</th>
                  <th className="px-4 py-3 text-left font-bold">NOMBRE DE LA CUENTA</th>
                  <th className="px-4 py-3 text-right w-36 font-bold">SALDO ANTERIOR</th>
                  <th className="px-4 py-3 text-right w-36 font-bold">DEBE</th>
                  <th className="px-4 py-3 text-right w-36 font-bold">HABER</th>
                  <th className="px-4 py-3 text-right w-36 font-bold">SALDO ACTUAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {view !== "flat" ? (
                  // ── Vista Estructurada Jerárquica NIIF (Idéntica al ejemplo) ──
                  hierarchicalRows.map((r, idx) => {
                    if (r.type === "header") {
                      return (
                        <tr key={`h-${r.code}-${idx}`} className="bg-slate-50/40">
                          <td className="px-4 py-1.5 font-mono text-xs font-bold text-ink-900">
                            {r.code}
                          </td>
                          <td
                            colSpan={5}
                            className="px-4 py-1.5 font-bold text-xs text-ink-900 tracking-wide uppercase"
                            style={{ paddingLeft: `${r.level * 16 + 16}px` }}
                          >
                            {r.name}
                          </td>
                        </tr>
                      );
                    }

                    if (r.type === "subtotal") {
                      return (
                        <tr key={`sub-${r.name}-${idx}`} className="bg-white text-xs font-bold text-ink-900">
                          <td className="px-4 py-2 font-mono text-xs text-ink-700 font-bold">
                            = TOTAL =
                          </td>
                          <td
                            className="px-4 py-2 uppercase font-bold text-ink-800"
                            style={{ paddingLeft: `${r.level * 16 + 16}px` }}
                          >
                            {r.name}
                          </td>
                          <td className="px-4 py-2 text-right border-t border-slate-300 font-medium text-ink-800">
                            {fmt(r.saldoAnterior)}
                          </td>
                          <td className="px-4 py-2 text-right border-t border-slate-300 font-medium text-ink-800">
                            {r.debe > 0 ? fmt(r.debe) : "0.00"}
                          </td>
                          <td className="px-4 py-2 text-right border-t border-slate-300 font-medium text-ink-800">
                            {r.haber > 0 ? fmt(r.haber) : "0.00"}
                          </td>
                          <td
                            className={`px-4 py-2 text-right border-t border-slate-300 font-bold ${
                              r.saldoActual < 0 ? "text-red-600" : "text-ink-900"
                            }`}
                          >
                            {fmt(r.saldoActual)}
                          </td>
                        </tr>
                      );
                    }

                    // Cuenta de movimiento
                    return (
                      <tr key={`mov-${r.code}-${idx}`} className="hover:bg-slate-50/50 transition-colors text-xs">
                        <td className="px-4 py-1.5 font-mono text-ink-600">
                          {r.code}
                        </td>
                        <td
                          className="px-4 py-1.5 text-ink-800"
                          style={{ paddingLeft: `${(r.level + 1) * 16 + 16}px` }}
                        >
                          {r.name}
                        </td>
                        <td
                          className={`px-4 py-1.5 text-right font-medium ${
                            r.saldoAnterior < 0 ? "text-red-600" : "text-ink-700"
                          }`}
                        >
                          {fmt(r.saldoAnterior)}
                        </td>
                        <td className="px-4 py-1.5 text-right font-medium text-ink-700">
                          {r.debe > 0 ? fmt(r.debe) : "0.00"}
                        </td>
                        <td className="px-4 py-1.5 text-right font-medium text-ink-700">
                          {r.haber > 0 ? fmt(r.haber) : "0.00"}
                        </td>
                        <td
                          className={`px-4 py-1.5 text-right font-semibold ${
                            r.saldoActual < 0 ? "text-red-600 font-bold" : "text-ink-900"
                          }`}
                        >
                          {fmt(r.saldoActual)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  // ── Vista Plana (Solo Cuentas de Movimiento) ──
                  balanceRows.map((r) => {
                    return (
                      <tr key={r.code} className="hover:bg-slate-50/50 transition-colors text-xs">
                        <td className="px-4 py-2 font-mono text-ink-600 font-medium">
                          {r.code}
                        </td>
                        <td className="px-4 py-2 text-ink-800 font-medium">
                          <div className="flex items-center gap-2">
                            <span>{r.name}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-normal ${
                                r.nature === "acreedora"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-blue-50 text-blue-700 border border-blue-200"
                              }`}
                            >
                              {r.nature === "acreedora" ? "Acreedora" : "Deudora"}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-medium ${
                            r.prevBalance < 0 ? "text-red-600" : "text-ink-700"
                          }`}
                        >
                          {fmt(r.prevBalance)}
                        </td>
                        <td className="px-4 py-2 text-right text-green-700 font-medium">
                          {r.monthDebit > 0 ? fmt(r.monthDebit) : "0.00"}
                        </td>
                        <td className="px-4 py-2 text-right text-red-600 font-medium">
                          {r.monthCredit > 0 ? fmt(r.monthCredit) : "0.00"}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-bold ${
                            r.finalBalance < 0 ? "text-red-600" : "text-ink-900"
                          }`}
                        >
                          {fmt(r.finalBalance)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold text-xs border-t-2 border-slate-400">
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-ink-900">= TOTAL GENERAL =</td>
                  <td className="px-4 py-3 uppercase font-bold text-ink-900">BALANCE DE COMPROBACIÓN NIIF</td>
                  <td className="px-4 py-3 text-right text-ink-800">${fmt(totalPrevBalance)}</td>
                  <td className="px-4 py-3 text-right text-ink-900">${fmt(totalDebit)}</td>
                  <td className="px-4 py-3 text-right text-ink-900">${fmt(totalCredit)}</td>
                  <td className="px-4 py-3 text-right text-ink-900">${fmt(totalFinalBalance)}</td>
                </tr>
                <tr className="border-t border-slate-200 bg-white text-xs font-normal">
                  <td colSpan={6} className="px-4 py-2.5 text-ink-600">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink-700">Partida Doble (Mes):</span>
                        <span
                          className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full ${
                            Math.abs(totalDebit - totalCredit) < 0.01
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {Math.abs(totalDebit - totalCredit) < 0.01
                            ? `✓ Cuadrado ($${fmt(totalDebit)})`
                            : `✗ Descuadre de $${fmt(Math.abs(totalDebit - totalCredit))}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink-700">Sumas Acumuladas NIIF:</span>
                        <span
                          className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full ${
                            Math.abs(totalFinalDebit - totalFinalCredit) < 0.01
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {Math.abs(totalFinalDebit - totalFinalCredit) < 0.01
                            ? `✓ Cuadrado Total ($${fmt(totalFinalDebit)})`
                            : `✗ Descuadre Total de $${fmt(Math.abs(totalFinalDebit - totalFinalCredit))}`}
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── RESUMEN IVA (Form. 104) ───────────────────────────────────────── */}
      {tab === "iva" && (
        <div className="space-y-4">
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <div>
                <h2 className="font-semibold text-sm text-ink-800">Resumen IVA — {periodLabel(period)}</h2>
                <p className="text-xs text-ink-400">Declaración mensual de retenciones e impuestos</p>
              </div>
              <div className="flex items-center gap-2">
                <ExportarExcelContableButton
                  tab="iva"
                  period={period}
                  periodLabel={periodLabel(period)}
                  ivaData={{ ivaVentas, ivaCompras, ivaPagar }}
                />
                <Link
                  href={`/erp/contabilidad/iva?period=${period}`}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl shadow-2xs"
                >
                  Ver más (Form. 104 completo) →
                </Link>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-3 border-b border-lilac-50">
                <div>
                  <p className="text-sm font-medium text-ink-800">IVA en Ventas (Casillero 429)</p>
                  <p className="text-xs text-ink-400">IVA cobrado a clientes — cuenta 2.1.02.01</p>
                </div>
                <span className="font-bold text-base text-green-700">${fmt(ivaVentas)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-lilac-50">
                <div>
                  <p className="text-sm font-medium text-ink-800">Crédito Tributario IVA (Casillero 615)</p>
                  <p className="text-xs text-ink-400">IVA pagado en compras — cuenta 1.1.03.01</p>
                </div>
                <span className="font-bold text-base text-blue-700">${fmt(ivaCompras)}</span>
              </div>
              <div className={`flex justify-between items-center py-4 px-4 rounded-xl ${
                ivaPagar > 0 ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"
              }`}>
                <div>
                  <p className={`text-sm font-bold ${ivaPagar > 0 ? "text-red-800" : "text-green-800"}`}>
                    {ivaPagar > 0 ? "IVA a Pagar al SRI" : "Crédito Tributario a Favor"}
                  </p>
                  <p className={`text-xs ${ivaPagar > 0 ? "text-red-600" : "text-green-600"}`}>
                    IVA Ventas − Crédito Tributario
                  </p>
                </div>
                <span className={`font-bold text-xl ${ivaPagar > 0 ? "text-red-700" : "text-green-700"}`}>
                  ${fmt(Math.abs(ivaPagar))}
                </span>
              </div>
            </div>
          </div>

          {/* Detalle compras */}
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-lilac-50">
              <h3 className="font-semibold text-sm text-ink-800">Detalle de Ventas (Facturas emitidas)</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-lilac-50/50 text-xs uppercase text-ink-500">
                <tr>
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-left">Descripción</th>
                  <th className="px-4 py-2 text-right">Base IVA</th>
                  <th className="px-4 py-2 text-right">IVA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {allEntries.filter((e: any) => e.reference_type === "invoice").map((e: any) => {
                  const ivaLine = (e.lines ?? []).find((l: any) => l.account_code === "2.1.02.01");
                  const baseIva = ivaLine ? Number(ivaLine.credit) / 0.15 : 0;
                  return (
                    <tr key={e.id} className="hover:bg-lilac-50/20">
                      <td className="px-4 py-2 text-ink-400 text-xs font-mono">{e.entry_date}</td>
                      <td className="px-4 py-2 text-ink-700">{e.description}</td>
                      <td className="px-4 py-2 text-right text-ink-600">${fmt(baseIva)}</td>
                      <td className="px-4 py-2 text-right font-medium text-green-700">${fmt(ivaLine ? Number(ivaLine.credit) : 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
