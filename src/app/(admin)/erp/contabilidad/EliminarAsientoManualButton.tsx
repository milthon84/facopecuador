"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteManualJournalEntryAction } from "./actions";

interface Props {
  entryId: string;
  entryCode: string;
  isPeriodClosed: boolean;
}

export default function EliminarAsientoManualButton({ entryId, entryCode, isPeriodClosed }: Props) {
  const [loading, setLoading] = useState(false);

  if (isPeriodClosed) {
    return (
      <span
        title="No se puede eliminar: el período contable está cerrado"
        className="text-gray-300 cursor-not-allowed p-1 inline-flex items-center"
      >
        <Trash2 size={13} />
      </span>
    );
  }

  async function handleDelete() {
    const ok = window.confirm(
      `¿Deseas anular y revertir el asiento manual ${entryCode}?\n\nEsta acción eliminará el asiento del Libro Diario y revertirá su saldo en el Libro Mayor y Balances.`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await deleteManualJournalEntryAction(entryId);
      if (!res.success) {
        alert(res.error || "No se pudo anular el asiento manual.");
      }
    } catch (err: any) {
      alert(err.message || "Error al anular el asiento manual.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      title={`Anular asiento manual ${entryCode}`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 border border-red-200 transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
      <span>Anular</span>
    </button>
  );
}
