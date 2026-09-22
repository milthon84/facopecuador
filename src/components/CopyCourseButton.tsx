"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, AlertCircle } from "lucide-react";
import { copyCourseAction } from "@/app/(admin)/erp/cursos/actions";
import StandardModal from "@/components/StandardModal";

interface CopyCourseButtonProps {
  courseId: string;
  courseName: string;
  variant?: "icon" | "button" | "card";
}

export default function CopyCourseButton({
  courseId,
  courseName,
  variant = "button",
}: CopyCourseButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleConfirmCopy() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await copyCourseAction(courseId);
      if (res?.newCourseId) {
        setIsOpen(false);
        router.push(`/erp/cursos/${res.newCourseId}`);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "No se pudo copiar el curso.");
      setLoading(false);
    }
  }

  const openModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setErrorMsg(null);
    setIsOpen(true);
  };

  const closeModal = () => {
    if (!loading) setIsOpen(false);
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={openModal}
          disabled={loading}
          title="Copiar/Duplicar curso"
          className="p-1.5 rounded-lg text-ink-500 hover:text-lilac-700 hover:bg-lilac-50 transition border border-transparent hover:border-lilac-200 disabled:opacity-50 cursor-pointer"
        >
          <Copy size={15} />
        </button>
      ) : (
        <button
          type="button"
          onClick={openModal}
          disabled={loading}
          className="inline-flex items-center gap-1.5 bg-white border border-lilac-200 text-lilac-700 hover:bg-lilac-50 hover:border-lilac-300 text-xs px-3 py-1.5 rounded-xl transition font-medium shadow-sm disabled:opacity-50 cursor-pointer"
          title="Duplicar este curso para otra cohorte/fecha"
        >
          <Copy size={13} /> Copiar Curso
        </button>
      )}

      <StandardModal
        isOpen={isOpen}
        onClose={closeModal}
        title="¿Duplicar Curso?"
        subtitle={courseName}
        icon={<Copy size={20} className="text-lilac-700" />}
        loading={loading}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-700 leading-relaxed bg-lilac-50/50 p-3.5 rounded-2xl border border-lilac-100">
            Se creará un nuevo curso en estado <strong>Borrador</strong> conservando la estructura de módulos y asignaciones del curso original.
          </p>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={closeModal}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-lilac-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmCopy}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 bg-lilac-600 hover:bg-lilac-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Duplicando...</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Confirmar y Duplicar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </StandardModal>
    </>
  );
}
