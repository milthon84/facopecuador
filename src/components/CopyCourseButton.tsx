"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { copyCourseAction } from "@/app/(admin)/erp/cursos/actions";

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
  const [loading, setLoading] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (
      !confirm(
        `¿Deseas duplicar el curso "${courseName}"?\nSe creará un nuevo curso en estado borrador con los mismos módulos y profesores.`
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await copyCourseAction(courseId);
      if (res?.newCourseId) {
        router.push(`/erp/cursos/${res.newCourseId}?tab=info`);
        router.refresh();
      }
    } catch (err: any) {
      alert(err?.message || "No se pudo copiar el curso.");
    } finally {
      setLoading(false);
    }
  }

  if (variant === "icon") {
    return (
      <button
        onClick={handleCopy}
        disabled={loading}
        title="Copiar/Duplicar curso"
        className="p-1.5 rounded-lg text-ink-500 hover:text-lilac-700 hover:bg-lilac-50 transition border border-transparent hover:border-lilac-200 disabled:opacity-50"
      >
        {loading ? <Loader2 size={15} className="animate-spin text-lilac-600" /> : <Copy size={15} />}
      </button>
    );
  }

  return (
    <button
      onClick={handleCopy}
      disabled={loading}
      className="inline-flex items-center gap-1.5 bg-white border border-lilac-200 text-lilac-700 hover:bg-lilac-50 hover:border-lilac-300 text-xs px-3 py-1.5 rounded-xl transition font-medium shadow-sm disabled:opacity-50"
      title="Duplicar este curso para otra cohorte/fecha"
    >
      {loading ? (
        <>
          <Loader2 size={13} className="animate-spin text-lilac-600" /> Copiando...
        </>
      ) : (
        <>
          <Copy size={13} /> Copiar Curso
        </>
      )}
    </button>
  );
}
