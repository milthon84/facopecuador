"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle, CheckCircle2, XCircle, Loader2, AlertTriangle, FileText } from "lucide-react";
import { CoworkingRentalStatus, CoworkingResourceType } from "@/lib/coworking-types";

interface Props {
  rentalId: string;
  currentStatus: CoworkingRentalStatus;
  canEdit: boolean;
  resourceType?: CoworkingResourceType;
  hasContracts?: boolean;
  hasWaivers?: boolean;
}

export default function QuickCoworkingActions({
  rentalId,
  currentStatus,
  canEdit,
  resourceType,
  hasContracts,
  hasWaivers,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [missingDocsModal, setMissingDocsModal] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  if (!canEdit || currentStatus === "facturado" || currentStatus === "cancelado") {
    return null;
  }

  const isClinicalSpace = resourceType === "puesto_trabajo" || resourceType === "clinica_completa";

  async function updateStatus(newStatus: CoworkingRentalStatus) {
    if (loading) return;

    // Si intenta completar un sillón o clínica sin documentos
    if (newStatus === "finalizado" && isClinicalSpace) {
      if (!hasContracts || !hasWaivers) {
        setMissingDocsModal(true);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/coworking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rentalId,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.missingDocs) {
          setMissingDocsModal(true);
          return;
        }
        throw new Error(data.error || "Error al actualizar estado");
      }
      setConfirmCancelOpen(false);
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Error al actualizar el estado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {loading ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-500 font-medium px-2 py-1">
            <Loader2 size={12} className="animate-spin text-lilac-600" />
            <span>Actualizando...</span>
          </span>
        ) : (
          <>
            {currentStatus === "reservado" && (
              <button
                type="button"
                onClick={() => updateStatus("en_curso")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 transition shadow-2xs"
                title="Marcar llegada del doctor e inicio de atención en el espacio"
              >
                <PlayCircle size={13} className="text-amber-600 shrink-0" />
                <span>Iniciar Atención</span>
              </button>
            )}

            {currentStatus === "en_curso" && (
              <button
                type="button"
                onClick={() => updateStatus("finalizado")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
                title="Marcar como alquiler completado (exige contrato y descargo en sillones/clínica)"
              >
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Completar Alquiler</span>
              </button>
            )}

            {(currentStatus === "reservado" || currentStatus === "en_curso") && (
              <button
                type="button"
                onClick={() => setConfirmCancelOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition"
                title="Cancelar reserva"
              >
                <XCircle size={13} />
                <span className="hidden sm:inline">Cancelar</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Modal Requisitos Pendientes */}
      {missingDocsModal && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-2xs flex items-center justify-center p-4 text-left"
          onClick={() => setMissingDocsModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-scaleIn border border-amber-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-amber-700">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-ink-900">Documentación Obligatoria Pendiente</h3>
                <p className="text-xs text-ink-500">Alquiler de Sillón Dental / Clínica</p>
              </div>
            </div>

            <p className="text-xs text-ink-700 leading-relaxed bg-amber-50/60 p-3 rounded-xl border border-amber-200">
              Para <strong>completar el alquiler</strong> de este espacio clínico es obligatorio haber adjuntado el{" "}
              <strong>Contrato de Arrendamiento</strong> y el <strong>Descargo de Responsabilidad</strong> firmado por el paciente.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMissingDocsModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-ink-600 hover:bg-gray-100 rounded-xl transition"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setMissingDocsModal(false);
                  router.push(`/erp/coworking/${rentalId}`);
                }}
                className="px-4 py-2 text-xs font-bold bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl shadow-xs transition inline-flex items-center gap-1.5"
              >
                <FileText size={14} /> Ir a Cargar Documentos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Cancelar */}
      {confirmCancelOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-2xs flex items-center justify-center p-4 text-left"
          onClick={() => setConfirmCancelOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-scaleIn border border-red-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <XCircle size={22} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-ink-900">¿Cancelar esta reserva de alquiler?</h3>
                <p className="text-xs text-ink-500">El espacio quedará liberado en la agenda.</p>
              </div>
            </div>

            <p className="text-xs text-ink-600 bg-lilac-50/50 p-3 rounded-xl border border-lilac-100">
              ¿Estás seguro de cancelar esta reserva de coworking? El estado cambiará a cancelado.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmCancelOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-ink-600 hover:bg-gray-100 rounded-xl transition"
              >
                No cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => updateStatus("cancelado")}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={14} />}
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
