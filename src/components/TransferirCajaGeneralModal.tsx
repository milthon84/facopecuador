"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { transferFromCajaGeneralAction } from "@/app/(admin)/erp/caja-general/actions";

interface Destino {
  id: string;
  label: string;
  type: string;
}

interface Props {
  cajaId: string;
  maxBalance: number;
  destinos: Destino[];
}

export default function TransferirCajaGeneralModal({
  cajaId,
  maxBalance,
  destinos,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [destinoId, setDestinoId] = useState(destinos[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  function handleOpen() {
    setDestinoId(destinos[0]?.id || "");
    setAmount("");
    setDate(today);
    setReference("");
    setNotes("");
    setErrorMsg(null);
    setIsOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!destinoId || numAmount <= 0) {
      setErrorMsg("Selecciona una cuenta bancaria y un monto válido mayor a cero.");
      return;
    }
    if (maxBalance > 0 && numAmount > maxBalance) {
      setErrorMsg(`El monto no puede superar el saldo disponible en caja de $${maxBalance.toFixed(2)}.`);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await transferFromCajaGeneralAction({
        caja_id: cajaId,
        destino_id: destinoId,
        amount: numAmount,
        date,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al realizar el depósito.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={maxBalance <= 0}
        title={maxBalance <= 0 ? "No hay saldo disponible en caja para depositar" : "Depositar efectivo en banco"}
        className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm bg-green-600 hover:bg-green-700 text-white shadow-md transition-all shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98]"
      >
        <Building2 size={16} />
        <span>Depositar en banco</span>
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Depositar efectivo en banco"
        subtitle="Mueve el dinero de Caja General hacia una cuenta bancaria y genera automáticamente su asiento contable NIIF"
        icon={<Building2 size={20} className="text-green-600" />}
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

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Cuenta bancaria de destino *
            </label>
            <select
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              required
              disabled={loading}
              className="w-full border border-green-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
            >
              <option value="">— Seleccionar banco —</option>
              {destinos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-ink-700">
                  Monto a depositar *
                </label>
                {maxBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(maxBalance))}
                    className="text-[10px] text-green-700 hover:underline font-semibold cursor-pointer"
                  >
                    Todo
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs font-semibold">
                  $
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={maxBalance > 0 ? maxBalance : undefined}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="0.00"
                  className="w-full border border-green-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white font-mono"
                />
              </div>
              <p className="text-[11px] text-ink-400 mt-1">
                Disponible: ${maxBalance.toFixed(2)}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Fecha del depósito *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                disabled={loading}
                className="w-full border border-green-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              N° Comprobante / Papeleta de depósito
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={loading}
              placeholder="Ej. N° depósito, transferencia..."
              className="w-full border border-green-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Observaciones / Notas (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              placeholder="Ej. Cierre de caja, depósito recaudación semanal..."
              className="w-full border border-green-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
            />
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span>Asiento Contable NIIF Automático</span>
            </div>
            <p className="text-[11px] leading-relaxed text-emerald-700">
              Al confirmar, el sistema registrará el depósito y creará automáticamente el asiento en el Libro Diario: 
              <strong> Débito</strong> a Bancos (1.1.01.03) y <strong>Crédito</strong> a Caja General (1.1.01.01).
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Procesando depósito...</span>
                </>
              ) : (
                <>
                  <Building2 size={14} />
                  <span>Confirmar Depósito</span>
                </>
              )}
            </button>
          </div>
        </form>
      </StandardModal>
    </>
  );
}
