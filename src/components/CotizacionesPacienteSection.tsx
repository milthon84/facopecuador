"use client";

import { useState } from "react";
import { Calculator, Plus, Mail, MessageCircle, ChevronDown, ChevronUp, Check, Clock, FileText } from "lucide-react";
import NuevaCotizacionModal from "@/components/NuevaCotizacionModal";
import { sendQuotationEmailAction } from "@/app/(admin)/erp/pacientes/actions";
import { buildQuotationWhatsAppUrl } from "@/lib/whatsapp";

interface QuotationRow {
  id: string;
  quotation_number: string;
  items: Array<{ tooth?: string; treatment: string; quantity: number; unitPrice: number; subtotal: number }>;
  subtotal: number;
  discount: number;
  total: number;
  notes?: string | null;
  status: string;
  created_at: string;
  sent_email_at?: string | null;
  sent_whatsapp_at?: string | null;
}

interface Props {
  patientId: string;
  patientName: string;
  patientEmail: string | null;
  patientPhone: string | null;
  odontogramState?: Record<string, any> | null;
  initialQuotations: QuotationRow[];
}

export default function CotizacionesPacienteSection({
  patientId,
  patientName,
  patientEmail,
  patientPhone,
  odontogramState,
  initialQuotations,
}: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

  const handleSendEmail = async (quotationId: string) => {
    if (!patientEmail) {
      alert("El paciente no tiene un correo electrónico registrado.");
      return;
    }
    setSendingEmailId(quotationId);
    try {
      const res = await sendQuotationEmailAction(quotationId);
      if (res.success) {
        alert("Cotización reenviada con éxito al correo del paciente.");
      } else {
        alert(`Error al enviar el correo: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error al enviar el correo: ${err.message}`);
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleOpenWhatsApp = (q: QuotationRow) => {
    if (!patientPhone) {
      alert("El paciente no tiene número de teléfono o celular registrado.");
      return;
    }
    const url = buildQuotationWhatsAppUrl(
      patientPhone,
      patientName,
      q.quotation_number,
      q.items,
      q.total,
      q.notes,
      q.discount,
      Number(q.discount || 0) > 0 ? "efectivo" : "tarjeta"
    );
    if (url) {
      window.open(url, "_blank");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  return (
    <div className="card bg-white border border-lilac-100 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3 border-b border-lilac-100">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-lilac-100 text-lilac-900 rounded-lg">
            <Calculator size={18} />
          </div>
          <div>
            <h2 className="font-bold text-ink-900 text-base">Presupuestos y Cotizaciones</h2>
            <p className="text-xs text-ink-500">Historial de cotizaciones enviadas al paciente</p>
          </div>
        </div>
      </div>

      {initialQuotations.length === 0 ? (
        <div className="text-center py-8 bg-lilac-50/40 border border-dashed border-lilac-200 rounded-xl space-y-2">
          <Calculator size={32} className="mx-auto text-lilac-400" />
          <p className="text-xs font-semibold text-ink-700">No se registran cotizaciones anteriores para este paciente.</p>
          <p className="text-[11px] text-ink-500">Puedes generar un presupuesto desde el botón <strong>"+ Nueva Cotización"</strong> en la lista principal de pacientes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {initialQuotations.map((q) => {
            const isExpanded = expandedId === q.id;

            // Safe parsing of items array
            const safeItems = Array.isArray(q.items) 
              ? q.items 
              : (typeof q.items === "string" ? (() => { try { return JSON.parse(q.items); } catch { return []; } })() : []);

            const qSubtotal = Number(q.subtotal) || 0;
            const qDiscount = Number(q.discount) || 0;
            const qTotal = Number(q.total) || 0;

            return (
              <div
                key={q.id}
                className="border border-lilac-100 rounded-xl overflow-hidden bg-white shadow-2xs hover:border-lilac-300 transition-colors"
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                  className="p-3.5 bg-lilac-50/40 hover:bg-lilac-50 cursor-pointer flex flex-wrap items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-xs font-bold px-2.5 py-1 bg-lilac-900 text-white rounded-lg">
                      {q.quotation_number}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-ink-900 block">
                        Presupuesto Odontológico – ${qTotal.toFixed(2)} USD
                      </span>
                      <span className="text-[10px] text-ink-500 flex items-center gap-1">
                        <Clock size={11} /> Creado el {formatDate(q.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {/* Reenviar Email */}
                    <button
                      type="button"
                      onClick={() => handleSendEmail(q.id)}
                      disabled={sendingEmailId === q.id || !patientEmail}
                      title={patientEmail ? "Reenviar por Correo Electrónico" : "Sin correo registrado"}
                      className="px-2.5 py-1.5 bg-white border border-lilac-200 hover:bg-lilac-100 text-lilac-900 font-bold text-xs rounded-lg shadow-2xs transition-colors flex items-center gap-1 disabled:opacity-40"
                    >
                      <Mail size={13} className="text-lilac-700" />
                      {sendingEmailId === q.id ? "Enviando..." : "Correo"}
                      {q.sent_email_at && <Check size={12} className="text-green-600" />}
                    </button>

                    {/* WhatsApp Direct Link */}
                    <button
                      type="button"
                      onClick={() => handleOpenWhatsApp({ ...q, items: safeItems, total: qTotal })}
                      disabled={!patientPhone}
                      title={patientPhone ? "Enviar por WhatsApp" : "Sin teléfono registrado"}
                      className="px-2.5 py-1.5 bg-green-50 border border-green-200 hover:bg-green-100 text-green-800 font-bold text-xs rounded-lg shadow-2xs transition-colors flex items-center gap-1 disabled:opacity-40"
                    >
                      <MessageCircle size={13} className="text-green-600" /> WhatsApp
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : q.id)}
                      className="p-1 text-ink-400 hover:text-ink-700 rounded-md"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Table & Notes */}
                {isExpanded && (
                  <div className="p-4 border-t border-lilac-100 bg-white space-y-3 animate-in fade-in duration-150">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-lilac-100 text-[10px] uppercase font-bold text-ink-500 bg-lilac-50/50">
                            <th className="p-2">Pieza</th>
                            <th className="p-2">Tratamiento</th>
                            <th className="p-2 text-center">Cant.</th>
                            <th className="p-2 text-right">P. Unit</th>
                            <th className="p-2 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-lilac-50">
                          {safeItems.map((item: any, idx: number) => {
                            const uPrice = Number(item.unitPrice) || 0;
                            const sub = Number(item.subtotal) || 0;
                            return (
                              <tr key={idx} className="hover:bg-lilac-50/20">
                                <td className="p-2 font-bold text-lilac-900">
                                  {item.tooth ? `Diente ${item.tooth}` : "General"}
                                </td>
                                <td className="p-2 text-ink-900">{item.treatment}</td>
                                <td className="p-2 text-center text-ink-600">{item.quantity}</td>
                                <td className="p-2 text-right text-ink-600">${uPrice.toFixed(2)}</td>
                                <td className="p-2 text-right font-bold text-ink-900">${sub.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap justify-between items-start gap-4 pt-2 border-t border-lilac-100">
                      {q.notes ? (
                        <div className="text-xs text-ink-700 bg-gold-50/40 p-2.5 border border-gold-100 rounded-lg max-w-md">
                          <span className="font-bold text-gold-900 block mb-0.5">Observaciones:</span>
                          <p className="whitespace-pre-wrap text-[11px]">{q.notes}</p>
                        </div>
                      ) : <div />}

                      <div className="text-xs space-y-1 text-right ml-auto bg-lilac-50/50 p-2.5 border border-lilac-100 rounded-lg">
                        <div className="text-ink-600">Subtotal: <span className="font-semibold text-ink-900">${qSubtotal.toFixed(2)}</span></div>
                        {qDiscount > 0 && (
                          <div className="text-green-700 font-semibold">Descuento: -${qDiscount.toFixed(2)}</div>
                        )}
                        <div className="text-sm font-extrabold text-lilac-950 pt-1 border-t border-lilac-200">
                          TOTAL: ${qTotal.toFixed(2)} USD
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nueva Cotización */}
      <NuevaCotizacionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        patientId={patientId}
        patientName={patientName}
        patientPhone={patientPhone}
        patientEmail={patientEmail}
        odontogramState={odontogramState}
      />
    </div>
  );
}
