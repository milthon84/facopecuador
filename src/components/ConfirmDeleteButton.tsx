"use client";

import { useState } from "react";
import { Trash2, Loader2, X } from "lucide-react";

interface Props {
  action: (formData: FormData) => Promise<void>;
  confirmMessage: string;
  idName?: string;
  idValue: string;
  extraFields?: Record<string, string>;
}

export default function ConfirmDeleteButton({
  action,
  confirmMessage,
  idName = "id",
  idValue,
  extraFields = {},
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const openModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
        title="Eliminar"
      >
        <Trash2 size={15} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 text-left"
          onClick={(e) => {
            e.stopPropagation();
            if (!loading) setIsOpen(false);
          }}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 border border-lilac-100 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-100 text-red-600 rounded-2xl shrink-0 font-bold">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink-950">Confirmar Eliminación</h3>
                  <p className="text-xs text-ink-500 font-medium">Esta acción no se puede deshacer</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-ink-400 hover:bg-lilac-50 hover:text-ink-700 transition"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-ink-700 leading-relaxed bg-red-50/50 p-3.5 rounded-2xl border border-red-100">
              {confirmMessage}
            </p>

            <form
              action={async (formData) => {
                setLoading(true);
                try {
                  await action(formData);
                  setIsOpen(false);
                } finally {
                  setLoading(false);
                }
              }}
              className="flex items-center justify-end gap-2 pt-2 border-t border-lilac-100"
            >
              <input type="hidden" name={idName} value={idValue} />
              {Object.entries(extraFields).map(([name, val]) => (
                <input key={name} type="hidden" name={name} value={val} />
              ))}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-lilac-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Eliminar
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
