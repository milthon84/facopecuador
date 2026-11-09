"use client";

import { useState } from "react";
import { Eye, Scale, CheckCircle2, X } from "lucide-react";
import { JournalEntryItem } from "./AsientoContableGastoCard";

interface Props {
  entries: JournalEntryItem[];
  expenseTotal?: number;
}

export default function AsientoContableModal({ entries }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  if (!entries || entries.length === 0) return null;

  return (
    <>
      {/* Botón compacto con el ojo para abrir el popup */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-lilac-300 hover:bg-lilac-50 text-lilac-900 text-xs font-bold transition shadow-xs hover:border-lilac-400 active:scale-[0.98]"
        title="Ver Asiento Contable Completo"
      >
        <Eye size={15} className="text-lilac-600" />
        <span>Ver Asiento Contable</span>
        <span className="text-[10px] bg-lilac-100 text-lilac-800 border border-lilac-200 px-1.5 py-0.2 rounded-full font-bold font-mono">
          {entries.length === 1 ? "1" : "2"}
        </span>
      </button>

      {/* Modal Popup centrado */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-lilac-200 overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <div className="px-5 py-4 bg-gradient-to-r from-lilac-50 via-white to-purple-50/50 border-b border-lilac-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-lilac-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Scale size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-ink-900 uppercase tracking-wide">
                      Asiento Contable Completo (Libro Diario NIIF)
                    </h2>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 size={11} className="text-emerald-600" />
                      {entries.length === 1 ? "1 Asiento (Causación)" : "2 Asientos (Causación y Pago)"}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-500 mt-0.5">
                    Causación a Cuentas por Pagar Proveedores (2.1.01.01){entries.length > 1 ? " y Cruce de Pago con Banco/Caja" : ""}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-xl bg-white border border-lilac-200 text-ink-400 hover:text-ink-800 hover:bg-lilac-50 flex items-center justify-center transition shadow-2xs"
                title="Cerrar ventana"
              >
                <X size={16} />
              </button>
            </div>

            {/* Contenido con Scroll */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {entries.map((entry, entryIdx) => {
                const isPaymentEntry =
                  entry.description.toLowerCase().includes("pago") ||
                  entry.description.toLowerCase().includes("cruce") ||
                  entry.journal_lines.some(
                    (l) => l.account_code === "1.1.01.03" || l.account_code === "1.1.01.02"
                  );

                const totalDebit = entry.journal_lines.reduce((s, l) => s + Number(l.debit || 0), 0);
                const totalCredit = entry.journal_lines.reduce((s, l) => s + Number(l.credit || 0), 0);
                const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

                return (
                  <div
                    key={entry.id || entryIdx}
                    className="border border-lilac-200 rounded-xl overflow-hidden shadow-2xs"
                  >
                    {/* Cabecera de Asiento */}
                    <div className="px-4 py-2.5 bg-lilac-50/70 border-b border-lilac-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-lilac-700 text-white flex items-center justify-center font-bold text-[10px]">
                          {entryIdx + 1}
                        </span>
                        <strong className="font-bold text-ink-900">
                          {isPaymentEntry ? "Asiento 2: Cruce y Pago a Proveedores" : "Asiento 1: Causación del Gasto (Devengo)"}
                        </strong>
                        <span className="text-ink-400">·</span>
                        <span className="text-ink-600 font-medium">
                          Fecha: {new Date(entry.entry_date + "T12:00:00").toLocaleDateString("es-EC")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-ink-500 font-mono italic truncate max-w-xs" title={entry.description}>
                          {entry.description}
                        </span>
                        {isBalanced && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Cuadrado
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tabla de Cuentas */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-white border-b border-lilac-100 text-[10px] font-bold uppercase text-ink-500 tracking-wider">
                            <th className="py-2 px-3 text-left w-24">Código</th>
                            <th className="py-2 px-3 text-left">Cuenta Contable</th>
                            <th className="py-2 px-3 text-left">Glosa / Referencia</th>
                            <th className="py-2 px-3 text-right w-24 sm:w-28">Debe (Débito)</th>
                            <th className="py-2 px-3 text-right w-24 sm:w-28">Haber (Crédito)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-lilac-50">
                          {entry.journal_lines.map((line, lineIdx) => {
                            const debitVal = Number(line.debit || 0);
                            const creditVal = Number(line.credit || 0);
                            const isCreditLine = creditVal > 0 && debitVal === 0;

                            return (
                              <tr key={line.id || lineIdx} className="hover:bg-lilac-50/20">
                                <td className="py-2 px-3 font-mono font-semibold text-lilac-900 whitespace-nowrap">
                                  {line.account_code}
                                </td>
                                <td className="py-2 px-3 font-medium text-ink-900">
                                  <span className={isCreditLine ? "pl-4 inline-block text-ink-700" : "font-semibold"}>
                                    {isCreditLine ? "↳ " : ""}{line.account_name}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-ink-500 text-[11px] truncate max-w-xs">
                                  {line.description || "—"}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-semibold text-ink-900">
                                  {debitVal > 0 ? `$${debitVal.toFixed(2)}` : "—"}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-semibold text-ink-900">
                                  {creditVal > 0 ? `$${creditVal.toFixed(2)}` : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-lilac-50/70 border-t border-lilac-200 font-bold text-xs">
                            <td colSpan={3} className="py-2 px-3 text-right text-ink-700 uppercase tracking-wider text-[10px]">
                              Totales Asiento:
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-lilac-950 font-black">
                              ${totalDebit.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-lilac-950 font-black">
                              ${totalCredit.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pie del Modal */}
            <div className="px-5 py-3 bg-gray-50 border-t border-lilac-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-ink-500">
                Norma NIIF · Asientos reflejados en el Libro Diario General
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs transition shadow-2xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
