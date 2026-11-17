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
      `¿Deseas eliminar permanentemente el asiento manual ${entryCode}?\n\nEsta acción revertirá las imputaciones en el Libro Diario y Balances.`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await deleteManualJournalEntryAction(entryId);
      if (!res.success) {
        alert(res.error || "No se pudo eliminar el asiento manual.");
      }
    } catch (err: any) {
      alert(err.message || "Error al eliminar el asiento manual.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      title={`Eliminar Asiento Manual ${entryCode}`}
      className="p-1 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
    </button>
  );
}
