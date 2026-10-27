"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { CoworkingRentalStatus } from "@/lib/coworking-types";

interface Props {
  rentalId: string;
  currentStatus: CoworkingRentalStatus;
  canEdit: boolean;
}

export default function QuickCoworkingActions({
  rentalId,
  currentStatus,
  canEdit,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!canEdit || currentStatus === "facturado" || currentStatus === "cancelado") {
    return null;
  }

  async function updateStatus(newStatus: CoworkingRentalStatus) {
    if (loading) return;
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
      if (!res.ok) throw new Error(data.error || "Error al actualizar estado");
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Error al actualizar el estado");
    } finally {
      setLoading(false);
    }
  }

  return (
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
              title="Marcar como atención finalizada (listo para facturación)"
            >
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span>Finalizar Atención</span>
            </button>
          )}

          {(currentStatus === "reservado" || currentStatus === "en_curso") && (
            <button
              type="button"
              onClick={() => {
                if (confirm("¿Estás seguro de cancelar esta reserva de coworking?")) {
                  updateStatus("cancelado");
                }
              }}
              className="inline-flex items-center p-1 rounded-lg text-ink-400 hover:text-red-600 hover:bg-red-50 transition"
              title="Cancelar reserva"
            >
              <XCircle size={14} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
