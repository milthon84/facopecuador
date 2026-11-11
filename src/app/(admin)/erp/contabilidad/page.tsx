import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { BookOpen, TrendingUp, TrendingDown, Scale, FileBarChart2, Receipt, FileSpreadsheet, DollarSign, Lock, Building2, ShieldCheck, ListTree, FileCheck2, Calendar, CheckCircle2 } from "lucide-react";
import { assertPermission } from "@/lib/auth-action";
import { formatAsientoCode, formatEgresoCode, formatIngresoCode } from "@/lib/accounting-codes";
import ExportarExcelContableButton from "./ExportarExcelContableButton";
import SincronizarAsientosButton from "./SincronizarAsientosButton";

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
  if (d.includes("cruce") || d.includes("pago") || d.includes("banco") || d.includes("préstamo") || d.includes("prestamo")) {
    return { label: "Pago / Cruce", color: "bg-indigo-50 text-indigo-800 border-indigo-200" };
  }
  if (d.includes("cierre")) {
    return { label: "Cierre", color: "bg-orange-50 text-orange-800 border-orange-200" };
  }
  return { label: "Gasto", color: "bg-rose-50 text-rose-800 border-rose-200" };
}

// ── Page ───────────────────────────────────────────────────────────────────
export default async function ContabilidadPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ tab?: string; period?: string }>;
}) {
  await assertPermission("/erp/contabilidad");
  const searchParams = await searchParamsPromise;
  const tab    = searchParams.tab    ?? "diario";
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

  // Cargar cierres mensuales y cierres anuales
  const [{ data: monthlyRecords }, { data: annualRecords }] = await Promise.all([
    supabase.from("monthly_closures").select("period").eq("status", "closed"),
    supabase.from("annual_closures").select("year").eq("status", "closed"),
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

  if (!isAllPeriod) {
    const [year, month] = period.split("-").map(Number);
    const from  = new Date(year, month - 1, 1).toISOString().split("T")[0];
    const to    = new Date(year, month, 0).toISOString().split("T")[0];
    entriesQuery = entriesQuery.gte("entry_date", from).lte("entry_date", to);
  }

  const { data: entries } = await entriesQuery;

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

  // ── Balance de Comprobación ──────────────────────────────────────────────
  const accountMap: Record<string, { code: string; name: string; debit: number; credit: number }> = {};
  for (const l of allLines as any[]) {
    if (!accountMap[l.account_code]) {
      accountMap[l.account_code] = { code: l.account_code, name: l.account_name, debit: 0, credit: 0 };
    }
    accountMap[l.account_code].debit  += Number(l.debit);
    accountMap[l.account_code].credit += Number(l.credit);
  }
  const balanceRows = Object.values(accountMap).sort((a, b) => a.code.localeCompare(b.code));
  const totalDebit  = balanceRows.reduce((s, r) => s + r.debit,  0);
  const totalCredit = balanceRows.reduce((s, r) => s + r.credit, 0);

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
                                    {tx.title}
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

                                return (
                                  <div key={entry.id} className="p-2.5 sm:p-3 space-y-2">
                                    {/* Cabecera del Asiento: Código Único + Glosa */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs tracking-tight shadow-2xs ${
                                          isCollection ? "bg-emerald-700 text-white" : isPayment ? "bg-blue-600 text-white" : "bg-lilac-800 text-white"
                                        }`}>
                                          {entryCode}
                                        </span>
                                        <h5 className="text-xs font-bold text-ink-800">
                                          {hasMultiple
                                            ? (isCollection
                                                ? "Cobro / Recaudación Bancaria / Caja"
                                                : isPayment
                                                ? "Pago / Cruce con Banco"
                                                : isInvoice
                                                ? "Factura de Venta (Devengo)"
                                                : "Causación del Gasto (Devengo)")
                                            : entry.description}
                                        </h5>
                                      </div>

                                      {!hasMultiple && (
                                        <span className={`text-[10px] px-2 py-0.2 rounded-md font-bold border ${badge.color} shrink-0`}>
                                          {badge.label}
                                        </span>
                                      )}
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
                                                  {l.description && (
                                                    <span className="block text-[10px] text-ink-400 font-normal italic">
                                                      {l.description}
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
          <div className="px-5 py-3 border-b border-lilac-50 bg-lilac-50/30 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-sm text-ink-800">Balance de Comprobación — {periodLabel(period)}</h2>
              <p className="text-xs text-ink-400">{balanceRows.length} cuentas registradas</p>
            </div>
            <ExportarExcelContableButton
              tab="balance"
              period={period}
              periodLabel={periodLabel(period)}
              balanceRows={balanceRows}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-lilac-50/50 text-ink-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-left w-28">Código</th>
                  <th className="px-4 py-2.5 text-left">Cuenta</th>
                  <th className="px-4 py-2.5 text-right w-32">Débito</th>
                  <th className="px-4 py-2.5 text-right w-32">Crédito</th>
                  <th className="px-4 py-2.5 text-right w-32">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {balanceRows.map(r => {
                  const saldo = r.debit - r.credit;
                  return (
                    <tr key={r.code} className="hover:bg-lilac-50/20">
                      <td className="px-4 py-2 font-mono text-xs text-ink-400">{r.code}</td>
                      <td className="px-4 py-2 text-ink-800">{r.name}</td>
                      <td className="px-4 py-2 text-right text-green-700 font-medium">{r.debit > 0 ? `$${fmt(r.debit)}` : ""}</td>
                      <td className="px-4 py-2 text-right text-red-600 font-medium">{r.credit > 0 ? `$${fmt(r.credit)}` : ""}</td>
                      <td className={`px-4 py-2 text-right font-bold ${saldo >= 0 ? "text-ink-900" : "text-red-600"}`}>
                        ${fmt(Math.abs(saldo))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-lilac-50 font-bold text-sm border-t-2 border-lilac-200">
                <tr>
                  <td colSpan={2} className="px-4 py-2.5">TOTALES</td>
                  <td className="px-4 py-2.5 text-right text-green-700">${fmt(totalDebit)}</td>
                  <td className="px-4 py-2.5 text-right text-red-600">${fmt(totalCredit)}</td>
                  <td className={`px-4 py-2.5 text-right ${totalDebit === totalCredit ? "text-green-700" : "text-red-700"}`}>
                    {totalDebit === totalCredit ? "✓ Cuadrado" : "✗ Descuadrado"}
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
