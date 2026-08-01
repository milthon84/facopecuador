import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { ArrowLeft, Lock, Unlock, Calendar, TrendingUp, TrendingDown, CheckCircle2, History, ShieldCheck, DollarSign, Calculator, Building2 } from "lucide-react";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import { executeAnnualCloseAction } from "./actions";
import ReopenAnnualModal from "./ReopenAnnualModal";
import ConfirmAnnualCloseModal from "./ConfirmAnnualCloseModal";

export const dynamic = "force-dynamic";

function fmt(n: number) {
  return n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function CierreAnualPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await assertPermission("/erp/contabilidad");
  const canEdit = await hasWritePermission("/erp/contabilidad");
  const searchParams = await searchParamsPromise;

  const now = new Date();
  const currentYear = now.getFullYear();
  const selectedYear = searchParams.year ? Number(searchParams.year) : currentYear;

  // Selector de últimos 5 años fiscales
  const availableYears = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  const from = `${selectedYear}-01-01`;
  const to   = `${selectedYear}-12-31`;

  const supabase = createAdminClient();

  // Consultar todos los años cerrados
  const { data: closedAnnualRecords } = await supabase
    .from("annual_closures")
    .select("year")
    .eq("status", "closed");
  const closedAnnualYears = new Set((closedAnnualRecords ?? []).map((a: any) => Number(a.year)));

  // Consultar estado del cierre anual del año seleccionado
  const { data: closure } = await supabase
    .from("annual_closures")
    .select("*")
    .eq("year", selectedYear)
    .single();

  // Consultar bitácora de auditoría del año
  const { data: logsData } = await supabase
    .from("annual_closure_logs")
    .select("*")
    .eq("year", selectedYear)
    .order("executed_at", { ascending: false });

  const logs = logsData ?? [];

  // Cargar todos los asientos del año para liquidación fiscal
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("*, lines:journal_lines(*)")
    .gte("entry_date", from)
    .lte("entry_date", to)
    .eq("status", "posted");

  const allEntries = entries ?? [];
  const allLines = allEntries.flatMap((e: any) => e.lines ?? []);

  // Agrupar por Ingresos (4.x) y Gastos (5.x)
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
  const grossProfit = totalIncome - totalExpenses;

  // Liquidación Fiscal Oficial Ecuador (15% Trabajadores + 25% Impuesto Renta SRI)
  let employeeProfitSharing = 0;
  let incomeTax = 0;
  let netProfit = grossProfit;

  if (grossProfit > 0) {
    employeeProfitSharing = Math.round(grossProfit * 0.15 * 100) / 100;
    const taxableProfit   = Math.round((grossProfit - employeeProfitSharing) * 100) / 100;
    incomeTax             = Math.round(taxableProfit * 0.25 * 100) / 100;
    netProfit             = Math.round((taxableProfit - incomeTax) * 100) / 100;
  }

  const isClosed = closure?.status === "closed";
  const isReopened = closure?.status === "reopened";

  return (
    <div className="max-w-5xl mx-auto space-y-5">
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
              <Building2 className="text-lilac-600" size={22} />
              Cierre Anual Fiscal y Contable de Empresas
            </h1>
            <p className="text-xs text-ink-500">Liquidación anual de impuesto a la renta, utilidades e informes oficiales SRI / SuperCias</p>
          </div>
        </div>

        {/* Selector de Año Fiscal */}
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-ink-400 shrink-0" />
          <div className="flex gap-1 overflow-x-auto">
            {availableYears.map(y => {
              const isClosed = closedAnnualYears.has(y);
              const isSelected = y === selectedYear;

              let pillStyle = "bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50";
              if (isClosed) {
                pillStyle = isSelected
                  ? "bg-orange-600 text-white font-bold ring-2 ring-orange-400 shadow-sm"
                  : "bg-orange-100 border border-orange-300 text-orange-950 hover:bg-orange-200 font-semibold";
              } else if (isSelected) {
                pillStyle = "bg-lilac-600 text-white font-bold shadow-sm";
              }

              return (
                <Link
                  key={y}
                  href={`/erp/contabilidad/cierre-anual?year=${y}`}
                  className={`shrink-0 px-3 py-1 rounded-xl text-xs transition-colors flex flex-col items-center justify-center leading-tight ${pillStyle}`}
                >
                  {isClosed && (
                    <span className={`text-[8px] font-bold tracking-tight uppercase leading-none mb-0.5 ${
                      isSelected ? "text-white opacity-90" : "text-orange-800"
                    }`}>
                      🏢 CERRADO
                    </span>
                  )}
                  <span>Año {y}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Estado del Año Fiscal */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-ink-400 uppercase tracking-wide">Estado del Ejercicio Fiscal {selectedYear}</span>
          <div className="flex items-center gap-2">
            {isClosed ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                <CheckCircle2 size={14} /> EJERCICIO FISCAL CERRADO OFICIALMENTE
              </span>
            ) : isReopened ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <Unlock size={14} /> REABIERTO PARA AJUSTES TRIBUTARIOS
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                <Calculator size={14} /> EN CURSO / ABIERTO
              </span>
            )}
          </div>

          {isClosed && closure?.closed_by_email && (
            <p className="text-xs text-ink-500 pt-1">
              Cierre anual ejecutado por: <strong>{closure.closed_by_email}</strong> el {new Date(closure.closed_at).toLocaleString("es-EC")}
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
            <ReopenAnnualModal year={selectedYear} canEdit={canEdit} />
          ) : (
            <ConfirmAnnualCloseModal
              year={selectedYear}
              isReopened={isReopened}
              canEdit={canEdit}
            />
          )}
        </div>
      </div>

      {/* Resumen de Liquidación Fiscal Ecuador */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-green-200 shadow-sm">
          <div className="text-xs text-ink-500 flex items-center gap-1 mb-1 font-medium">
            <TrendingUp size={14} className="text-green-500" /> Ingresos Totales Año
          </div>
          <div className="text-lg font-bold text-green-700">${fmt(totalIncome)}</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-red-200 shadow-sm">
          <div className="text-xs text-ink-500 flex items-center gap-1 mb-1 font-medium">
            <TrendingDown size={14} className="text-red-500" /> Gastos Totales Año
          </div>
          <div className="text-lg font-bold text-red-600">${fmt(totalExpenses)}</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
          <div className="text-xs text-ink-500 flex items-center gap-1 mb-1 font-medium">
            <Calculator size={14} className="text-amber-600" /> 15% Trabajadores
          </div>
          <div className="text-lg font-bold text-amber-700">${fmt(employeeProfitSharing)}</div>
          <p className="text-[10px] text-ink-400">Código del Trabajo (Pasivo 2.1.03.03)</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-blue-200 shadow-sm">
          <div className="text-xs text-ink-500 flex items-center gap-1 mb-1 font-medium">
            <DollarSign size={14} className="text-blue-600" /> 25% Impuesto Renta
          </div>
          <div className="text-lg font-bold text-blue-700">${fmt(incomeTax)}</div>
          <p className="text-[10px] text-ink-400">SRI Sociedades (Pasivo 2.1.02.04)</p>
        </div>
      </div>

      {/* Utilidad Neta Destino */}
      <div className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between flex-wrap gap-3 ${
        grossProfit >= 0 ? "bg-lilac-50 border-lilac-200" : "bg-red-50 border-red-200"
      }`}>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Resultado Final del Ejercicio Fiscal {selectedYear}</span>
          <h3 className={`text-2xl font-bold ${grossProfit >= 0 ? "text-lilac-800" : "text-red-700"}`}>
            {grossProfit >= 0 ? "UTILIDAD NETA DEL EJERCICIO" : "PÉRDIDA DEL EJERCICIO"}
          </h3>
          <p className="text-xs text-ink-600 pt-0.5">
            Se transfiere a la cuenta de Patrimonio <strong>3.2.02 (Utilidad / Pérdida del Ejercicio)</strong>
          </p>
        </div>
        <div className="text-right">
          <span className={`text-3xl font-extrabold ${grossProfit >= 0 ? "text-lilac-700" : "text-red-600"}`}>
            ${fmt(Math.abs(netProfit))}
          </span>
        </div>
      </div>

      {/* Vista Previa del Asiento Contable Anual */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-lilac-50 bg-lilac-50/30 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm text-ink-800">
              {isClosed ? "Asiento Contable de Cierre Anual Registrado" : "Vista Previa del Asiento de Cierre Anual (Cuentas a Cero NIIF)"}
            </h2>
            <p className="text-xs text-ink-400">Cancela ingresos/gastos anuales, aprovisiona impuestos/trabajadores y acredita utilidad a Patrimonio</p>
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
              {/* Cuentas de Ingreso (Débito) */}
              {incomeLines.map(inc => (
                <tr key={`inc-${inc.code}`} className="hover:bg-lilac-50/20">
                  <td className="px-4 py-2 font-mono text-ink-400">{inc.code}</td>
                  <td className="px-4 py-2 text-ink-800 font-medium">{inc.name} (Cancelación Anual)</td>
                  <td className="px-4 py-2 text-right font-semibold text-green-700">${fmt(inc.amount)}</td>
                  <td className="px-4 py-2 text-right text-ink-300">$0.00</td>
                </tr>
              ))}

              {/* Pérdida si aplica */}
              {grossProfit < 0 && (
                <tr className="bg-red-50/40 font-semibold">
                  <td className="px-4 py-2 font-mono text-red-700">3.2.02</td>
                  <td className="px-4 py-2 text-red-800">Utilidad / Pérdida del Ejercicio (Pérdida Neta)</td>
                  <td className="px-4 py-2 text-right text-red-700">${fmt(Math.abs(grossProfit))}</td>
                  <td className="px-4 py-2 text-right text-ink-300">$0.00</td>
                </tr>
              )}

              {/* Cuentas de Gasto (Crédito) */}
              {expenseLines.map(exp => (
                <tr key={`exp-${exp.code}`} className="hover:bg-lilac-50/20">
                  <td className="px-4 py-2 font-mono text-ink-400">{exp.code}</td>
                  <td className="px-4 py-2 text-ink-700 pl-6">{exp.name} (Cancelación Anual)</td>
                  <td className="px-4 py-2 text-right text-ink-300">$0.00</td>
                  <td className="px-4 py-2 text-right font-semibold text-red-600">${fmt(exp.amount)}</td>
                </tr>
              ))}

              {/* Pasivo 15% Trabajadores si aplica */}
              {employeeProfitSharing > 0 && (
                <tr className="bg-amber-50/50 font-semibold">
                  <td className="px-4 py-2 font-mono text-amber-800">2.1.03.03</td>
                  <td className="px-4 py-2 text-amber-900 pl-6">15% Participación Trabajadores por Pagar (Código del Trabajo)</td>
                  <td className="px-4 py-2 text-right text-ink-300">$0.00</td>
                  <td className="px-4 py-2 text-right text-amber-800">${fmt(employeeProfitSharing)}</td>
                </tr>
              )}

              {/* Pasivo 25% Impuesto Renta si aplica */}
              {incomeTax > 0 && (
                <tr className="bg-blue-50/50 font-semibold">
                  <td className="px-4 py-2 font-mono text-blue-800">2.1.02.04</td>
                  <td className="px-4 py-2 text-blue-900 pl-6">25% Impuesto a la Renta por Pagar (SRI Sociedades)</td>
                  <td className="px-4 py-2 text-right text-ink-300">$0.00</td>
                  <td className="px-4 py-2 text-right text-blue-800">${fmt(incomeTax)}</td>
                </tr>
              )}

              {/* Utilidad Neta a Patrimonio si aplica */}
              {netProfit > 0 && (
                <tr className="bg-lilac-50/60 font-semibold">
                  <td className="px-4 py-2 font-mono text-lilac-700">3.2.02</td>
                  <td className="px-4 py-2 text-lilac-900 pl-6">Utilidad / Pérdida del Ejercicio (Utilidad Neta del Año)</td>
                  <td className="px-4 py-2 text-right text-ink-300">$0.00</td>
                  <td className="px-4 py-2 text-right text-lilac-700">${fmt(netProfit)}</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-lilac-100/60 font-bold text-ink-900 border-t border-lilac-200">
              <tr>
                <td colSpan={2} className="px-4 py-2 text-left">TOTALES ASENTO DE CIERRE ANUAL</td>
                <td className="px-4 py-2 text-right text-green-700">
                  ${fmt(totalIncome + (grossProfit < 0 ? Math.abs(grossProfit) : 0))}
                </td>
                <td className="px-4 py-2 text-right text-red-600">
                  ${fmt(totalExpenses + (grossProfit > 0 ? (employeeProfitSharing + incomeTax + netProfit) : 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Bitácora de Auditoría Anual */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2 text-ink-800 font-bold text-sm border-b border-lilac-50 pb-3">
          <History size={18} className="text-lilac-600" />
          <span>Bitácora de Auditoría — Historial de Cierres Anuales</span>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-ink-400 py-4 text-center">No hay registros de auditoría anual para el ejercicio {selectedYear}.</p>
        ) : (
          <div className="space-y-3 pt-1">
            {logs.map((l: any) => (
              <div key={l.id} className="border border-lilac-100 rounded-xl p-3.5 bg-lilac-50/20 text-xs space-y-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {l.action === "close" ? (
                      <span className="px-2 py-0.5 rounded-md font-bold bg-green-100 text-green-800 text-[10px]">
                        CIERRE ANUAL
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md font-bold bg-amber-100 text-amber-900 text-[10px]">
                        REAPERTURA ANUAL
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

                <div className="text-[11px] text-ink-500 pt-1 flex gap-4 flex-wrap">
                  <span>Ingresos: ${fmt(Number(l.total_income))}</span>
                  <span>Gastos: ${fmt(Number(l.total_expenses))}</span>
                  <span>15% Trab: ${fmt(Number(l.employee_profit_sharing))}</span>
                  <span>25% IR: ${fmt(Number(l.income_tax))}</span>
                  <span>Utilidad Neta: ${fmt(Number(l.net_profit))}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
