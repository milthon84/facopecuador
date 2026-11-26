"use client";

import { useState } from "react";
import { FileX, Loader2 } from "lucide-react";

export const NO_FISCAL_REASONS = ["Beca", "Gratis", "Otro Motivo"] as const;
export type NoFiscalReason = (typeof NO_FISCAL_REASONS)[number];

interface NoFiscalConfirmBoxProps {
  description: React.ReactNode;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (reason: NoFiscalReason, detail: string) => void;
}

/**
 * Formulario reutilizable para confirmar un registro sin comprobante fiscal,
 * solicitando obligatoriamente el motivo (Beca, Gratis, Otro Motivo) y su detalle.
 */
export default function NoFiscalConfirmBox({
  description,
  loading,
  onCancel,
  onConfirm,
}: NoFiscalConfirmBoxProps) {
  const [reason, setReason] = useState<NoFiscalReason | "">("");
  const [detail, setDetail] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!reason) {
      setValidationError("Por favor selecciona un motivo (Beca, Gratis u Otro Motivo).");
      return;
    }
    if (!detail.trim()) {
      setValidationError("Por favor detalla el motivo del registro sin factura.");
      return;
    }
    setValidationError(null);
    onConfirm(reason, detail.trim());
  };

  return (
    <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
      <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
        <FileX size={16} className="text-amber-700 shrink-0" />
        <span>¿Confirmar registro sin comprobante fiscal?</span>
      </div>
      <p className="text-[11px] text-amber-800 leading-relaxed">{description}</p>

      <div className="space-y-2 pt-1">
        <label className="block text-[11px] font-bold text-amber-950">
          Motivo <span className="text-red-600">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {NO_FISCAL_REASONS.map((option) => {
            const active = reason === option;
            return (
              <button
                key={option}
                type="button"
                disabled={loading}
                onClick={() => {
                  setReason(option);
                  if (validationError) setValidationError(null);
                }}
                className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                  active
                    ? "bg-amber-600 text-white border-amber-700 shadow-2xs"
                    : "bg-white text-amber-900 border-amber-200 hover:bg-amber-100/70"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-amber-950">
          Detalle del motivo <span className="text-red-600">*</span>
        </label>
        <textarea
          rows={2}
          value={detail}
          disabled={loading}
          onChange={(e) => {
            setDetail(e.target.value);
            if (validationError) setValidationError(null);
          }}
          placeholder="Ej: Beca 100% por convenio institucional, cortesía docente, exoneración aprobada por gerencia..."
          className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-ink-900 placeholder:text-ink-400 focus:border-amber-500 focus:outline-none"
        />
      </div>

      {validationError && (
        <p className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
          {validationError}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200/60">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-amber-100 rounded-xl transition cursor-pointer"
        >
          Volver atrás
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Registrando...</span>
            </>
          ) : (
            <span>Confirmar Registro Sin Factura</span>
          )}
        </button>
      </div>
    </div>
  );
}
