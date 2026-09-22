"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, Loader2, Calendar, DollarSign, BookOpen, AlertCircle } from "lucide-react";
import { updateModuleAction } from "@/app/(admin)/erp/cursos/actions";
import TeacherMultiSelect from "@/components/TeacherMultiSelect";
import StandardModal from "@/components/StandardModal";

interface TeacherOption {
  id: string;
  full_name: string;
  specialty?: string | null;
}

interface ModuleData {
  id: string;
  course_id: string;
  number: number;
  name: string;
  cost: number;
  description?: string | null;
  start_date?: string | null;
}

interface EditModuleModalProps {
  module: ModuleData;
  allTeachers?: TeacherOption[];
  assignedTeacherIds?: string[];
}

function formatDateForInput(d?: string | null): string {
  if (!d) return "";
  return d.split("T")[0];
}

export default function EditModuleModal({ module, allTeachers = [], assignedTeacherIds = [] }: EditModuleModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [number, setNumber] = useState(module.number);
  const [name, setName] = useState(module.name);
  const [cost, setCost] = useState(module.cost);
  const [description, setDescription] = useState(module.description || "");
  const [date, setDate] = useState(formatDateForInput(module.start_date));
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>(assignedTeacherIds);

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setNumber(module.number);
    setName(module.name);
    setCost(module.cost);
    setDescription(module.description || "");
    setDate(formatDateForInput(module.start_date));
    setSelectedTeacherIds(assignedTeacherIds);
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
      setErrorMsg("El nombre del módulo es obligatorio.");
      return;
    }
    if (isNaN(number) || number < 1) {
      setErrorMsg("El número del módulo debe ser mayor a 0.");
      return;
    }
    if (isNaN(cost) || cost < 0) {
      setErrorMsg("El costo del módulo debe ser mayor o igual a 0.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await updateModuleAction({
        id: module.id,
        courseId: module.course_id,
        number: Number(number),
        name: name.trim(),
        cost: Number(cost),
        description: description.trim() || null,
        date: date || null,
        teacherIds: selectedTeacherIds,
      });

      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al actualizar el módulo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="p-1.5 text-lilac-700 hover:bg-lilac-50 rounded-xl transition flex items-center justify-center border border-lilac-100 shadow-2xs hover:border-lilac-300 cursor-pointer"
        title="Modificar módulo"
      >
        <Pencil size={13} />
      </button>

      <StandardModal
        isOpen={open}
        onClose={handleClose}
        title="Editar Módulo"
        subtitle="Modifica los datos y profesores asignados al módulo"
        icon={<BookOpen size={20} className="text-lilac-600" />}
        loading={loading}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Nombre del módulo *
            </label>
            <input
              type="text"
              required
              disabled={loading}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Módulo I: Diagnóstico inicial"
              className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Descripción
            </label>
            <textarea
              rows={2}
              disabled={loading}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles sobre los temas de este módulo..."
              className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              <span className="flex items-center gap-1">
                <Calendar size={13} className="text-lilac-600" /> Fecha del módulo (Día de clases)
              </span>
            </label>
            <input
              type="date"
              disabled={loading}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition"
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
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition font-mono"
              />
            </div>
          </div>

          {allTeachers && allTeachers.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-ink-800 mb-1">
                Profesor(es) del módulo
              </label>
              <TeacherMultiSelect
                teachers={allTeachers}
                initialSelectedIds={selectedTeacherIds}
                onChange={(ids) => setSelectedTeacherIds(ids)}
                placeholder="Seleccionar profesor(es)..."
              />
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-700 bg-ink-100 hover:bg-ink-200 transition disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-lilac-600 hover:bg-lilac-700 transition shadow-sm disabled:opacity-50 cursor-pointer"
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
