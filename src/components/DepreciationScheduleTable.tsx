"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, FileText, ArrowRight, BookOpen, Loader2 } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { registerSingleDepreciationAction } from "@/app/(admin)/erp/activos/actions";
import { formatAsientoCode } from "@/lib/accounting-codes";

export type JournalLine = {
  id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  description?: string | null;
};

export type JournalEntryInfo = {
  id: string;
  entry_number?: number | null;
  entry_code?: string | null;
  entry_date: string;
  description: string;
  lines: JournalLine[];
};

export type DepreciationScheduleRow = {
  period: string;
  monthly_amount: number;
  accumulated: number;
  book_value: number;
};

export type DepreciationRegisteredData = {
  id?: string;
  period: string;
  monthly_amount: number;
  accumulated: number;
  book_value: number;
  journal_entry_id?: string | null;
  journal_entry?: JournalEntryInfo | null;
};

interface Props {
  assetId: string;
  assetName: string;
  assetCode?: string | null;
  usefulLifeYears: number;
  schedule: DepreciationScheduleRow[];
  registeredMap: Record<string, DepreciationRegisteredData>;
  currentPeriod: string;
  canEdit: boolean;
}

export default function DepreciationScheduleTable({
  assetId,
  assetName,
  assetCode,
  usefulLifeYears,
  schedule,
  registeredMap,
  currentPeriod,
  canEdit,
}: Props) {
  const [selectedEntry, setSelectedEntry] = useState<{
    period: string;
    monthly_amount: number;
    entry?: JournalEntryInfo | null;
  } | null>(null);

  const [registeringPeriod, setRegisteringPeriod] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRegister = (row: DepreciationScheduleRow) => {
    setRegisteringPeriod(row.period);
    startTransition(async () => {
      try {
        await registerSingleDepreciationAction({
          asset_id: assetId,
          period: row.period,
          monthly_amount: row.monthly_amount,
          accumulated: row.accumulated,
          book_value: row.book_value,
        });
      } catch (err: any) {
        alert(err?.message || "Error al registrar la depreciación.");
      } finally {
        setRegisteringPeriod(null);
      }
    });
  };

  const activeEntry = selectedEntry?.entry;
  const activeLines = activeEntry?.lines || [];
  const totalDebit = activeLines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = activeLines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const entryCodeDisplay = activeEntry
    ? activeEntry.entry_code || formatAsientoCode(activeEntry.entry_number, activeEntry.entry_date, "diario")
    : null;

  return (
    <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="px-5 py-4 border-b border-lilac-50 flex items-center justify-between">
        <h2 className="font-semibold text-ink-900 flex items-center gap-2">
          <BookOpen size={16} className="text-lilac-600" />
          Tabla de depreciación
        </h2>
        <span className="text-xs text-ink-400">
          {schedule.length} períodos · {usefulLifeYears} años
        </span>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-lilac-50/50 text-xs text-ink-500 uppercase font-semibold sticky top-0 z-10 backdrop-blur-xs">
            <tr>
              <th className="px-4 py-2.5 text-left">Período</th>
              <th className="px-4 py-2.5 text-right">Cuota mensual</th>
              <th className="px-4 py-2.5 text-right">Dep. acumulada</th>
              <th className="px-4 py-2.5 text-right">Valor en libros</th>
              <th className="px-4 py-2.5 text-center">Estado</th>
              <th className="px-4 py-2.5 text-center">Asiento Contable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-lilac-50">
            {schedule.map((row) => {
              const regData = registeredMap[row.period];
              const isRegistered = Boolean(regData);
              const isFuture = row.period > currentPeriod;
              const isCurrent = row.period === currentPeriod;
              const isRowPending = registeringPeriod === row.period && isPending;

              const entry = regData?.journal_entry;
              const entryCode = entry
                ? entry.entry_code || formatAsientoCode(entry.entry_number, entry.entry_date, "diario")
                : null;

              return (
                <tr
                  key={row.period}
                  className={`transition-colors ${isCurrent ? "bg-lilac-50/40" : "hover:bg-lilac-50/20"}`}
                >
                  <td className="px-4 py-2 font-mono text-sm whitespace-nowrap">
                    {row.period}
                    {isCurrent && (
                      <span className="ml-2 text-[10px] bg-lilac-100 text-lilac-700 px-1.5 py-0.5 rounded-full font-sans">
                        actual
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-medium">${row.monthly_amount.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-mono text-ink-600">${row.accumulated.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-bold font-mono text-green-700">
                    ${row.book_value.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-center whitespace-nowrap">
                    {isRegistered ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                        <CheckCircle2 size={10} /> Registrado
                      </span>
                    ) : isFuture ? (
                      <span className="text-[10px] text-ink-300">Futuro</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                        <Clock size={10} /> Pendiente
                      </span>
                    )}
                  </td>

                  {/* Asiento Contable / Acciones */}
                  <td className="px-4 py-2 text-center whitespace-nowrap">
                    {isRegistered ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedEntry({
                            period: row.period,
                            monthly_amount: row.monthly_amount,
                            entry: entry || null,
                          })
                        }
                        className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-lg transition-all hover:scale-[1.02] shadow-2xs cursor-pointer"
                        title="Ver asiento contable generado en el Libro Diario"
                      >
                        <FileText size={12} className="text-purple-600" />
                        <span>{entryCode || "Ver Asiento"}</span>
                        <ArrowRight size={11} className="text-purple-500 opacity-70" />
                      </button>
                    ) : !isFuture && canEdit ? (
                      <button
                        type="button"
                        onClick={() => handleRegister(row)}
                        disabled={isRowPending}
                        className="inline-flex items-center gap-1 text-xs text-lilac-600 hover:text-lilac-800 border border-lilac-200 hover:bg-lilac-50 px-2.5 py-1 rounded-lg transition-colors font-medium disabled:opacity-50 cursor-pointer"
                      >
                        {isRowPending ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Registrando...</span>
                          </>
                        ) : (
                          "Registrar"
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-ink-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal para visualizar el Asiento Contable */}
      <StandardModal
        isOpen={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        title={
          entryCodeDisplay
            ? `Asiento Contable: ${entryCodeDisplay}`
            : `Asiento de Depreciación — ${selectedEntry?.period || ""}`
        }
        subtitle={`Comprobante contable de depreciación correspondiente al activo: ${assetCode ? `[${assetCode}] ` : ""}${assetName}`}
        icon={<FileText size={20} className="text-purple-600" />}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {/* Ficha Resumen del Asiento */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-ink-400">Tipo de Comprobante:</span>
                <span className="ml-1.5 font-semibold text-purple-900 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                  Depreciación Mensual NIIF
                </span>
              </div>
              <div>
                <span className="text-ink-400">Período:</span>
                <span className="ml-1.5 font-bold font-mono text-ink-900">{selectedEntry?.period}</span>
              </div>
              {activeEntry?.entry_date && (
                <div>
                  <span className="text-ink-400">Fecha de Registro:</span>
                  <span className="ml-1.5 font-mono text-ink-800">{activeEntry.entry_date}</span>
                </div>
              )}
            </div>

            <div className="text-xs pt-1 border-t border-slate-200/60">
              <span className="text-ink-400">Concepto / Glosa:</span>
              <p className="font-medium text-ink-900 mt-0.5">
                {activeEntry?.description ||
                  `Depreciación ${selectedEntry?.period} — ${assetCode ? `[${assetCode}] ` : ""}${assetName}`}
              </p>
            </div>
          </div>

          {/* Tabla de Movimientos Debe / Haber */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-100/70 px-3 py-2 border-b border-slate-200 text-xs font-bold text-ink-700">
              Cuentas y Partida Doble
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-ink-500 uppercase border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-3.5 py-2 text-left">Código y Cuenta Contable</th>
                    <th className="px-3 py-2 text-left">Detalle / Referencia</th>
                    <th className="px-3.5 py-2 text-right">Debe</th>
                    <th className="px-3.5 py-2 text-right">Haber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeLines.length > 0 ? (
                    activeLines.map((line) => {
                      const debit = Number(line.debit || 0);
                      const credit = Number(line.credit || 0);
                      return (
                        <tr key={line.id} className="hover:bg-slate-50/50">
                          <td className="px-3.5 py-2.5">
                            <div className="font-mono font-bold text-purple-900 text-xs">
                              {line.account_code}
                            </div>
                            <div className="text-[11px] text-ink-600 font-medium">
                              {line.account_name}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-ink-500 text-[11px]">
                            {line.description || `Depreciación ${selectedEntry?.period}`}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-xs">
                            {debit > 0 ? (
                              <span className="text-ink-900">${debit.toFixed(2)}</span>
                            ) : (
                              <span className="text-ink-300 font-normal">—</span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-xs">
                            {credit > 0 ? (
                              <span className="text-purple-800">${credit.toFixed(2)}</span>
                            ) : (
                              <span className="text-ink-300 font-normal">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <>
                      {/* Fallback ilustrativo si las líneas aún no se habían indexado */}
                      <tr className="hover:bg-slate-50/50">
                        <td className="px-3.5 py-2.5">
                          <div className="font-mono font-bold text-purple-900 text-xs">5.2.08</div>
                          <div className="text-[11px] text-ink-600 font-medium">Depreciaciones (Gasto)</div>
                        </td>
                        <td className="px-3 py-2.5 text-ink-500 text-[11px]">
                          Cuota mensual {selectedEntry?.period}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-xs text-ink-900">
                          ${(selectedEntry?.monthly_amount || 0).toFixed(2)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-ink-300 font-normal text-xs">—</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="px-3.5 py-2.5">
                          <div className="font-mono font-bold text-purple-900 text-xs">1.2.02</div>
                          <div className="text-[11px] text-ink-600 font-medium">Depreciación Acumulada</div>
                        </td>
                        <td className="px-3 py-2.5 text-ink-500 text-[11px]">
                          Acumulación {selectedEntry?.period}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-ink-300 font-normal text-xs">—</td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-xs text-purple-800">
                          ${(selectedEntry?.monthly_amount || 0).toFixed(2)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold font-mono text-xs">
                  <tr>
                    <td colSpan={2} className="px-3.5 py-2 text-ink-800 font-sans text-xs">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-green-600" />
                        <span>Partida Doble Cuadrada</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2 text-right text-ink-900">
                      ${(activeLines.length > 0 ? totalDebit : selectedEntry?.monthly_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-3.5 py-2 text-right text-purple-900">
                      ${(activeLines.length > 0 ? totalCredit : selectedEntry?.monthly_amount || 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Botones y Enlace al Libro Diario */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {selectedEntry?.period ? (
              <Link
                href={`/erp/contabilidad?period=${selectedEntry.period}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-xs text-lilac-700 hover:text-lilac-900 font-semibold hover:underline"
              >
                <BookOpen size={13} className="text-lilac-600" />
                <span>Ver este mes en el Libro Diario Contable Completo ↗</span>
              </Link>
            ) : <div />}

            <button
              type="button"
              onClick={() => setSelectedEntry(null)}
              className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-ink-800 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </StandardModal>
    </div>
  );
}
