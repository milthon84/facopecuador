"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Loader2, Calendar, DollarSign, BookOpen, AlertCircle } from "lucide-react";
import { createModuleAction } from "@/app/(admin)/erp/cursos/actions";
import TeacherMultiSelect from "@/components/TeacherMultiSelect";
import StandardModal from "@/components/StandardModal";

interface TeacherOption {
  id: string;
  full_name: string;
  specialty?: string | null;
}

interface CreateModuleModalProps {
  courseId: string;
  allTeachers?: TeacherOption[];
  buttonText?: string;
  variant?: "primary" | "empty_state" | "outline";
}

export default function CreateModuleModal({
  courseId,
  allTeachers = [],
  buttonText = "Nuevo Módulo",
  variant = "primary",
}: CreateModuleModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [cost, setCost] = useState<string>("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);

  function handleOpen(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    setName("");
    setCost("");
    setDescription("");
    setDate("");
    setSelectedTeacherIds([]);
    setErrorMsg(null);
    setOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setErrorMsg("El nombre del módulo es obligatorio.");
      return;
    }

    const numCost = Number(cost);
    if (isNaN(numCost) || numCost < 0) {
      setErrorMsg("Ingresa un costo válido para el módulo.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await createModuleAction({
        courseId,
        name: name.trim(),
        cost: numCost,
        description: description.trim() || null,
        date: date || null,
        teacherIds: selectedTeacherIds,
      });

      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al registrar el módulo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Botón de apertura según variante */}
      {variant === "empty_state" ? (
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          <Plus size={18} />
          <span>Crear Primer Módulo</span>
        </button>
      ) : variant === "outline" ? (
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-1.5 border border-lilac-300 hover:border-lilac-500 bg-white hover:bg-lilac-50 text-lilac-700 font-semibold text-xs px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer"
        >
          <Plus size={14} />
          <span>{buttonText}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-1.5 bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
        >
          <Plus size={16} />
          <span>{buttonText}</span>
        </button>
      )}

      <StandardModal
        isOpen={open}
        onClose={handleClose}
        title="Nuevo Módulo del Programa"
        subtitle="Registra una sesión o temática académica"
        icon={<BookOpen size={20} className="text-lilac-600" />}
        loading={loading}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              Nombre del módulo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={loading}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Módulo I: Diagnóstico Clínico y Fotografía"
              className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              Descripción o temario (Opcional)
            </label>
            <textarea
              rows={2}
              disabled={loading}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve resumen de los contenidos que se abordarán en este módulo..."
              className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink-800 mb-1.5">
                <span className="flex items-center gap-1.5">
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
              <label className="block text-xs font-bold text-ink-800 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <DollarSign size={13} className="text-lilac-600" /> Costo del módulo ($) <span className="text-red-500">*</span>
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-ink-400 font-bold text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  disabled={loading}
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition font-mono font-medium"
                />
              </div>
            </div>
          </div>

          {allTeachers && allTeachers.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-ink-800 mb-1.5">
                Profesor(es) asignado(s)
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
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-ink-600 hover:bg-lilac-100 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Guardando Módulo...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Guardar Módulo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </StandardModal>
    </>
  );
}
