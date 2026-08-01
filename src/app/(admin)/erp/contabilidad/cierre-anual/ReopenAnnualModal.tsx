"use client";

import { useState } from "react";
import { Unlock, AlertTriangle, X, CheckCircle2, Loader2 } from "lucide-react";
import { reopenAnnualPeriodAction } from "./actions";

interface Props {
  year: number;
  canEdit: boolean;
}

export default function ReopenAnnualModal({ year, canEdit }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (reason.trim().length < 5) {
      setError("Debes ingresar una justificación válida de al menos 5 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("year", String(year));
      formData.append("reason", reason.trim());

      await reopenAnnualPeriodAction(formData);
      setIsOpen(false);
      setReason("");
    } catch (err: any) {
      setError(err.message || "Error al reabrir el ejercicio fiscal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-3.5 py-2 rounded-xl transition-colors shadow-sm"
      >
        <Unlock size={14} /> Reabrir Ejercicio Fiscal {year}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-lilac-100 relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-ink-400 hover:text-ink-600 p-1 rounded-lg hover:bg-lilac-50 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-2 text-amber-700 font-bold text-base">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <span>Reapertura de Ejercicio Fiscal {year}</span>
            </div>

            <p className="text-xs text-ink-600 mb-4">
              Estás a punto de reabrir el año fiscal <strong>{year}</strong>. Esta acción anulará el asiento de cierre anual previo y desbloqueará los 12 meses del ejercicio para realizar correcciones tributarias.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">⚠️ Trazabilidad y Auditoría SRI / SuperCias:</p>
              <p>El motivo de la reapertura quedará asentado en la bitácora oficial del sistema con tu cuenta de usuario.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink-700 block mb-1">
                  Motivo / Justificación de la Reapertura *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej. Ajuste de retenciones de impuesto a la renta de clientes o rectificatoria de gastos..."
                  className="w-full border border-lilac-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
                />
              </div>

              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-xl font-medium">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-ink-600 border border-lilac-200 hover:bg-lilac-50 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || reason.trim().length < 5}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Confirmar Reapertura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
