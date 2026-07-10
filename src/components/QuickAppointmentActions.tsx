"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";

interface Props {
  appointmentId: string;
}

export default function QuickAppointmentActions({ appointmentId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"no_show" | "cancelled" | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  function openModal(e: React.MouseEvent, type: "no_show" | "cancelled") {
    e.preventDefault();
    e.stopPropagation();
    setModalType(type);
    setCancellationReason("");
    setShowModal(true);
  }

  async function confirmAction() {
    if (!modalType || loading) return;

    let extra: Record<string, any> = {};

    if (modalType === "cancelled") {
      extra = {
        cancelled_at: new Date().toISOString(),
        cancelled_by: "admin",
        cancellation_reason: cancellationReason || null,
      };
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: appointmentId,
          status: modalType,
          extra,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar la cita");

      router.refresh();
      setShowModal(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        {/* Marcar atendida (Redirección directa a la atención) */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            router.push(`/erp/citas/${appointmentId}/atencion`);
          }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-white border-lilac-200 text-lilac-700 hover:bg-lilac-50/70 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
          title="Iniciar atención de la cita"
        >
          <CheckCircle2 size={13} className="text-lilac-600" />
          <span className="hidden sm:inline">Atendida</span>
        </button>

        {/* No asistió */}
        <button
          onClick={(e) => openModal(e, "no_show")}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-white border-amber-200 text-amber-700 hover:bg-amber-50/70 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
          title="No asistió"
        >
          <AlertCircle size={13} className="text-amber-500" />
          <span className="hidden sm:inline">No asistió</span>
        </button>

        {/* Cancelar */}
        <button
          onClick={(e) => openModal(e, "cancelled")}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-white border-red-200 text-red-600 hover:bg-red-50/70 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
          title="Cancelar cita"
        >
          <XCircle size={13} className="text-red-500" />
          <span className="hidden sm:inline">Cancelar</span>
        </button>
      </div>

      {showModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-300 animate-in fade-in"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!loading) setShowModal(false);
          }}
        >
          <div 
            className="bg-white border border-lilac-100 rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation(); // Evitar que el clic en el contenido cierre el modal
            }}
          >
            {/* Icono de Cabecera */}
            <div className="flex items-center justify-center mb-4">
              {modalType === "no_show" && (
                <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                  <AlertCircle size={24} />
                </div>
              )}
              {modalType === "cancelled" && (
                <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                  <XCircle size={24} />
                </div>
              )}
            </div>

            {/* Título y Descripción */}
            <h3 className="text-lg font-bold text-center text-ink-900 mb-2">
              {modalType === "no_show" && "Registrar Inasistencia"}
              {modalType === "cancelled" && "Cancelar Cita"}
            </h3>
            <p className="text-xs text-ink-600 text-center mb-4 leading-relaxed">
              {modalType === "no_show" && "¿Confirmas que el paciente no asistió a la cita programada?"}
              {modalType === "cancelled" && "¿Está seguro de que desea cancelar esta cita? Esta acción liberará el horario agendado."}
            </p>

            {/* Input de Motivo de Cancelación */}
            {modalType === "cancelled" && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">
                  Motivo de la cancelación (opcional)
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-lilac-200 bg-white px-3.5 py-2 text-xs text-ink-900 placeholder-ink-600/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-200 transition"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Ej: Paciente avisó por teléfono"
                  disabled={loading}
                />
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowModal(false);
                }}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-lilac-200 text-ink-700 hover:bg-lilac-50/50 transition disabled:opacity-50"
              >
                Volver
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  confirmAction();
                }}
                disabled={loading}
                className={`px-4 py-2 text-xs font-semibold rounded-xl text-white transition disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                  modalType === "no_show" ? "bg-amber-500 hover:bg-amber-600" :
                  "bg-red-600 hover:bg-red-700"
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    {modalType === "no_show" && "Confirmar"}
                    {modalType === "cancelled" && "Confirmar Cancelación"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
