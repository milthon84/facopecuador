"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { createCourseAction } from "@/app/(admin)/erp/cursos/actions";

export default function NuevoCursoForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData(e.currentTarget);

    try {
      const res = await createCourseAction(formData);
      if (res?.success && res.courseId) {
        router.push(`/erp/cursos/${res.courseId}`);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "No se pudo crear el curso.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label text-ink-800">Nombre del Curso *</label>
        <input
          name="name"
          required
          placeholder="Ej: Diplomado en Implantología Oral Avanzada"
          className="input"
          disabled={loading}
        />
      </div>

      <div>
        <label className="label text-ink-800">Descripción / Detalles</label>
        <textarea
          name="description"
          rows={3}
          placeholder="Escribe detalles del curso, temarios generales, etc."
          className="input resize-none"
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label text-ink-800">Costo total ($) *</label>
          <input
            name="totalCost"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="Ej: 1200.00"
            className="input"
            disabled={loading}
          />
        </div>
        <div>
          <label className="label text-ink-800">Límite de alumnos</label>
          <input
            name="maxStudents"
            type="number"
            min="1"
            placeholder="Ej: 20 (opcional)"
            className="input"
            disabled={loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label text-ink-800">Fecha de Inicio *</label>
          <input
            name="startDate"
            type="date"
            required
            className="input"
            disabled={loading}
          />
        </div>
        <div>
          <label className="label text-ink-800">Fecha de Finalización *</label>
          <input
            name="endDate"
            type="date"
            required
            className="input"
            disabled={loading}
          />
        </div>
      </div>

      <div>
        <label className="label text-ink-800 font-semibold">Boceto o Portada del Curso (Imagen)</label>
        <input
          name="imageFile"
          type="file"
          accept="image/*"
          disabled={loading}
          className="w-full text-xs text-ink-600 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-lilac-50 file:text-lilac-700 hover:file:bg-lilac-100 bg-white border border-lilac-200 rounded-xl p-1 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div>
        <label className="label text-ink-800">Estado inicial</label>
        <select name="status" className="input" disabled={loading}>
          <option value="draft">Borrador (No visible en la web)</option>
          <option value="active">Abierto (Abierto para inscripciones)</option>
          <option value="in_progress">En Ejecución (Curso en desarrollo)</option>
        </select>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
          <AlertCircle size={15} className="shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary text-sm py-3 mt-4 shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin text-white" /> Creando curso...
          </>
        ) : (
          "Crear Curso y Configurar Detalles"
        )}
      </button>
    </form>
  );
}
