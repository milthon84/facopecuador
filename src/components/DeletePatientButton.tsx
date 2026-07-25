"use client";

import { useState } from "react";
import { Trash2, Loader2, AlertCircle } from "lucide-react";
import { deletePatientAction } from "@/app/(admin)/erp/pacientes/actions";
import { useRouter } from "next/navigation";

interface Props {
  patientId: string;
  patientName: string;
  redirectTo?: string;
  variant?: "icon" | "button";
}

export default function DeletePatientButton({
  patientId,
  patientName,
  redirectTo,
  variant = "icon",
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setErrorMsg(null);

      const res = await deletePatientAction(patientId);

      if (!res.success) {
        setErrorMsg(res.error || "No se pudo eliminar el paciente.");
        setIsDeleting(false);
        return;
      }

      setIsOpen(false);
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al intentar eliminar el paciente.");
      setIsDeleting(false);
    }
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setIsOpen(true);
          }}
          title="Eliminar paciente"
          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
        >
          <Trash2 size={16} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setIsOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs px-3 py-1.5 rounded-xl border border-red-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Trash2 size={14} className="text-red-600" />
          <span>Eliminar Paciente</span>
        </button>
      )}

      {/* Modal de Confirmación */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 border border-lilac-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100 text-red-600 rounded-2xl shrink-0">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="font-bold text-base text-ink-950">¿Eliminar Paciente?</h3>
                <p className="text-xs text-ink-500 font-medium">{patientName}</p>
              </div>
            </div>

            <p className="text-xs text-ink-700 leading-relaxed bg-lilac-50/50 p-3 rounded-2xl border border-lilac-100">
              Solo se pueden eliminar pacientes que <strong>no hayan sido atendidos</strong> y <strong>no tengan facturas ni consultas completas</strong> asociadas.
            </p>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-lilac-100">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-lilac-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Confirmar Eliminación
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
