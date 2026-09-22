"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Ban, CalendarPlus, AlertCircle, Loader2 } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { createExceptionAction, deleteExceptionAction } from "@/app/(admin)/erp/bloqueos/actions";

interface Exception {
  id: string;
  date: string;
  type: "block" | "extra";
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export default function BloqueosEditor({
  initialExceptions,
  canEdit = true,
}: {
  initialExceptions: Exception[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Exception[]>(initialExceptions);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Exception | null>(null);

  const [type, setType] = useState<"block" | "extra">("block");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fullDay, setFullDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleOpen() {
    setType("block");
    setDate(new Date().toISOString().slice(0, 10));
    setFullDay(true);
    setStartTime("09:00");
    setEndTime("12:00");
    setReason("");
    setErrorMsg(null);
    setIsOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    if (type === "extra" && (!startTime || !endTime)) {
      setErrorMsg("Debes indicar hora de inicio y fin para el horario extra.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await createExceptionAction({
        date,
        type,
        start_time: type === "block" && fullDay ? null : startTime,
        end_time: type === "block" && fullDay ? null : endTime,
        reason: reason.trim() || null,
      });

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al registrar el bloqueo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!canEdit || !deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteExceptionAction(deleteTarget.id);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      {canEdit && (
        <div className="mb-6 flex justify-between items-center">
          <button
            type="button"
            onClick={handleOpen}
            className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all shadow-sm cursor-pointer"
          >
            <Plus size={16} />
            <span>Agregar bloqueo o horario extra</span>
          </button>
        </div>
      )}

      {/* Modal para Crear Bloqueo / Horario Extra */}
      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title={type === "block" ? "Nuevo Bloqueo de Disponibilidad" : "Nuevo Horario Extra"}
        subtitle="Configura una excepción al calendario de atención"
        icon={type === "block" ? <Ban size={20} className="text-red-600" /> : <CalendarPlus size={20} className="text-amber-600" />}
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

          <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setType("block")}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                type === "block"
                  ? "bg-white text-red-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Ban size={14} /> Bloquear día/horas
            </button>
            <button
              type="button"
              onClick={() => setType("extra")}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                type === "extra"
                  ? "bg-white text-amber-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CalendarPlus size={14} /> Horario extra
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">Fecha *</label>
            <input
              type="date"
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {type === "block" && (
            <label className="flex items-center gap-2 text-xs font-semibold text-ink-700 cursor-pointer bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <input
                type="checkbox"
                checked={fullDay}
                onChange={(e) => setFullDay(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 text-lilac-600 rounded border-slate-300 focus:ring-lilac-500"
              />
              Bloquear el día completo
            </label>
          )}

          {(type === "extra" || !fullDay) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">Desde *</label>
                <input
                  type="time"
                  className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">Hasta *</label>
                <input
                  type="time"
                  className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">Motivo (opcional)</label>
            <input
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Vacaciones, feriado, congreso…"
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
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
                <span>Guardar Excepción</span>
              )}
            </button>
          </div>
        </form>
      </StandardModal>

      {/* Modal de confirmación de eliminación */}
      <StandardModal
        isOpen={!!deleteTarget}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        title="Eliminar Excepción"
        subtitle="Esta acción no se puede deshacer"
        icon={<Trash2 size={20} className="text-red-600" />}
        loading={deleteLoading}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-700 leading-relaxed bg-red-50/50 p-3.5 rounded-2xl border border-red-100">
            ¿Estás seguro de que deseas eliminar la excepción para el día{" "}
            <strong>
              {deleteTarget &&
                new Date(deleteTarget.date + "T00:00:00").toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
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
                  <span>Eliminar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </StandardModal>

      {/* Listado */}
      {items.length === 0 ? (
        <div className="card p-6 text-center text-sm text-ink-600">No hay bloqueos próximos.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((ex) => (
            <li key={ex.id} className="card p-3 flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      ex.type === "block" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {ex.type === "block" ? "Bloqueado" : "Horario extra"}
                  </span>
                  <span className="font-medium text-sm">
                    {new Date(ex.date + "T00:00:00").toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="text-xs text-ink-600">
                  {ex.start_time && ex.end_time
                    ? `${ex.start_time.slice(0, 5)} – ${ex.end_time.slice(0, 5)}`
                    : "Día completo"}
                  {ex.reason && ` · ${ex.reason}`}
                </div>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(ex)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-xl transition cursor-pointer"
                  title="Eliminar excepción"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
