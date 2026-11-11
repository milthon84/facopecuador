"use client";

import { useState } from "react";
import { Eye, Scale, CheckCircle2, X } from "lucide-react";
import { formatAsientoCode, formatEgresoCode, formatIngresoCode } from "@/lib/accounting-codes";

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
  buttonVariant?: "default" | "icon" | "table-compact";
  buttonText?: string;
  title?: string;
}

export function buildInvoiceJournalEntries(invoice: any, linkedCn?: any): JournalEntryItem[] {
  const entries: JournalEntryItem[] = [];
  if (!invoice) return entries;

  const tot = Number(invoice.total || 0);
  const subtotalTotal = Number(invoice.subtotal_0 || 0) + Number(invoice.subtotal_15 || 0);
  const ivaAmt = Number(invoice.iva_amount || 0);
  const invDate =
    invoice.issue_date ||
    (invoice.created_at ? String(invoice.created_at).split("T")[0] : new Date().toISOString().split("T")[0]);

  // Resolver cuentas contables según origen (Clínica, Cursos, Coworking, Otros)
  const area = (invoice.billing_area || invoice.area || "").toLowerCase();
  let cxcCode = "1.1.02.01";
  let cxcName = "Cuentas por Cobrar Pacientes (Clínica)";
  let incCode = "4.1.01.01";
  let incName = "Servicios Odontológicos";

  if (area === "cursos" || invoice.course_enrollment_id || invoice.module_enrollment_ids) {
    cxcCode = "1.1.02.02";
    cxcName = "Cuentas por Cobrar Alumnos (Cursos)";
    incCode = "4.2.01.01";
    incName = "Servicios de Capacitación y Cursos";
  } else if (area === "coworking" || invoice.rental_id) {
    cxcCode = "1.1.02.03";
    cxcName = "Cuentas por Cobrar Inquilinos (Coworking)";
    incCode = "4.3.01.01";
    incName = "Alquiler de Espacios y Sillones Odontológicos";
  } else if (area === "otros") {
    cxcCode = "1.1.02.04";
    cxcName = "Anticipos a Proveedores y Otras Ctas. por Cobrar";
    incCode = "4.4.01.01";
    incName = "Otros Ingresos No Operacionales";
  }

  // 1. Asiento de Venta / Devengo
  const saleLines: JournalLineItem[] = [
    {
      account_code: cxcCode,
      account_name: cxcName,
      debit: tot,
      credit: 0,
      description: invoice.client_name,
    },
    {
      account_code: incCode,
      account_name: incName,
      debit: 0,
      credit: subtotalTotal > 0 ? subtotalTotal : tot,
    },
  ];

  if (ivaAmt > 0) {
    saleLines.push({
      account_code: "2.1.03.01",
      account_name: "IVA en Ventas por Pagar",
      debit: 0,
      credit: ivaAmt,
    });
  }

  entries.push({
    id: `inv-${invoice.id}-sale`,
    entry_date: invDate,
    description: `Factura de Venta (${cxcName}) — ${invoice.client_name}`,
    reference_type: "invoice",
    reference_id: invoice.id,
    journal_lines: saleLines,
  });

  // 2. Cobro / Recaudación (si está cobrada)
  if (invoice.payment_status === "paid") {
    const isEfectivo = (invoice.payment_method || "").toLowerCase() === "efectivo";
    entries.push({
      id: `inv-${invoice.id}-pay`,
      entry_date: invDate,
      description: `Cobro Total Factura ${invoice.invoice_number || ""} (${isEfectivo ? "Caja General" : "Bancos"})`,
      reference_type: "invoice",
      reference_id: invoice.id,
      journal_lines: [
        {
          account_code: isEfectivo ? "1.1.01.01" : "1.1.01.03",
          account_name: isEfectivo ? "Caja General" : "Bancos Cuentas Corrientes y Ahorros",
          debit: tot,
          credit: 0,
        },
        {
          account_code: cxcCode,
          account_name: cxcName,
          debit: 0,
          credit: tot,
          description: `Cobro liquidado ${invoice.client_name}`,
        },
      ],
    });
  }

  // 3. Nota de Crédito (si está vinculada)
  if (linkedCn) {
    const cnTotal = Number(linkedCn.total || tot);
    const cnSubtotal = Math.max(0, cnTotal - (ivaAmt > 0 ? (cnTotal * 0.15) / 1.15 : 0));
    const cnIva = Math.round((cnTotal - cnSubtotal) * 100) / 100;
    const cnDate = linkedCn.created_at ? String(linkedCn.created_at).split("T")[0] : invDate;

    const cnLines: JournalLineItem[] = [
      {
        account_code: incCode,
        account_name: `${incName} (Reversión)`,
        debit: Math.round(cnSubtotal * 100) / 100,
        credit: 0,
      },
    ];
    if (cnIva > 0) {
      cnLines.push({
        account_code: "2.1.03.01",
        account_name: "IVA en Ventas por Pagar (Reversión)",
        debit: cnIva,
        credit: 0,
      });
    }
    cnLines.push({
      account_code: cxcCode,
      account_name: cxcName,
      debit: 0,
      credit: cnTotal,
      description: `Nota de Crédito ${linkedCn.credit_note_number || ""}`,
    });

    entries.push({
      id: `cn-${linkedCn.id || "mod"}`,
      entry_date: cnDate,
      description: `Nota de Crédito ${linkedCn.credit_note_number || ""} — Reversión Factura ${invoice.invoice_number}`,
      reference_type: "credit_note",
      reference_id: linkedCn.id || invoice.id,
      journal_lines: cnLines,
    });
  }

  return entries;
}

export function getEntryKind(entry: JournalEntryItem) {
  const desc = (entry.description || "").toLowerCase();
  const ref = (entry.reference_type || "").toLowerCase();

  if (ref === "credit_note" || desc.includes("nota de crédito") || desc.includes("credito")) {
    return {
      title: "Nota de Crédito (Reversión Contable)",
      voucherType: "diario" as const,
      voucherLabel: "Nota de Crédito",
      voucherColor: "bg-amber-100 text-amber-900 border-amber-300",
    };
  }
  if (
    desc.includes("cobro") ||
    desc.includes("recaudaci") ||
    (ref === "invoice" && entry.journal_lines.some((l) => Number(l.credit) > 0 && l.account_code.startsWith("1.1.02")))
  ) {
    const isCash =
      desc.includes("caja") ||
      desc.includes("efectivo") ||
      entry.journal_lines.some((l) => l.account_code === "1.1.01.01" && Number(l.debit) > 0);
    return {
      title: isCash ? "Cobro / Recaudación en Efectivo (Caja General)" : "Cobro / Recaudación Bancaria",
      voucherType: "ingreso" as const,
      voucherLabel: "Comprobante de Ingreso",
      voucherColor: "bg-emerald-100 text-emerald-900 border-emerald-300",
    };
  }
  if (
    desc.includes("pago") ||
    desc.includes("cruce") ||
    desc.includes("egreso") ||
    entry.journal_lines.some((l) => l.account_code === "1.1.01.03" || l.account_code === "1.1.01.02" || l.account_code === "1.1.01.01" || l.account_code === "2.1.05.01")
  ) {
    return {
      title: "Pago / Cruce con Banco",
      voucherType: "egreso" as const,
      voucherLabel: "Comprobante de Egreso",
      voucherColor: "bg-blue-100 text-blue-900 border-blue-300",
    };
  }
  if (ref === "invoice" || desc.includes("factura") || desc.includes("venta")) {
    return {
      title: "Emisión y Venta (Devengo)",
      voucherType: "diario" as const,
      voucherLabel: "Comprobante de Diario",
      voucherColor: "bg-purple-100 text-purple-900 border-purple-300",
    };
  }
  return {
    title: "Causación del Gasto (Devengo)",
    voucherType: "diario" as const,
    voucherLabel: "Comprobante de Diario",
    voucherColor: "bg-purple-100 text-purple-900 border-purple-300",
  };
}

function getEntryTitle(entry: JournalEntryItem): string {
  return getEntryKind(entry).title;
}

export default function AsientoContableModal({
  entries,
  buttonVariant = "default",
  buttonText,
  title = "Asiento Contable (Libro Diario NIIF)",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  if (!entries || entries.length === 0) return null;

  return (
    <>
      {/* Botón disparador según la variante solicitada */}
      {buttonVariant === "default" && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-lilac-300 hover:bg-lilac-50 text-lilac-900 text-xs font-bold transition shadow-xs hover:border-lilac-400 active:scale-[0.98] shrink-0"
          title="Ver Asiento Contable"
        >
          <Eye size={14} className="text-lilac-600 shrink-0" />
          <span className="whitespace-nowrap">{buttonText || "Ver Asiento"}</span>
          <span className="text-[10px] bg-lilac-100 text-lilac-800 border border-lilac-200 px-1.5 py-0.2 rounded-full font-bold font-mono shrink-0">
            {entries.length}
          </span>
        </button>
      )}

      {buttonVariant === "table-compact" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          className="inline-flex items-center gap-1 text-xs font-bold text-lilac-700 bg-white border border-lilac-200 hover:bg-lilac-50 px-2 py-1 rounded-lg transition-colors shadow-2xs"
          title="Ver Asiento Contable NIIF"
        >
          <Eye size={12} className="text-lilac-600" />
          <span>{buttonText || "Asiento"}</span>
        </button>
      )}

      {buttonVariant === "icon" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-white border border-lilac-200 hover:bg-lilac-50 text-lilac-700 shadow-2xs transition"
          title="Ver Asiento Contable"
        >
          <Eye size={14} />
        </button>
      )}

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
                  {title}
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

            {/* Contenido compacto sin scroll innecesario */}
            <div className="p-3.5 space-y-3 max-h-[82vh] overflow-y-auto">
              {entries.map((entry, entryIdx) => {
                const totalDebit = entry.journal_lines.reduce(
                  (s, l) => s + Number(l.debit || 0),
                  0
                );
                const totalCredit = entry.journal_lines.reduce(
                  (s, l) => s + Number(l.credit || 0),
                  0
                );

                return (
                  <div
                    key={entry.id || entryIdx}
                    className="border border-lilac-200 rounded-xl overflow-hidden shadow-2xs"
                  >
                    {/* Barra de título con Código Identificador Único */}
                    {(() => {
                      const kind = getEntryKind(entry);
                      const entryNum = entry.entry_number || (entryIdx + 1);
                      const defaultAsientoCode = formatAsientoCode(entryNum, entry.entry_date, "diario");
                      const defaultEgresoCode = entry.egreso_number ? String(entry.egreso_number) : formatEgresoCode(entryNum, entry.entry_date);
                      const defaultIngresoCode = formatIngresoCode(entryNum, entry.entry_date);

                      let codeStr = entry.entry_code;
                      if (!codeStr) {
                        codeStr =
                          kind.voucherType === "egreso"
                            ? defaultEgresoCode
                            : kind.voucherType === "ingreso"
                            ? defaultIngresoCode
                            : defaultAsientoCode;
                      }

                      const codeBadge =
                        kind.voucherType === "egreso" || codeStr.startsWith("EG")
                          ? { code: codeStr, cls: "bg-blue-600 text-white" }
                          : kind.voucherType === "ingreso" || codeStr.startsWith("ING")
                          ? { code: codeStr, cls: "bg-emerald-600 text-white" }
                          : codeStr.startsWith("NC")
                          ? { code: codeStr, cls: "bg-amber-600 text-white" }
                          : { code: codeStr, cls: "bg-lilac-800 text-white" };

                      return (
                        <div className="px-3 py-1.5 bg-lilac-50/80 border-b border-lilac-200 flex items-center justify-between text-[11px] gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Único Código Identificador: EG para egresos, ING para cobros, AS para diario */}
                            <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold tracking-tight shadow-2xs ${codeBadge.cls}`}>
                              {codeBadge.code}
                            </span>

                            <span className="font-bold text-ink-900">
                              {kind.title}
                            </span>
                          </div>

                          <span className="text-[10px] text-ink-500 font-mono font-medium">
                            {entry.entry_date
                              ? new Date(entry.entry_date + "T12:00:00").toLocaleDateString("es-EC")
                              : ""}
                          </span>
                        </div>
                      );
                    })()}

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
                                  {isCreditLine ? "↳ " : ""}
                                  {line.account_name}
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
                          <td
                            colSpan={2}
                            className="py-1 px-2.5 text-right text-ink-600 uppercase tracking-wider"
                          >
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
