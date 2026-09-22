"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import StandardModal from "@/components/StandardModal";

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

  const closeModal = () => {
    if (!loading) setIsOpen(false);
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

      <StandardModal
        isOpen={isOpen}
        onClose={closeModal}
        title="Confirmar Eliminación"
        subtitle="Esta acción no se puede deshacer"
        icon={<Trash2 size={20} className="text-red-600" />}
        loading={loading}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
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
            className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100"
          >
            <input type="hidden" name={idName} value={idValue} />
            {Object.entries(extraFields).map(([name, val]) => (
              <input key={name} type="hidden" name={name} value={val} />
            ))}
            <button
              type="button"
              onClick={closeModal}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-lilac-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
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
                  <Loader2 size={14} className="animate-spin" />
                  <span>Eliminando...</span>
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  <span>Eliminar</span>
                </>
              )}
            </button>
          </form>
        </div>
      </StandardModal>
    </>
  );
}
