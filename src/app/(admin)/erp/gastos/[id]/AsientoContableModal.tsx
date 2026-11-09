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
      {/* Botón compacto con el ojo */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-lilac-300 hover:bg-lilac-50 text-lilac-900 text-xs font-bold transition shadow-xs hover:border-lilac-400 active:scale-[0.98]"
        title="Ver Asiento Contable Completo"
      >
        <Eye size={14} className="text-lilac-600" />
        <span>Ver Asiento Contable</span>
        <span className="text-[10px] bg-lilac-100 text-lilac-800 border border-lilac-200 px-1.5 py-0.2 rounded-full font-bold font-mono">
          {entries.length}
        </span>
      </button>

      {/* Modal Popup Ultra Compacto (Visible en un solo vistazo) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-2xs flex items-center justify-center p-3 animate-fadeIn"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-lilac-200 overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera compacta */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-lilac-50 via-white to-purple-50/40 border-b border-lilac-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale size={16} className="text-lilac-700" />
                <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wide">
                  Asiento Contable (Libro Diario NIIF)
                </h3>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 size={10} className="text-emerald-600" /> Cuadrado
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg text-ink-400 hover:text-ink-800 hover:bg-lilac-100/60 flex items-center justify-center transition"
                title="Cerrar"
              >
                <X size={15} />
              </button>
            </div>

            {/* Contenido compacto sin scroll */}
            <div className="p-3.5 space-y-3">
              {entries.map((entry, entryIdx) => {
                const isPaymentEntry =
                  entry.description.toLowerCase().includes("pago") ||
                  entry.description.toLowerCase().includes("cruce") ||
                  entry.journal_lines.some(
                    (l) => l.account_code === "1.1.01.03" || l.account_code === "1.1.01.02"
                  );

                const totalDebit = entry.journal_lines.reduce((s, l) => s + Number(l.debit || 0), 0);
                const totalCredit = entry.journal_lines.reduce((s, l) => s + Number(l.credit || 0), 0);

                return (
                  <div key={entry.id || entryIdx} className="border border-lilac-200 rounded-xl overflow-hidden shadow-2xs">
                    {/* Barra de título de asiento */}
                    <div className="px-3 py-1 bg-lilac-50/80 border-b border-lilac-200 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 font-bold text-ink-900">
                        <span className="w-4 h-4 rounded bg-lilac-700 text-white flex items-center justify-center text-[9px] font-bold">
                          {entryIdx + 1}
                        </span>
                        <span>{isPaymentEntry ? "Pago / Cruce con Banco" : "Causación del Gasto (Devengo)"}</span>
                      </div>
                      <span className="text-[10px] text-ink-500 font-mono">
                        {new Date(entry.entry_date + "T12:00:00").toLocaleDateString("es-EC")}
                      </span>
                    </div>

                    {/* Tabla de Cuentas: Código, Cuenta, Debe, Haber */}
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-white border-b border-lilac-100 text-[10px] font-bold uppercase text-ink-400 tracking-wider">
                          <th className="py-1 px-2.5 text-left w-20">Código</th>
                          <th className="py-1 px-2 text-left">Cuenta Contable</th>
                          <th className="py-1 px-2 text-right w-20">Debe</th>
                          <th className="py-1 px-2.5 text-right w-20">Haber</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-lilac-50">
                        {entry.journal_lines.map((line, lineIdx) => {
                          const debitVal = Number(line.debit || 0);
                          const creditVal = Number(line.credit || 0);
                          const isCreditLine = creditVal > 0 && debitVal === 0;

                          return (
                            <tr key={line.id || lineIdx} className="hover:bg-lilac-50/20">
                              <td className="py-1 px-2.5 font-mono text-[10px] font-semibold text-lilac-900 whitespace-nowrap">
                                {line.account_code}
                              </td>
                              <td className="py-1 px-2 font-medium text-ink-900 truncate max-w-[200px]">
                                <span className={isCreditLine ? "pl-3 text-ink-700" : "font-semibold"}>
                                  {isCreditLine ? "↳ " : ""}{line.account_name}
                                </span>
                              </td>
                              <td className="py-1 px-2 text-right font-mono font-semibold text-ink-900">
                                {debitVal > 0 ? `$${debitVal.toFixed(2)}` : "—"}
                              </td>
                              <td className="py-1 px-2.5 text-right font-mono font-semibold text-ink-900">
                                {creditVal > 0 ? `$${creditVal.toFixed(2)}` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-lilac-50/60 border-t border-lilac-200 font-bold text-[10px]">
                          <td colSpan={2} className="py-1 px-2.5 text-right text-ink-600 uppercase tracking-wider">
                            Total:
                          </td>
                          <td className="py-1 px-2 text-right font-mono text-lilac-950 font-black">
                            ${totalDebit.toFixed(2)}
                          </td>
                          <td className="py-1 px-2.5 text-right font-mono text-lilac-950 font-black">
                            ${totalCredit.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
