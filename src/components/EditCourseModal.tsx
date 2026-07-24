"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Save, Loader2, BookOpen, DollarSign, Users, AlertCircle } from "lucide-react";
import { updateCourseAction } from "@/app/(admin)/erp/cursos/actions";

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

  function handleClose(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    if (loading) return;
    setOpen(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();

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
        onClick={handleOpen}
        className="inline-flex items-center gap-1 bg-lilac-50 hover:bg-lilac-100 text-lilac-700 text-xs px-3 py-1.5 rounded-xl transition font-semibold border border-lilac-200 shadow-2xs hover:scale-[1.02] cursor-pointer"
        title="Editar Datos del Curso"
      >
        <Pencil size={13} /> Editar Datos
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={handleClose}
        >
          <div
            className="bg-white border border-lilac-100 rounded-3xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-150 relative overflow-hidden"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-lilac-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-lilac-50 text-lilac-700 flex items-center justify-center font-bold text-xs">
                  <BookOpen size={16} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-ink-900">Editar Datos del Curso</h2>
                  <p className="text-xs text-ink-500">Modifica los detalles generales del programa</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={loading}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-ink-400 hover:bg-lilac-50 hover:text-ink-700 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Nombre del Curso *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Diplomado en Implantología Oral"
                  className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Descripción / Detalles
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Temario o detalles principales del curso..."
                  className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Costo Total ($) *
                  </label>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3 top-3 text-ink-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={totalCost}
                      onChange={(e) => setTotalCost(Number(e.target.value))}
                      className="w-full pl-8 pr-3 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Límite de Alumnos
                  </label>
                  <div className="relative">
                    <Users size={14} className="absolute left-3 top-3 text-ink-400" />
                    <input
                      type="number"
                      min="1"
                      value={maxStudents}
                      onChange={(e) => setMaxStudents(e.target.value ? Number(e.target.value) : "")}
                      placeholder="Ej: 20"
                      className="w-full pl-8 pr-3 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition"
                    />
                  </div>
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
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Fecha de Finalización *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Estado del Curso
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition bg-white"
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

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-lilac-50">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-700 bg-ink-100 hover:bg-ink-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-lilac-600 hover:bg-lilac-700 transition shadow-xs cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Guardando...
                    </>
                  ) : (
                    <>
                      <Save size={13} /> Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
