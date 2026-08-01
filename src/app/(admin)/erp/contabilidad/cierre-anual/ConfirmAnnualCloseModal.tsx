"use client";

import { useState } from "react";
import { Lock, AlertTriangle, X, CheckCircle2, Loader2, Building2 } from "lucide-react";
import { executeAnnualCloseAction } from "./actions";

interface Props {
  year: number;
  isReopened: boolean;
  canEdit: boolean;
}

export default function ConfirmAnnualCloseModal({ year, isReopened, canEdit }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) return null;

  async function handleConfirm() {
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("year", String(year));
      await executeAnnualCloseAction(formData);
      setIsOpen(false);
    } catch (err: any) {
      setError(err.message || "Error al ejecutar el cierre anual.");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-lilac-200"
      >
        <Lock size={15} />
        {isReopened ? `Volver a Ejecutar Cierre Anual ${year}` : `Ejecutar Cierre Anual del Ejercicio ${year}`}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-lilac-100 relative">
            <button
              onClick={() => setIsOpen(false)}
              disabled={loading}
              className="absolute top-4 right-4 text-ink-400 hover:text-ink-600 p-1 rounded-lg hover:bg-lilac-50 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-3 text-lilac-800 font-bold text-base">
              <div className="w-10 h-10 rounded-xl bg-lilac-100 flex items-center justify-center shrink-0 text-lilac-700">
                <Building2 size={20} />
              </div>
              <span>Confirmar Cierre Anual Fiscal {year}</span>
            </div>

            <p className="text-xs text-ink-600 mb-4 leading-relaxed">
              ¿Estás seguro de que deseas ejecutar el **Cierre Anual Fiscal y Contable** oficial para el ejercicio **{year}**?
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4 text-xs text-amber-900 space-y-1.5">
              <p className="font-semibold flex items-center gap-1">
                <AlertTriangle size={14} className="text-amber-700" /> Efectos del Cierre Anual (SRI / SuperCias):
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-800">
                <li>Se liquidará el <strong>15% Participación Trabajadores</strong> y el <strong>25% Impuesto a la Renta Sociedades</strong>.</li>
                <li>Se generará el <strong>Asiento Contable Anual a Patrimonio (3.2.02)</strong>.</li>
                <li>Se <strong>bloquearán automáticamente los 12 meses</strong> del ejercicio fiscal.</li>
              </ul>
            </div>

            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-xl font-medium mb-4">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-ink-600 border border-lilac-200 hover:bg-lilac-50 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Sí, Confirmar Cierre Anual
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
