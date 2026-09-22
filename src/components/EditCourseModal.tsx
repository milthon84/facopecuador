"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, Loader2, BookOpen, DollarSign, AlertCircle } from "lucide-react";
import { updateCourseAction } from "@/app/(admin)/erp/cursos/actions";
import StandardModal from "@/components/StandardModal";

interface CourseData {
  id: string;
  name: string;
  description?: string | null;
  total_cost: number;
  max_students?: number | null;
  start_date: string;
  end_date: string;
  status: string;
}

interface Props {
  course: CourseData;
}

function formatDateForInput(d?: string | null): string {
  if (!d) return "";
  return d.split("T")[0];
}

export default function EditCourseModal({ course }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState(course.name);
  const [description, setDescription] = useState(course.description || "");
  const [totalCost, setTotalCost] = useState(course.total_cost);
  const [maxStudents, setMaxStudents] = useState<number | "">(course.max_students || "");
  const [startDate, setStartDate] = useState(formatDateForInput(course.start_date));
  const [endDate, setEndDate] = useState(formatDateForInput(course.end_date));
  const [status, setStatus] = useState(course.status);

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setName(course.name);
    setDescription(course.description || "");
    setTotalCost(course.total_cost);
    setMaxStudents(course.max_students || "");
    setStartDate(formatDateForInput(course.start_date));
    setEndDate(formatDateForInput(course.end_date));
    setStatus(course.status);
    setErrorMsg(null);
    setOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setOpen(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setErrorMsg("El nombre del curso es obligatorio.");
      return;
    }
    if (isNaN(totalCost) || totalCost < 0) {
      setErrorMsg("El costo del curso debe ser un número mayor o igual a 0.");
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg("Las fechas de inicio y finalización son obligatorias.");
      return;
    }
    if (endDate < startDate) {
      setErrorMsg("La fecha de finalización no puede ser anterior a la fecha de inicio.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await updateCourseAction({
        id: course.id,
        name: name.trim(),
        description: description.trim() || null,
        totalCost: Number(totalCost),
        maxStudents: maxStudents ? Number(maxStudents) : null,
        startDate,
        endDate,
        status,
      });

      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al actualizar el curso.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1 bg-lilac-50 hover:bg-lilac-100 text-lilac-700 text-xs px-3 py-1.5 rounded-xl transition font-semibold border border-lilac-200 shadow-2xs hover:scale-[1.02] cursor-pointer"
        title="Editar Datos del Curso"
      >
        <Pencil size={13} /> <span>Editar Datos</span>
      </button>

      <StandardModal
        isOpen={open}
        onClose={handleClose}
        title="Editar Datos del Curso"
        subtitle="Modifica los detalles generales del programa"
        icon={<BookOpen size={20} className="text-lilac-600" />}
        loading={loading}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Nombre del Curso *
            </label>
            <input
              type="text"
              required
              disabled={loading}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Diplomado en Implantología Oral"
              className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Descripción / Detalles
            </label>
            <textarea
              rows={3}
              disabled={loading}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Temario o detalles principales del curso..."
              className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Costo ($) *
            </label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-3 top-3 text-ink-400" />
              <input
                type="number"
                step="0.01"
                min="0"
                required
                disabled={loading}
                value={totalCost}
                onChange={(e) => setTotalCost(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Fecha de Inicio *
              </label>
              <input
                type="date"
                required
                disabled={loading}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Fecha de Finalización *
              </label>
              <input
                type="date"
                required
                disabled={loading}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Estado del Curso
            </label>
            <select
              value={status}
              disabled={loading}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition"
            >
              <option value="draft">Borrador (No visible en la web)</option>
              <option value="active">Abierto (Inscripciones abiertas)</option>
              <option value="in_progress">En Ejecución (Curso en desarrollo)</option>
              <option value="completed">Finalizado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-700 bg-ink-100 hover:bg-ink-200 transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-lilac-600 hover:bg-lilac-700 transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save size={13} /> <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </StandardModal>
    </>
  );
}
