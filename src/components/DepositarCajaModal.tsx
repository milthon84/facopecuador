"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, AlertCircle, Building2 } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { transferFromCajaAction } from "@/app/(admin)/erp/bancos/actions";

interface Props {
  cajaId: string;
  bankAccounts: { id: string; bank_name: string; account_number: string | null }[];
}

export default function DepositarCajaModal({ cajaId, bankAccounts }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [bankId, setBankId] = useState(bankAccounts[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState("");

  function handleOpen() {
    setBankId(bankAccounts[0]?.id || "");
    setAmount("");
    setDate(today);
    setReference("");
    setErrorMsg(null);
    setIsOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(amount);
    if (!bankId || num <= 0) {
      setErrorMsg("Selecciona un banco y especifica un monto mayor a cero.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await transferFromCajaAction({
        caja_id: cajaId,
        bank_id: bankId,
        amount: num,
        date,
        reference: reference.trim() || null,
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
        className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200 transition-colors shrink-0 cursor-pointer"
      >
        <TrendingUp size={16} />
        <span>Depositar en banco</span>
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Depositar efectivo en banco"
        subtitle="Mueve dinero de Caja General hacia una cuenta bancaria institucional"
        icon={<Building2 size={20} />}
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
              Cuenta bancaria destino *
            </label>
            <select
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
              disabled={loading}
              required
              className="w-full border border-green-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
            >
              <option value="">— Seleccionar banco —</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bank_name}
                  {b.account_number ? ` · ${b.account_number}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Monto *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm font-semibold">
                  $
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading}
                  required
                  placeholder="0.00"
                  className="w-full border border-green-200 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Fecha *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={loading}
                required
                className="w-full border border-green-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              N° Referencia / Comprobante
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={loading}
              placeholder="N° depósito, comprobante bancario..."
              className="w-full border border-green-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white font-mono"
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
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <TrendingUp size={15} />
              <span>{loading ? "Procesando..." : "Confirmar Depósito"}</span>
            </button>
          </div>
        </form>
      </StandardModal>
    </>
  );
}
