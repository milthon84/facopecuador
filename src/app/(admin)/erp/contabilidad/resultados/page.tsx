import { createAdminClient } from "@/lib/supabase/admin";
import { TrendingUp, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { assertPermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type AccountBalance = { code: string; name: string; balance: number };

function periodLabel(p: string) {
  const [y, m] = p.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-EC", { month: "long", year: "numeric" });
}

export default async function EstadoResultadosPage({
  searchParams: searchParamsPromise,
}: { searchParams: Promise<{ period?: string; from?: string; to?: string; mode?: string }> }) {
  await assertPermission("/erp/contabilidad");
  const searchParams = await searchParamsPromise;
  const now = new Date();
  const mode = searchParams.mode ?? "period";

  const months: string[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  let from: string, to: string, title: string;

  if (mode === "range") {
    from  = searchParams.from ?? `${now.getFullYear()}-01-01`;
    to    = searchParams.to   ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    title = `Del ${new Date(from).toLocaleDateString("es-EC")} al ${new Date(to).toLocaleDateString("es-EC")}`;
  } else {
    const period = searchParams.period ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [y, m] = period.split("-").map(Number);
    from  = new Date(y, m - 1, 1).toISOString().split("T")[0];
    to    = new Date(y, m, 0).toISOString().split("T")[0];
    title = periodLabel(period);
  }

  const supabase = createAdminClient();
  const { data: rawLines } = await supabase
    .from("journal_lines")
    .select("account_code, account_name, debit, credit, journal_entries!inner(entry_date, status)")
    .gte("journal_entries.entry_date", from)
    .lte("journal_entries.entry_date", to)
    .eq("journal_entries.status", "posted");

  const lines = (rawLines || []).map((l: any) => ({
    account_code: l.account_code,
    account_name: l.account_name,
    debit: Number(l.debit),
    credit: Number(l.credit),
  }));

  // Agrupar por cuenta
  const byCode = new Map<string, AccountBalance>();
  for (const l of lines) {
    const prev = byCode.get(l.account_code);
    if (prev) prev.balance += l.debit - l.credit;
    else byCode.set(l.account_code, { code: l.account_code, name: l.account_name, balance: l.debit - l.credit });
  }

  // Ingresos (4.x): saldo acreedor → balance = -(debit-credit)
  const ingresos: AccountBalance[] = Array.from(byCode.values())
    .filter(a => a.code.startsWith("4"))
    .map(a => ({ ...a, balance: r2(-a.balance) }))
    .filter(a => a.balance !== 0)
    .sort((a, b) => a.code.localeCompare(b.code));

  // Gastos (5.x): saldo deudor → balance = debit-credit
  const gastos: AccountBalance[] = Array.from(byCode.values())
    .filter(a => a.code.startsWith("5"))
    .map(a => ({ ...a, balance: r2(a.balance) }))
    .filter(a => a.balance !== 0)
    .sort((a, b) => a.code.localeCompare(b.code));

  const totalIngresos = r2(ingresos.reduce((s, a) => s + a.balance, 0));
  const totalGastos   = r2(gastos.reduce((s, a) => s + a.balance, 0));
  const utilidadNeta  = r2(totalIngresos - totalGastos);
  const margenPct     = totalIngresos > 0 ? Math.round((utilidadNeta / totalIngresos) * 100) : 0;

  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/erp/contabilidad"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
            <TrendingUp className="text-lilac-600" /> Estado de Resultados
          </h1>
          <p className="text-sm text-ink-500">{title}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <form method="get" className="flex items-center gap-2">
            <input type="hidden" name="mode" value="period" />
            <label className="text-xs font-semibold text-ink-600">Por mes:</label>
            <select name="period" defaultValue={mode === "period" ? (searchParams.period ?? currentPeriod) : currentPeriod}
              className="border border-lilac-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white">
              {months.map(m => <option key={m} value={m}>{periodLabel(m)}</option>)}
            </select>
            <button type="submit" className="bg-lilac-600 hover:bg-lilac-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">Ver</button>
          </form>

          <form method="get" className="flex items-center gap-2">
            <input type="hidden" name="mode" value="range" />
            <label className="text-xs font-semibold text-ink-600">Rango:</label>
            <input type="date" name="from" defaultValue={searchParams.from ?? `${now.getFullYear()}-01-01`}
              className="border border-lilac-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white" />
            <span className="text-ink-400 text-xs">—</span>
            <input type="date" name="to" defaultValue={searchParams.to ?? to}
              className="border border-lilac-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white" />
            <button type="submit" className="bg-lilac-600 hover:bg-lilac-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">Ver</button>
          </form>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
          <p className="text-xs text-green-700 font-medium mb-1">Total Ingresos</p>
          <p className="text-xl font-bold text-green-800">${fmt(totalIngresos)}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
          <p className="text-xs text-red-700 font-medium mb-1">Total Gastos</p>
          <p className="text-xl font-bold text-red-700">${fmt(totalGastos)}</p>
        </div>
        <div className={`rounded-2xl p-4 text-center border ${utilidadNeta >= 0 ? "bg-lilac-600 border-lilac-700" : "bg-red-100 border-red-200"}`}>
          <p className={`text-xs font-medium mb-1 ${utilidadNeta >= 0 ? "text-lilac-100" : "text-red-700"}`}>
            {utilidadNeta >= 0 ? "Utilidad Neta" : "Pérdida Neta"}
          </p>
          <p className={`text-xl font-bold ${utilidadNeta >= 0 ? "text-white" : "text-red-800"}`}>${fmt(Math.abs(utilidadNeta))}</p>
          <p className={`text-xs ${utilidadNeta >= 0 ? "text-lilac-200" : "text-red-600"}`}>Margen: {margenPct}%</p>
        </div>
      </div>

      {/* Ingresos */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden mb-4">
        <div className="bg-green-600 px-5 py-3 flex justify-between items-center">
          <h2 className="font-bold text-white">INGRESOS</h2>
          <span className="text-white/80 text-sm font-mono">${fmt(totalIngresos)}</span>
        </div>
        <div className="divide-y divide-lilac-50">
          {ingresos.length === 0 && <p className="text-sm text-ink-400 text-center py-6">Sin ingresos en este período</p>}
          {ingresos.map(a => (
            <div key={a.code} className="flex justify-between items-center px-5 py-2.5 hover:bg-green-50/30">
              <div>
                <span className="text-xs text-ink-400 font-mono mr-2">{a.code}</span>
                <span className="text-sm text-ink-800">{a.name}</span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-green-700">${fmt(a.balance)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gastos */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden mb-4">
        <div className="bg-red-600 px-5 py-3 flex justify-between items-center">
          <h2 className="font-bold text-white">GASTOS</h2>
          <span className="text-white/80 text-sm font-mono">${fmt(totalGastos)}</span>
        </div>
        <div className="divide-y divide-lilac-50">
          {gastos.length === 0 && <p className="text-sm text-ink-400 text-center py-6">Sin gastos en este período</p>}
          {gastos.map(a => (
            <div key={a.code} className="flex justify-between items-center px-5 py-2.5 hover:bg-red-50/30">
              <div>
                <span className="text-xs text-ink-400 font-mono mr-2">{a.code}</span>
                <span className="text-sm text-ink-800">{a.name}</span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-red-600">${fmt(a.balance)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Resultado */}
      <div className={`rounded-2xl border px-5 py-4 flex justify-between items-center ${utilidadNeta >= 0 ? "bg-lilac-600 border-lilac-700" : "bg-red-100 border-red-200"}`}>
        <span className={`font-bold text-lg ${utilidadNeta >= 0 ? "text-white" : "text-red-800"}`}>
          {utilidadNeta >= 0 ? "UTILIDAD NETA DEL PERÍODO" : "PÉRDIDA NETA DEL PERÍODO"}
        </span>
        <span className={`font-bold text-2xl tabular-nums ${utilidadNeta >= 0 ? "text-white" : "text-red-800"}`}>
          ${fmt(Math.abs(utilidadNeta))}
        </span>
      </div>

      <p className="text-xs text-ink-400 text-center mt-4">
        Estado generado desde asientos contables · Sociedad obligada a llevar contabilidad — Régimen General
      </p>
    </div>
  );
}
