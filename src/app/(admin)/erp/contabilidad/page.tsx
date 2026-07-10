import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { BookOpen, TrendingUp, TrendingDown, Scale, FileBarChart2, Receipt, FileSpreadsheet, DollarSign } from "lucide-react";
import { assertPermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function periodLabel(period: string) {
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-EC", { month: "long", year: "numeric" });
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

  const [year, month] = period.split("-").map(Number);
  const from  = new Date(year, month - 1, 1).toISOString().split("T")[0];
  const to    = new Date(year, month, 0).toISOString().split("T")[0];

  // Meses disponibles (últimos 12)
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const supabase = createAdminClient();

  // Cargar asientos del período con sus líneas
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("*, lines:journal_lines(*)")
    .gte("entry_date", from)
    .lte("entry_date", to)
    .eq("status", "posted")
    .order("entry_date");

  const allEntries = entries ?? [];

  // Todas las líneas del período
  const allLines = allEntries.flatMap((e: any) =>
    (e.lines ?? []).map((l: any) => ({ ...l, entry_date: e.entry_date, entry_desc: e.description }))
  );

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
    { href: `/erp/contabilidad/ats?period=${period}`,         label: "ATS — Anexo Transaccional",      icon: <FileSpreadsheet size={14} className="text-lilac-600" />,  desc: "Compras y ventas para SRI" },
    { href: "/erp/contabilidad/dividendos",                    label: "ADI — Dividendos y Utilidades",  icon: <DollarSign size={14} className="text-green-600" />,        desc: "Registro de distribución" },
    { href: `/erp/contabilidad/balance`,                       label: "Balance General",                icon: <Scale size={14} className="text-blue-600" />,              desc: "Situación financiera (Activos / Pasivos / Patrimonio)" },
    { href: `/erp/contabilidad/resultados?period=${period}`,   label: "Estado de Resultados",           icon: <TrendingUp size={14} className="text-green-600" />,         desc: "Ingresos vs Gastos — Utilidad neta" },
    { href: `/erp/contabilidad/iva?period=${period}`,          label: "Resumen IVA — Form. 104",        icon: <Receipt size={14} className="text-amber-600" />,            desc: "IVA ventas, compras y neto a pagar" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <FileBarChart2 size={20} className="text-lilac-600" />
          <h1 className="text-xl font-bold text-ink-900">Contabilidad</h1>
        </div>
        {/* Selector de período */}
        <div className="flex gap-1 overflow-x-auto">
          {months.map(m => (
            <Link
              key={m}
              href={`/erp/contabilidad?tab=${tab}&period=${m}`}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                m === period ? "bg-lilac-600 text-white" : "bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50"
              }`}
            >
              {new Date(Number(m.split("-")[0]), Number(m.split("-")[1]) - 1, 1)
                .toLocaleDateString("es-EC", { month: "short", year: "2-digit" })}
            </Link>
          ))}
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl px-3 py-2.5 border border-green-200 shadow-sm">
          <div className="text-[11px] text-ink-500 flex items-center gap-1 mb-1"><TrendingUp size={11} className="text-green-500" />Ingresos</div>
          <div className="text-lg font-bold text-green-600 leading-none">${fmt(ingresos)}</div>
        </div>
        <div className="bg-white rounded-xl px-3 py-2.5 border border-red-200 shadow-sm">
          <div className="text-[11px] text-ink-500 flex items-center gap-1 mb-1"><TrendingDown size={11} className="text-red-500" />Gastos</div>
          <div className="text-lg font-bold text-red-600 leading-none">${fmt(gastos)}</div>
        </div>
        <div className={`bg-white rounded-xl px-3 py-2.5 border shadow-sm ${utilidad >= 0 ? "border-lilac-200" : "border-red-200"}`}>
          <div className="text-[11px] text-ink-500 mb-1">Utilidad</div>
          <div className={`text-lg font-bold leading-none ${utilidad >= 0 ? "text-lilac-700" : "text-red-600"}`}>${fmt(utilidad)}</div>
        </div>
      </div>

      {/* Quick links ATS / ADI */}
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

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={`/erp/contabilidad?tab=${t.key}&period=${period}`}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-lilac-600 text-white"
                : "bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50"
            }`}
          >
            {t.icon}{t.label}
          </Link>
        ))}
      </div>

      {/* ── LIBRO DIARIO ──────────────────────────────────────────────────── */}
      {tab === "diario" && (
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-lilac-50 bg-lilac-50/30">
            <h2 className="font-semibold text-sm text-ink-800">Libro Diario — {periodLabel(period)}</h2>
            <p className="text-xs text-ink-400">{allEntries.length} asientos · {allLines.length} líneas</p>
          </div>
          {allEntries.length === 0 ? (
            <p className="text-center text-sm text-ink-400 py-12">Sin asientos en este período.</p>
          ) : (
            <div className="divide-y divide-lilac-50">
              {allEntries.map((entry: any) => (
                <div key={entry.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs text-ink-400 font-mono">{entry.entry_date}</span>
                      <span className="ml-3 text-sm font-medium text-ink-800">{entry.description}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      entry.reference_type === "invoice" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                    }`}>
                      {entry.reference_type === "invoice" ? "Venta" : "Gasto"}
                    </span>
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {(entry.lines ?? []).map((l: any) => (
                        <tr key={l.id} className="border-t border-lilac-50">
                          <td className="py-1 pr-2 font-mono text-ink-400 w-28">{l.account_code}</td>
                          <td className="py-1 text-ink-700 flex-1">
                            {l.debit > 0 ? l.account_name : <span className="pl-6">{l.account_name}</span>}
                          </td>
                          <td className="py-1 text-right font-medium text-green-700 w-24">
                            {l.debit > 0 ? `$${fmt(l.debit)}` : ""}
                          </td>
                          <td className="py-1 text-right font-medium text-red-600 w-24">
                            {l.credit > 0 ? `$${fmt(l.credit)}` : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ESTADO DE RESULTADOS ──────────────────────────────────────────── */}
      {tab === "resultados" && (
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-lilac-50 bg-lilac-50/30">
            <h2 className="font-semibold text-sm text-ink-800">Estado de Resultados — {periodLabel(period)}</h2>
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
          <div className="px-5 py-3 border-b border-lilac-50 bg-lilac-50/30">
            <h2 className="font-semibold text-sm text-ink-800">Balance de Comprobación — {periodLabel(period)}</h2>
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
            <h2 className="font-semibold text-sm text-ink-800 mb-4">Resumen IVA — {periodLabel(period)}</h2>
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
