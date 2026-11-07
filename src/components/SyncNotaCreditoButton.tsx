"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface SyncNotaCreditoButtonProps {
  creditNoteId: string;
  currentStatus: string;
  creditNoteNumber?: string;
  className?: string;
}

export default function SyncNotaCreditoButton({
  creditNoteId,
  currentStatus,
  creditNoteNumber,
  className = "",
}: SyncNotaCreditoButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);

  if (currentStatus === "authorized") {
    return null;
  }

  const handleSync = async () => {
    setLoading(true);
    setMessage(null);
    setIsSuccess(null);

    try {
      const res = await fetch("/api/admin/nota-credito-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credit_note_id: creditNoteId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al sincronizar con SRI");
      }

      if (data.estado === "authorized") {
        setIsSuccess(true);
        setMessage("¡Nota de Crédito autorizada en el SRI!");
        setTimeout(() => {
          router.refresh();
        }, 1200);
      } else if (data.estado === "submitted") {
        setIsSuccess(false);
        setMessage("El SRI aún está procesando el comprobante.");
      } else {
        setIsSuccess(false);
        const msgSri = data.mensajes?.[0]?.mensaje || "No autorizada por el SRI";
        setMessage(msgSri);
      }
    } catch (err: any) {
      setIsSuccess(false);
      setMessage(err.message || "Error al comunicar con SRI");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        title={`Consultar estado en el SRI para ${creditNoteNumber || "esta nota de crédito"}`}
        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg transition-colors shadow-2xs disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin text-amber-600" />
        ) : (
          <RefreshCw size={12} className="text-amber-600" />
        )}
        <span>{loading ? "Consultando..." : "Sincronizar SRI"}</span>
      </button>

      {message && (
        <span
          className={`text-[10px] font-medium flex items-center gap-0.5 mt-0.5 ${
            isSuccess ? "text-emerald-600" : "text-amber-700"
          }`}
        >
          {isSuccess ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
          {message}
        </span>
      )}
    </div>
  );
}
