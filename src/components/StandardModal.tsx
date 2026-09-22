"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";

interface StandardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  maxWidthClass?: string;
  maxWidth?: string;
}

export default function StandardModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  loading = false,
  loadingText = "Procesando y guardando...",
  maxWidthClass,
  maxWidth,
}: StandardModalProps) {
  const [mounted, setMounted] = useState(false);
  const widthClass = maxWidth || maxWidthClass || "max-w-lg";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Bloquear scroll de la página de fondo mientras el modal esté abierto
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Atajo de teclado Escape (bloqueado mientras carga)
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={() => {
        if (!loading) onClose();
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-white border border-lilac-100 rounded-3xl shadow-2xl w-full ${widthClass} overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 relative`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Overlay de bloqueo interno durante guardado */}
        {loading && (
          <div className="absolute inset-0 z-50 bg-white/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150">
            <div className="w-14 h-14 rounded-2xl bg-lilac-50 border border-lilac-200 text-lilac-700 flex items-center justify-center mb-3 shadow-inner">
              <Loader2 size={28} className="animate-spin" />
            </div>
            <h4 className="text-sm font-bold text-ink-950 mb-1">Por favor espera</h4>
            <p className="text-xs text-ink-600 font-medium max-w-xs">{loadingText}</p>
          </div>
        )}

        {/* Encabezado del Modal */}
        <div className="px-6 py-4.5 border-b border-lilac-100 bg-lilac-50/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-9 h-9 rounded-2xl bg-lilac-100 text-lilac-700 flex items-center justify-center font-bold shrink-0">
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-ink-950 tracking-tight">{title}</h2>
              {subtitle && <p className="text-xs text-ink-500 font-medium">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!loading) onClose();
            }}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-ink-400 hover:bg-lilac-100 hover:text-ink-700 transition cursor-pointer disabled:opacity-40"
            title="Cerrar ventana"
          >
            <X size={17} />
          </button>
        </div>

        {/* Cuerpo desplazable */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">{children}</div>

        {/* Pie del modal con acciones */}
        {footer && (
          <div className="px-6 py-4 border-t border-lilac-100 flex items-center justify-end gap-2.5 bg-white shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
