"use client";

import { useState } from "react";
import { BookOpen, CheckCircle2, ChevronDown, ChevronUp, Scale, Clock, ArrowRight } from "lucide-react";
import { formatAsientoCode, formatEgresoCode } from "@/lib/accounting-codes";
import { getOfficialExpenseAccountName } from "@/lib/expense-accounts";

export interface JournalLineItem {
  id?: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  description?: string | null;
}

export interface JournalEntryItem {
  id: string;
  entry_number?: string | number | null;
  entry_code?: string | null;
  egreso_number?: string | number | null;
  entry_date: string;
  description: string;
  reference_type?: string | null;
  reference_id?: string | null;
  status?: string | null;
  created_at?: string | null;
  journal_lines: JournalLineItem[];
}

interface Props {
  entries: JournalEntryItem[];
  expenseTotal?: number;
  paymentMethod?: string;
}

export default function AsientoContableGastoCard({ entries, expenseTotal, paymentMethod }: Props) {
  const [isOpen, setIsOpen] = useState(true);

  if (!entries || entries.length === 0) {
    return (
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <BookOpen size={18} className="text-amber-600 shrink-0" />
          <div>
            <strong className="block font-bold text-amber-950">Asiento Contable en Proceso de Registro</strong>
            <span className="text-[11px] text-amber-800">
              Este gasto no tiene aún un asiento registrado en el Libro Diario. Se asentará automáticamente según el plan de cuentas NIIF.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-lilac-300 rounded-2xl shadow-sm overflow-hidden transition">
      {/* Cabecera del Acordeón Contable */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-5 py-3.5 bg-gradient-to-r from-lilac-50/80 via-white to-purple-50/40 border-b border-lilac-200 flex items-center justify-between cursor-pointer select-none hover:bg-lilac-50/90 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-lilac-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Scale size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs font-bold text-ink-900 uppercase tracking-wide">
                Asiento Contable Completo (Libro Diario NIIF)
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 size={11} className="text-emerald-600" />
                {entries.length === 1 ? "1 Asiento (Causación)" : `${entries.length} Asientos (Causación y Pago)`}
              </span>
            </div>
            <p className="text-[11px] text-ink-500 mt-0.5">
              Causación a Cuentas por Pagar Proveedores (2.1.01.01){entries.length > 1 ? " y Cruce de Pago con Banco/Caja" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-lilac-700 hidden sm:inline">
            {isOpen ? "Ocultar detalle contable" : "Ver detalle contable"}
          </span>
          <button
            type="button"
            className="w-7 h-7 rounded-lg bg-white border border-lilac-200 flex items-center justify-center text-ink-600 hover:text-ink-900 shadow-2xs"
          >
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Contenido desplegable con cada asiento contable */}
      {isOpen && (
        <div className="p-4 sm:p-5 space-y-5 bg-white">
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
                {/* Cabecera del Asiento Individual */}
                <div className="px-4 py-2.5 bg-lilac-50/60 border-b border-lilac-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const codeStr = entry.entry_code || (
                        isPaymentEntry
                          ? (entry.egreso_number ? String(entry.egreso_number) : formatEgresoCode(entry.entry_number || (entryIdx + 1), entry.entry_date))
                          : formatAsientoCode(entry.entry_number || (entryIdx + 1), entry.entry_date, "diario")
                      );
                      const bgCls = isPaymentEntry || codeStr.startsWith("EG") ? "bg-blue-600 text-white" : "bg-lilac-800 text-white";
                      return (
                        <span className={`px-2 py-0.5 rounded-md ${bgCls} font-mono text-xs font-bold tracking-tight shadow-2xs`}>
                          {codeStr}
                        </span>
                      );
                    })()}
                    <strong className="font-bold text-ink-900">
                      {isPaymentEntry ? "Pago / Cruce con Banco" : "Causación del Gasto (Devengo)"}
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

                {/* Tabla Contable: Código, Cuenta, Debe, Haber */}
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
                                {isCreditLine ? "↳ " : ""}{getOfficialExpenseAccountName(line.account_code, line.account_name)}
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
      )}
    </div>
  );
}
