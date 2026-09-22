"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, AlertCircle } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { replenishCajaChicaAction } from "@/app/(admin)/erp/caja-chica/actions";

interface BankOption {
  id: string;
  bank_name: string;
  account_number: string | null;
}

interface Props {
  cajaId: string;
  deficit: number;
  sourceAccounts: BankOption[];
}

export default function ReponerCajaChicaModal({
  cajaId,
  deficit,
  sourceAccounts,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [bankId, setBankId] = useState(sourceAccounts[0]?.id || "");
  const [amount, setAmount] = useState(deficit > 0 ? deficit.toFixed(2) : "");
  const [date, setDate] = useState(today);

  function handleOpen() {
    setBankId(sourceAccounts[0]?.id || "");
    setAmount(deficit > 0 ? deficit.toFixed(2) : "");
    setDate(today);
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
      setErrorMsg("Selecciona una cuenta de origen y un monto válido.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await replenishCajaChicaAction({
        caja_id: cajaId,
        bank_id: bankId,
        amount: num,
        date,
      });

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al realizar la reposición.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-green-300 text-green-700 hover:bg-green-50 transition-colors shadow-xs cursor-pointer"
      >
        <RefreshCw size={15} />
        <span>Reponer Caja</span>
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Reponer caja chica"
        subtitle="Inyecta fondos a la Caja Chica desde otra cuenta institucional"
        icon={<RefreshCw size={20} className="text-green-600" />}
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
              Cuenta de origen *
            </label>
            <select
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
              required
              disabled={loading}
              className="w-full border border-green-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
            >
              <option value="">— Seleccionar cuenta origen —</option>
              {sourceAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bank_name}
                  {b.account_number ? ` · ${b.account_number}` : ""}
                </option>
              ))}
            </select>
            {sourceAccounts.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1">
                No hay cuentas bancarias activas disponibles.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Monto *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs font-semibold">
                  $
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="0.00"
                  className="w-full border border-green-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white font-mono"
                />
              </div>
              {deficit > 0 && (
                <p className="text-[11px] text-ink-400 mt-1">
                  Déficit actual: ${deficit.toFixed(2)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Fecha *
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
              disabled={loading || sourceAccounts.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Confirmar Reposición</span>
            </button>
          </div>
        </form>
      </StandardModal>
    </>
  );
}
