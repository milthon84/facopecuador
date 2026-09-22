"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Edit2, Clock, AlertCircle, Loader2 } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import {
  createRuleAction,
  updateRuleAction,
  deleteRuleAction,
} from "@/app/(admin)/erp/horarios/actions";

interface Rule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
}

const DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export default function HorariosEditor({
  initialRules,
  canEdit = true,
}: {
  initialRules: Rule[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>(initialRules);

  // Modal State for Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [targetDay, setTargetDay] = useState<number>(1);

  // Form Fields
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [slotDuration, setSlotDuration] = useState(60);
  const [isActive, setIsActive] = useState(true);

  // Loading & Feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function handleOpenCreate(dow: number) {
    setEditingRule(null);
    setTargetDay(dow);
    setStartTime("09:00");
    setEndTime("12:00");
    setSlotDuration(60);
    setIsActive(true);
    setErrorMsg(null);
    setModalOpen(true);
  }

  function handleOpenEdit(rule: Rule) {
    setEditingRule(rule);
    setTargetDay(rule.day_of_week);
    setStartTime(rule.start_time.slice(0, 5));
    setEndTime(rule.end_time.slice(0, 5));
    setSlotDuration(rule.slot_duration_minutes);
    setIsActive(rule.is_active);
    setErrorMsg(null);
    setModalOpen(true);
  }

  function handleCloseModal() {
    if (loading) return;
    setModalOpen(false);
    setEditingRule(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;

    if (startTime >= endTime) {
      setErrorMsg("La hora de inicio debe ser anterior a la hora de fin.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      if (editingRule) {
        await updateRuleAction(editingRule.id, {
          start_time: startTime,
          end_time: endTime,
          slot_duration_minutes: slotDuration,
          is_active: isActive,
        });
        setRules((prev) =>
          prev.map((r) =>
            r.id === editingRule.id
              ? {
                  ...r,
                  start_time: startTime,
                  end_time: endTime,
                  slot_duration_minutes: slotDuration,
                  is_active: isActive,
                }
              : r
          )
        );
      } else {
        await createRuleAction({
          day_of_week: targetDay,
          start_time: startTime,
          end_time: endTime,
          slot_duration_minutes: slotDuration,
          is_active: isActive,
        });
        router.refresh();
      }
      setModalOpen(false);
      setEditingRule(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar el horario.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!canEdit || !deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteRuleAction(deleteTarget.id);
      setRules((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Error al eliminar la regla.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {DAYS.map((dayName, dow) => {
        const dayRules = rules.filter((r) => r.day_of_week === dow);
        return (
          <div
            key={dow}
            className="bg-white rounded-2xl border border-lilac-100 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-lilac-500" />
                <h3 className="font-bold text-ink-900 text-sm">{dayName}</h3>
                <span className="text-xs text-ink-400 font-normal">
                  ({dayRules.length} {dayRules.length === 1 ? "bloque" : "bloques"})
                </span>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleOpenCreate(dow)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-lilac-50 text-lilac-700 hover:bg-lilac-100 transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Agregar Horario</span>
                </button>
              )}
            </div>

            {dayRules.length === 0 ? (
              <div className="text-xs text-ink-400 italic py-2 px-1">
                No hay atención configurada para este día (Cerrado).
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {dayRules.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between p-3 rounded-xl border text-sm transition-all ${
                      r.is_active
                        ? "bg-slate-50 border-slate-200"
                        : "bg-slate-100/60 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink-900 font-mono text-xs">
                          {r.start_time.slice(0, 5)} - {r.end_time.slice(0, 5)}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            r.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {r.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <p className="text-xs text-ink-500">
                        Turnos de {r.slot_duration_minutes} min / paciente
                      </p>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(r)}
                          className="p-1.5 text-ink-500 hover:text-lilac-700 hover:bg-white rounded-lg border border-transparent hover:border-lilac-100 transition cursor-pointer"
                          title="Modificar horario"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(r)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-white rounded-lg border border-transparent hover:border-red-100 transition cursor-pointer"
                          title="Eliminar horario"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* StandardModal para Crear / Modificar Horario */}
      <StandardModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={
          editingRule
            ? `Modificar Horario - ${DAYS[targetDay]}`
            : `Nuevo Horario - ${DAYS[targetDay]}`
        }
        subtitle="Configura el rango de disponibilidad y duración de turnos"
        icon={<Clock size={20} className="text-lilac-600" />}
        loading={loading}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Hora de Inicio *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={loading}
                required
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Hora de Fin *
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={loading}
                required
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Duración por Cita / Turno *
            </label>
            <select
              value={slotDuration}
              onChange={(e) => setSlotDuration(parseInt(e.target.value))}
              disabled={loading}
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
            >
              <option value={15}>15 minutos por paciente</option>
              <option value={30}>30 minutos por paciente</option>
              <option value={45}>45 minutos por paciente</option>
              <option value={60}>60 minutos (1 hora) por paciente</option>
              <option value={90}>90 minutos (1 hora y media)</option>
              <option value={120}>120 minutos (2 horas)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-ink-700 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-100">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={loading}
              className="w-4 h-4 text-lilac-600 rounded border-slate-300 focus:ring-lilac-500"
            />
            <span>Horario Activo (habilitado para agendamiento)</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>{editingRule ? "Guardar Cambios" : "Crear Horario"}</span>
              )}
            </button>
          </div>
        </form>
      </StandardModal>

      {/* StandardModal para Confirmar Eliminación */}
      <StandardModal
        isOpen={!!deleteTarget}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        title="Eliminar Horario de Atención"
        subtitle="Esta acción no se puede deshacer"
        icon={<Trash2 size={20} className="text-red-600" />}
        loading={deleteLoading}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-700 leading-relaxed bg-red-50/50 p-3.5 rounded-2xl border border-red-100">
            ¿Estás seguro de que deseas eliminar el horario de{" "}
            <strong>
              {deleteTarget &&
                `${DAYS[deleteTarget.day_of_week]} de ${deleteTarget.start_time.slice(0, 5)} a ${deleteTarget.end_time.slice(0, 5)}`}
            </strong>
            ?
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteLoading}
              className="px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-lilac-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteLoading}
              className="inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              {deleteLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Eliminando...</span>
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  <span>Eliminar Horario</span>
                </>
              )}
            </button>
          </div>
        </div>
      </StandardModal>
    </div>
  );
}
