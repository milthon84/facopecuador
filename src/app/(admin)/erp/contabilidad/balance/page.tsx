import { createAdminClient } from "@/lib/supabase/admin";
import { Scale, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { assertPermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type JournalLine = { account_code: string; account_name: string; debit: number; credit: number };

interface AccountBalance { code: string; name: string; balance: number }

function groupByCode(lines: JournalLine[]): Map<string, AccountBalance> {
  const map = new Map<string, AccountBalance>();
  for (const l of lines) {
    const prev = map.get(l.account_code);
    if (prev) { prev.balance += l.debit - l.credit; }
    else { map.set(l.account_code, { code: l.account_code, name: l.account_name, balance: l.debit - l.credit }); }
  }
  return map;
}

// Activos: balance deudor (debit - credit)
// Pasivos/Patrimonio: balance acreedor (credit - debit) → invertimos el signo
function getSection(map: Map<string, AccountBalance>, prefix: string, invert = false): AccountBalance[] {
  return Array.from(map.values())
    .filter(a => a.code.startsWith(prefix))
    .map(a => ({ ...a, balance: invert ? r2(-a.balance) : r2(a.balance) }))
    .filter(a => a.balance !== 0)
    .sort((a, b) => a.code.localeCompare(b.code));
}

export default async function BalanceGeneralPage({
  searchParams: searchParamsPromise,
}: { searchParams: Promise<{ to?: string }> }) {
  await assertPermission("/erp/contabilidad");
  const searchParams = await searchParamsPromise;
  const now = new Date();
  const toDate = searchParams.to ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const supabase = createAdminClient();
  const { data: rawLines } = await supabase
    .from("journal_lines")
    .select("account_code, account_name, debit, credit, journal_entries!inner(entry_date, status)")
    .lte("journal_entries.entry_date", toDate)
    .eq("journal_entries.status", "posted");

  const lines = (rawLines || []).map((l: any) => ({
    account_code: l.account_code,
    account_name: l.account_name,
    debit: Number(l.debit),
    credit: Number(l.credit),
  }));

  const byCode = groupByCode(lines);

  // Grupos contables
  const activos      = getSection(byCode, "1");
  const pasivos      = getSection(byCode, "2", true);
  const patrimonio   = getSection(byCode, "3", true);

  // También incluimos utilidad del ejercicio (cuentas 4 - cuentas 5)
  const ingresos  = getSection(byCode, "4", true);
  const gastos    = getSection(byCode, "5");
  const utilidadNeta = r2(ingresos.reduce((s, a) => s + a.balance, 0) - gastos.reduce((s, a) => s + a.balance, 0));

  const totalActivos    = r2(activos.reduce((s, a) => s + a.balance, 0));
  const totalPasivos    = r2(pasivos.reduce((s, a) => s + a.balance, 0));
  const totalPatrimonio = r2(patrimonio.reduce((s, a) => s + a.balance, 0));
  const totalPasivosPatrimonio = r2(totalPasivos + totalPatrimonio + utilidadNeta);

  const cuadre = r2(totalActivos - totalPasivosPatrimonio);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/erp/contabilidad"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
            <Scale className="text-lilac-600" /> Balance General
          </h1>
          <p className="text-sm text-ink-500">Estado de situación financiera acumulado hasta la fecha indicada.</p>
        </div>
        <form method="get" className="flex items-center gap-2">
          <label className="text-xs text-ink-500 font-medium">Hasta:</label>
          <input type="date" name="to" defaultValue={toDate}
            className="border border-lilac-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white" />
          <button type="submit"
            className="bg-lilac-600 hover:bg-lilac-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
            Ver
          </button>
        </form>
      </div>

      {Math.abs(cuadre) > 0.01 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          ⚠ El balance no cuadra (diferencia: ${cuadre.toFixed(2)}). Puede haber asientos incompletos.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* ACTIVOS */}
        <div className="space-y-4">
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-blue-600 px-5 py-3">
              <h2 className="font-bold text-white">ACTIVOS</h2>
            </div>
            <div className="p-4 space-y-1">
              {activos.length === 0 && <p className="text-sm text-ink-400 text-center py-4">Sin datos</p>}
              {activos.map(a => (
                <div key={a.code} className="flex justify-between items-center py-1 border-b border-lilac-50 last:border-0">
                  <div>
                    <span className="text-xs text-ink-400 font-mono mr-2">{a.code}</span>
                    <span className="text-sm text-ink-800">{a.name}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-ink-900">${fmt(a.balance)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-blue-100 bg-blue-50 px-5 py-3 flex justify-between items-center">
              <span className="font-bold text-blue-800">TOTAL ACTIVOS</span>
              <span className="font-bold text-blue-800 tabular-nums text-lg">${fmt(totalActivos)}</span>
            </div>
          </div>
        </div>

        {/* PASIVOS + PATRIMONIO */}
        <div className="space-y-4">
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-red-600 px-5 py-3">
              <h2 className="font-bold text-white">PASIVOS</h2>
            </div>
            <div className="p-4 space-y-1">
              {pasivos.length === 0 && <p className="text-sm text-ink-400 text-center py-4">Sin datos</p>}
              {pasivos.map(a => (
                <div key={a.code} className="flex justify-between items-center py-1 border-b border-lilac-50 last:border-0">
                  <div>
                    <span className="text-xs text-ink-400 font-mono mr-2">{a.code}</span>
                    <span className="text-sm text-ink-800">{a.name}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-ink-900">${fmt(a.balance)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-red-100 bg-red-50 px-5 py-3 flex justify-between">
              <span className="font-bold text-red-800">TOTAL PASIVOS</span>
              <span className="font-bold text-red-800 tabular-nums">${fmt(totalPasivos)}</span>
            </div>
          </div>

          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-green-700 px-5 py-3">
              <h2 className="font-bold text-white">PATRIMONIO</h2>
            </div>
            <div className="p-4 space-y-1">
              {patrimonio.map(a => (
                <div key={a.code} className="flex justify-between items-center py-1 border-b border-lilac-50 last:border-0">
                  <div>
                    <span className="text-xs text-ink-400 font-mono mr-2">{a.code}</span>
                    <span className="text-sm text-ink-800">{a.name}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-ink-900">${fmt(a.balance)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-1 border-b border-lilac-50">
                <span className="text-sm text-ink-800">Utilidad del ejercicio</span>
                <span className={`text-sm font-semibold tabular-nums ${utilidadNeta >= 0 ? "text-green-700" : "text-red-600"}`}>
                  ${fmt(utilidadNeta)}
                </span>
              </div>
            </div>
            <div className="border-t border-green-100 bg-green-50 px-5 py-3 flex justify-between">
              <span className="font-bold text-green-800">TOTAL PATRIMONIO</span>
              <span className="font-bold text-green-800 tabular-nums">${fmt(r2(totalPatrimonio + utilidadNeta))}</span>
            </div>
          </div>

          <div className={`rounded-2xl border px-5 py-4 flex justify-between items-center ${Math.abs(cuadre) <= 0.01 ? "bg-lilac-600 border-lilac-700" : "bg-amber-100 border-amber-300"}`}>
            <span className={`font-bold ${Math.abs(cuadre) <= 0.01 ? "text-white" : "text-amber-800"}`}>TOTAL PASIVOS + PATRIMONIO</span>
            <span className={`font-bold text-lg tabular-nums ${Math.abs(cuadre) <= 0.01 ? "text-white" : "text-amber-800"}`}>${fmt(totalPasivosPatrimonio)}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-ink-400 text-center mt-6">
        Balance generado desde asientos contables hasta {new Date(toDate).toLocaleDateString("es-EC")} · Sociedad obligada a llevar contabilidad
      </p>
    </div>
  );
}
