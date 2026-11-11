"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { syncPeriodExpensesAction } from "./actions";

interface SincronizarAsientosButtonProps {
  period: string;
}

export default function SincronizarAsientosButton({ period }: SincronizarAsientosButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleSync = async () => {
    const confirm = window.confirm(
      "¿Deseas sincronizar los asientos contables de este período?\n\nEsto regenerará los asientos de Libro Diario (Causación y Cruce) según el catálogo de cuentas y formas de pago actuales de cada compra o gasto."
    );
    if (!confirm) return;

    try {
      setLoading(true);
      setMessage(null);
      setIsError(false);

      const res = await syncPeriodExpensesAction(period);
      if (res.success) {
        setMessage(`¡${res.count} gasto(s) sincronizados!`);
        setTimeout(() => setMessage(null), 3500);
      } else {
        setIsError(true);
        setMessage(res.error || "Error al sincronizar");
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (err: any) {
      setIsError(true);
      setMessage(err.message || "Error al sincronizar");
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {message && (
        <span
          className={`text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold transition ${
            isError
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
          }`}
        >
          {isError ? <AlertCircle size={13} /> : <CheckCircle2 size={13} className="text-emerald-600" />}
          {message}
        </span>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={handleSync}
        className="px-3 py-1.5 rounded-xl border border-lilac-200 bg-white hover:bg-lilac-50 text-ink-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs hover:border-lilac-300 disabled:opacity-50"
        title="Regenerar y alinear los asientos de Libro Diario con los gastos y pagos registrados"
      >
        <RefreshCw size={13} className={`text-lilac-600 ${loading ? "animate-spin" : ""}`} />
        <span>{loading ? "Sincronizando..." : "Sincronizar Asientos"}</span>
      </button>
    </div>
  );
}
