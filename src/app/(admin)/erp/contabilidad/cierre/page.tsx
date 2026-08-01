import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { ArrowLeft, Lock, Unlock, Calendar, TrendingUp, TrendingDown, CheckCircle2, History, AlertCircle, PlayCircle, ShieldCheck } from "lucide-react";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import { executeMonthlyCloseAction } from "./actions";
import ReopenPeriodModal from "./ReopenPeriodModal";
import ConfirmMonthlyCloseModal from "./ConfirmMonthlyCloseModal";

export const dynamic = "force-dynamic";

function fmt(n: number) {
  return n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function periodLabel(period: string) {
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-EC", { month: "long", year: "numeric" });
}

export default async function CierreContablePage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await assertPermission("/erp/contabilidad");
  const canEdit = await hasWritePermission("/erp/contabilidad");
  const searchParams = await searchParamsPromise;

  const now = new Date();
  const period = searchParams.period ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [year, month] = period.split("-").map(Number);
  const from = new Date(year, month - 1, 1).toISOString().split("T")[0];
  const to   = new Date(year, month, 0).toISOString().split("T")[0];

  // Selector de últimos 12 meses
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const supabase = createAdminClient();

  // Consultar cierres mensuales y cierres anuales
  const [{ data: monthlyRecords }, { data: annualRecords }] = await Promise.all([
    supabase.from("monthly_closures").select("period").eq("status", "closed"),
    supabase.from("annual_closures").select("year").eq("status", "closed"),
  ]);

  const monthlyClosedSet = new Set((monthlyRecords ?? []).map((c: any) => c.period));
  const annualClosedYears = new Set((annualRecords ?? []).map((a: any) => Number(a.year)));

  // Consultar estado de cierre de este período
  const { data: closure } = await supabase
    .from("monthly_closures")
    .select("*")
    .eq("period", period)
    .single();

  // Consultar bitácora de auditoría de este período
  const { data: logsData } = await supabase
    .from("monthly_closure_logs")
    .select("*")
    .eq("period", period)
    .order("executed_at", { ascending: false });

  const logs = logsData ?? [];

  // Cargar asientos del período para resumen contable
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("*, lines:journal_lines(*)")
    .gte("entry_date", from)
    .lte("entry_date", to)
    .eq("status", "posted");

  const allEntries = entries ?? [];
  const allLines = allEntries.flatMap((e: any) => e.lines ?? []);

  // Ingresos (4.x) y Gastos (5.x)
  const incomeMap: Record<string, { code: string; name: string; amount: number }> = {};
  const expenseMap: Record<string, { code: string; name: string; amount: number }> = {};

  for (const l of allLines) {
    if (l.account_code.startsWith("4.")) {
      if (!incomeMap[l.account_code]) {
        incomeMap[l.account_code] = { code: l.account_code, name: l.account_name, amount: 0 };
      }
      incomeMap[l.account_code].amount += Number(l.credit) - Number(l.debit);
    } else if (l.account_code.startsWith("5.")) {
      if (!expenseMap[l.account_code]) {
        expenseMap[l.account_code] = { code: l.account_code, name: l.account_name, amount: 0 };
      }
      expenseMap[l.account_code].amount += Number(l.debit) - Number(l.credit);
    }
  }

  const incomeLines = Object.values(incomeMap).filter(i => i.amount > 0);
  const expenseLines = Object.values(expenseMap).filter(e => e.amount > 0);

  const totalIncome = incomeLines.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = expenseLines.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  const isClosed = closure?.status === "closed";
  const isReopened = closure?.status === "reopened";

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/erp/contabilidad"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-ink-900 flex items-center gap-2">
              <Lock className="text-lilac-600" size={20} />
              Cierre Mensual Contable
            </h1>
            <p className="text-xs text-ink-500 capitalize">{periodLabel(period)}</p>
          </div>
        </div>

        {/* Selector de período */}
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-ink-400 shrink-0" />
          <div className="flex gap-1 overflow-x-auto">
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
                pillStyle = "bg-lilac-600 text-white font-medium";
              }

              return (
                <Link
                  key={m}
                  href={`/erp/contabilidad/cierre?period=${m}`}
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
      </div>

      {/* Estado del Período */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-ink-400 uppercase tracking-wide">Estado del Período</span>
          <div className="flex items-center gap-2">
            {isClosed ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                <CheckCircle2 size={14} /> CERRADO OFICIALMENTE
              </span>
            ) : isReopened ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <Unlock size={14} /> REABIERTO PARA CORRECCIÓN
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                <PlayCircle size={14} /> EN CURSO / ABIERTO
              </span>
            )}
          </div>

          {isClosed && closure?.closed_by_email && (
            <p className="text-xs text-ink-500 pt-1">
              Cerrado por: <strong>{closure.closed_by_email}</strong> el {new Date(closure.closed_at).toLocaleString("es-EC")}
            </p>
          )}

          {isReopened && closure?.reopened_by_email && (
            <p className="text-xs text-amber-700 pt-1">
              Reabierto por: <strong>{closure.reopened_by_email}</strong>. Motivo: <em>"{closure.reopen_reason}"</em>
            </p>
          )}
        </div>

        {/* Acciones */}
        <div>
          {isClosed ? (
            <ReopenPeriodModal period={period} canEdit={canEdit} />
          ) : (
            <ConfirmMonthlyCloseModal
              period={period}
              periodLabelStr={periodLabel(period)}
              isReopened={isReopened}
              canEdit={canEdit}
            />
          )}
        </div>
      </div>

      {/* Resumen de Montos del Mes */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 border border-green-200 shadow-sm">
          <div className="text-xs text-ink-500 flex items-center gap-1 mb-1 font-medium">
            <TrendingUp size={14} className="text-green-500" /> Total Ingresos
          </div>
          <div className="text-xl font-bold text-green-700">${fmt(totalIncome)}</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-red-200 shadow-sm">
          <div className="text-xs text-ink-500 flex items-center gap-1 mb-1 font-medium">
            <TrendingDown size={14} className="text-red-500" /> Total Gastos
          </div>
          <div className="text-xl font-bold text-red-600">${fmt(totalExpenses)}</div>
        </div>

        <div className={`bg-white rounded-xl p-4 border shadow-sm ${netProfit >= 0 ? "border-lilac-200" : "border-red-200"}`}>
          <div className="text-xs text-ink-500 mb-1 font-medium">
            {netProfit >= 0 ? "Utilidad Neta" : "Pérdida Neta"}
          </div>
          <div className={`text-xl font-bold ${netProfit >= 0 ? "text-lilac-700" : "text-red-600"}`}>
            ${fmt(Math.abs(netProfit))}
          </div>
        </div>
      </div>

      {/* Vista Previa del Asiento de Cierre */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-lilac-50 bg-lilac-50/30 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm text-ink-800">
              {isClosed ? "Asiento Contable de Cierre Registrado" : "Vista Previa del Asiento de Cierre (Doble Partida NIIF)"}
            </h2>
            <p className="text-xs text-ink-400">Cancela ingresos/gastos y acredita la Utilidad en cuenta 3.2.02</p>
          </div>
          <ShieldCheck size={18} className="text-lilac-600 shrink-0" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-lilac-50/50 text-ink-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left w-24">Código</th>
                <th className="px-4 py-2 text-left">Cuenta Contable</th>
                <th className="px-4 py-2 text-right w-28">Débito</th>
                <th className="px-4 py-2 text-right w-28">Crédito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lilac-50">
              {/* Líneas de Ingreso (Débito) */}
              {incomeLines.map(inc => (
                <tr key={`inc-${inc.code}`} className="hover:bg-lilac-50/20">
                  <td className="px-4 py-2 font-mono text-ink-400">{inc.code}</td>
                  <td className="px-4 py-2 text-ink-800 font-medium">{inc.name} (Cancelación de Ingreso)</td>
                  <td className="px-4 py-2 text-right font-semibold text-green-700">${fmt(inc.amount)}</td>
                  <td className="px-4 py-2 text-right text-ink-300">$0.00</td>
                </tr>
              ))}

              {/* Pérdida si aplica */}
              {netProfit < 0 && (
                <tr className="bg-red-50/40 font-semibold">
                  <td className="px-4 py-2 font-mono text-red-700">3.2.02</td>
                  <td className="px-4 py-2 text-red-800">Utilidad / Pérdida del Ejercicio (Pérdida Neta)</td>
                  <td className="px-4 py-2 text-right text-red-700">${fmt(Math.abs(netProfit))}</td>
                  <td className="px-4 py-2 text-right text-ink-300">$0.00</td>
                </tr>
              )}

              {/* Líneas de Gasto (Crédito) */}
              {expenseLines.map(exp => (
                <tr key={`exp-${exp.code}`} className="hover:bg-lilac-50/20">
                  <td className="px-4 py-2 font-mono text-ink-400">{exp.code}</td>
                  <td className="px-4 py-2 text-ink-700 pl-6">{exp.name} (Cancelación de Gasto)</td>
                  <td className="px-4 py-2 text-right text-ink-300">$0.00</td>
                  <td className="px-4 py-2 text-right font-semibold text-red-600">${fmt(exp.amount)}</td>
                </tr>
              ))}

              {/* Utilidad si aplica */}
              {netProfit > 0 && (
                <tr className="bg-lilac-50/60 font-semibold">
                  <td className="px-4 py-2 font-mono text-lilac-700">3.2.02</td>
                  <td className="px-4 py-2 text-lilac-900 pl-6">Utilidad / Pérdida del Ejercicio (Utilidad Neta)</td>
                  <td className="px-4 py-2 text-right text-ink-300">$0.00</td>
                  <td className="px-4 py-2 text-right text-lilac-700">${fmt(netProfit)}</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-lilac-100/60 font-bold text-ink-900 border-t border-lilac-200">
              <tr>
                <td colSpan={2} className="px-4 py-2 text-left">TOTALES ASENTO DE CIERRE</td>
                <td className="px-4 py-2 text-right text-green-700">
                  ${fmt(totalIncome + (netProfit < 0 ? Math.abs(netProfit) : 0))}
                </td>
                <td className="px-4 py-2 text-right text-red-600">
                  ${fmt(totalExpenses + (netProfit > 0 ? netProfit : 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Bitácora de Auditoría del Período */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2 text-ink-800 font-bold text-sm border-b border-lilac-50 pb-3">
          <History size={18} className="text-lilac-600" />
          <span>Bitácora de Auditoría — Historial de Cierres y Reaperturas</span>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-ink-400 py-4 text-center">No hay registros de eventos para este período aún.</p>
        ) : (
          <div className="space-y-3 pt-1">
            {logs.map((l: any) => (
              <div key={l.id} className="border border-lilac-100 rounded-xl p-3.5 bg-lilac-50/20 text-xs space-y-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {l.action === "close" ? (
                      <span className="px-2 py-0.5 rounded-md font-bold bg-green-100 text-green-800 text-[10px]">
                        CIERRE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md font-bold bg-amber-100 text-amber-900 text-[10px]">
                        REAPERTURA
                      </span>
                    )}
                    <span className="font-semibold text-ink-800">{l.executed_by_email || "Usuario"}</span>
                  </div>
                  <span className="text-[11px] text-ink-400 font-mono">
                    {new Date(l.executed_at).toLocaleString("es-EC")}
                  </span>
                </div>

                {l.reason && (
                  <p className="text-ink-700 pt-1">
                    <strong>Motivo / Justificación:</strong> <em>"{l.reason}"</em>
                  </p>
                )}

                <div className="text-[11px] text-ink-500 pt-1 flex gap-4">
                  <span>Ingresos: ${fmt(Number(l.total_income))}</span>
                  <span>Gastos: ${fmt(Number(l.total_expenses))}</span>
                  <span>Utilidad: ${fmt(Number(l.net_profit))}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
