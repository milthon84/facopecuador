"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertCircle, Receipt } from "lucide-react";
import Link from "next/link";

interface Props {
  appointment: any;
  isBilled?: boolean;
  invoiceNumber?: string | null;
  invoiceId?: string | null;
  rejectedInvoice?: { id: string; invoice_number: string; sri_status: string } | null;
  canModifyCalendar?: boolean;
  canModifyBilling?: boolean;
}

export default function AppointmentActions({
  appointment,
  isBilled = false,
  invoiceNumber = null,
  invoiceId = null,
  rejectedInvoice = null,
  canModifyCalendar = true,
  canModifyBilling = true,
}: Props) {
  const router = useRouter();

  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<{
    show: boolean;
    message: string;
  } | null>(null);

  if (appointment.status !== "scheduled" && appointment.status !== "attended") {
    return null;
  }

  const patient = Array.isArray(appointment.patient) ? appointment.patient[0] : appointment.patient;

  async function updateStatus(status: string, extra: Record<string, any> = {}) {
    if (isBilled && (status === "cancelled" || status === "no_show")) {
      setErrorModal({
        show: true,
        message: `Esta cita ya cuenta con una factura autorizada/registrada ${invoiceNumber ? `(№ ${invoiceNumber})` : ""}. Para modificar o cancelar esta cita, primero debes anular la factura correspondiente.`,
      });
      return;
    }

    setLoading(true);
    setActiveStatus(status);
    let isRedirecting = false;
    try {
      const res = await fetch("/api/admin/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: appointment.id,
          status,
          extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar el estado");

      // Invalida el router cache del cliente: sin esto, al volver a esta
      // pagina Next.js sirve el RSC payload en memoria (estado viejo)
      // en lugar de pedir datos frescos al servidor.
      router.refresh();

      if (status === "attended") {
        isRedirecting = true;
        router.push(`/erp/citas/${appointment.id}/atencion`);
      } else if (status === "no_show" || status === "cancelled") {
        isRedirecting = true;
        router.push("/erp");
      }
    } catch (err: any) {
      setErrorModal({
        show: true,
        message: err.message || "Error al actualizar el estado de la cita.",
      });
    } finally {
      if (!isRedirecting) {
        setLoading(false);
        setActiveStatus(null);
      }
    }
  }

  const disabled = loading || appointment.status !== "scheduled";

  return (
    <div className="space-y-4">
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/40 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white/95 border border-lilac-100 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center animate-in fade-in duration-200">
            {/* Elegant Clinic Spinner with Golden/Lilac Accents */}
            <div className="relative mb-6">
              <div className="h-16 w-16 rounded-full border-4 border-lilac-50 border-t-gold animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-lilac-600">
                <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-ink mb-2">
              {activeStatus === "attended"
                ? "Preparando consulta..."
                : activeStatus === "no_show"
                ? "Registrando inasistencia..."
                : "Cancelando cita..."}
            </h3>
            <p className="text-sm text-ink/75 leading-relaxed">
              {activeStatus === "attended"
                ? "Estamos abriendo la ficha odontológica interactiva. Por favor, espera un momento."
                : activeStatus === "no_show"
                ? "Estamos actualizando el estado de la cita en la base de datos."
                : "Estamos cancelando la reserva y liberando el horario."}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Estado de Facturación / Botón Facturar */}
        {isBilled ? (
          invoiceId ? (
            <Link
              href={`/erp/facturacion/${invoiceId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-300 transition-colors shadow-sm w-fit whitespace-nowrap"
              title="Ver detalles de la factura"
            >
              <CheckCircle2 size={13} className="text-green-600" />
              <span>Facturado {invoiceNumber ? `— № ${invoiceNumber}` : ""}</span>
            </Link>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-green-200 bg-green-50 text-green-700 shadow-sm w-fit whitespace-nowrap">
              <CheckCircle2 size={13} className="text-green-600" />
              <span>Facturado {invoiceNumber ? `— № ${invoiceNumber}` : ""}</span>
            </div>
          )
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {rejectedInvoice && (
              <Link
                href={`/erp/facturacion/${rejectedInvoice.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 transition-colors shadow-sm w-fit whitespace-nowrap"
                title="Ver observaciones y error de la factura rechazada por el SRI"
              >
                <XCircle size={13} className="text-red-600" />
                <span>Factura Rechazada SRI (№ {rejectedInvoice.invoice_number})</span>
              </Link>
            )}

            {canModifyBilling && (
              <Link
                href={`/erp/facturacion/nueva?patient_id=${patient?.id}&appointment_id=${appointment.id}`}
                className="inline-flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all shadow-sm"
              >
                <Receipt size={14} /> Facturar Cita
              </Link>
            )}
          </div>
        )}

        {/* Acciones de Cita Agendada */}
        {appointment.status === "scheduled" && canModifyCalendar && (
          <>
            <button
              onClick={() => router.push(`/erp/citas/${appointment.id}/atencion`)}
              disabled={disabled}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
            >
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> Marcar atendida
            </button>
            <button
              onClick={() => updateStatus("no_show")}
              disabled={disabled}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
            >
              <AlertCircle size={14} className="text-amber-600 shrink-0" /> {activeStatus === "no_show" ? "Procesando..." : "No asistió"}
            </button>
            {appointment.status !== "cancelled" && (
              <button
                onClick={() => setShowCancel(!showCancel)}
                disabled={disabled}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
              >
                <XCircle size={14} className="text-rose-600 shrink-0" /> Cancelar
              </button>
            )}
          </>
        )}
      </div>

      {showCancel && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <label className="label text-red-900">Motivo de cancelación</label>
          <input
            className="input mb-2"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Ej: paciente avisó por teléfono"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCancel(false)} disabled={disabled} className="btn-ghost text-xs">
              Atrás
            </button>
            <button
              onClick={() =>
                updateStatus("cancelled", {
                  cancelled_at: new Date().toISOString(),
                  cancelled_by: "admin",
                  cancellation_reason: cancelReason || null,
                })
              }
              disabled={disabled}
              className="btn-danger text-xs"
            >
              {activeStatus === "cancelled" ? "Cancelando..." : "Confirmar cancelación"}
            </button>
          </div>
        </div>
      )}

      {errorModal?.show && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-300 animate-in fade-in"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setErrorModal(null);
          }}
        >
          <div 
            className="bg-white border border-lilac-100 rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {/* Icono */}
            <div className="flex items-center justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                <AlertCircle size={24} />
              </div>
            </div>

            {/* Titulo y Mensaje */}
            <h3 className="text-lg font-bold text-ink-900 mb-2">Error</h3>
            <p className="text-xs text-ink-600 leading-relaxed mb-6">{errorModal.message}</p>

            {/* Accion */}
            <div className="w-full">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setErrorModal(null);
                }}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 shadow-md shadow-red-200 transition"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
