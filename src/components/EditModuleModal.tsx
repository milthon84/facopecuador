"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Save, Loader2, Calendar, DollarSign, BookOpen, AlertCircle } from "lucide-react";
import { updateModuleAction } from "@/app/(admin)/erp/cursos/actions";
import TeacherMultiSelect from "@/components/TeacherMultiSelect";

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

export default function EditModuleModal({ module, allTeachers = [], assignedTeacherIds = [] }: EditModuleModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [number, setNumber] = useState(module.number);
  const [name, setName] = useState(module.name);
  const [cost, setCost] = useState(module.cost);
  const [description, setDescription] = useState(module.description || "");
  const [date, setDate] = useState(module.start_date || "");
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>(assignedTeacherIds);

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setNumber(module.number);
    setName(module.name);
    setCost(module.cost);
    setDescription(module.description || "");
    setDate(module.start_date || "");
    setSelectedTeacherIds(assignedTeacherIds);
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
        onClick={handleOpen}
        className="p-1.5 text-lilac-700 hover:bg-lilac-50 rounded-xl transition flex items-center justify-center border border-lilac-100 shadow-2xs hover:border-lilac-300"
        title="Modificar módulo"
      >
        <Pencil size={13} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={handleClose}
        >
          <div
            className="bg-white border border-lilac-100 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => {
              e.preventDefault();
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
                  <h2 className="text-base font-bold text-ink-900">Editar Módulo</h2>
                  <p className="text-xs text-ink-500">Modifica los datos del módulo</p>
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
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Número *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={number}
                    onChange={(e) => setNumber(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition"
                  />
                </div>
                <div className="col-span-2">
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
                      value={cost}
                      onChange={(e) => setCost(Number(e.target.value))}
                      className="w-full pl-8 pr-3 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Nombre del módulo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Módulo I: Diagnóstico inicial"
                  className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles sobre los temas de este módulo..."
                  className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition resize-none"
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
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition"
                />
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

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-lilac-50">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-700 bg-ink-100 hover:bg-ink-200 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-lilac-600 hover:bg-lilac-700 transition shadow-sm"
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
