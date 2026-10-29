"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, AlertCircle, Building2, User, FileText, CheckCircle2 } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { replenishCajaChicaAction } from "@/app/(admin)/erp/caja-chica/actions";
import { ResponsableCajaChica } from "@/lib/caja-chica-types";

interface BankOption {
  id: string;
  bank_name: string;
  account_number: string | null;
}

interface Props {
  cajaId: string;
  cajaName?: string;
  deficit: number;
  sourceAccounts: BankOption[];
  responsable?: ResponsableCajaChica | null;
}

export default function ReponerCajaChicaModal({
  cajaId,
  cajaName = "Caja Chica",
  deficit,
  sourceAccounts,
  responsable,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [bankId, setBankId] = useState(sourceAccounts[0]?.id || "");
  const [amount, setAmount] = useState(deficit > 0 ? deficit.toFixed(2) : "");
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState("");

  function handleOpen() {
    setBankId(sourceAccounts[0]?.id || "");
    setAmount(deficit > 0 ? deficit.toFixed(2) : "");
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
      setErrorMsg("Selecciona una cuenta bancaria de Niagas y un monto válido.");
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
        reference: reference.trim() || null,
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
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-green-300 text-green-700 hover:bg-green-50 transition-colors shadow-2xs cursor-pointer"
      >
        <RefreshCw size={14} />
        <span>Reponer Caja</span>
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Reponer Caja Chica"
        subtitle={`Transferencia para reposición de fondo fijo en ${cajaName}`}
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

          {/* Tarjeta del Custodio Responsable donde se deposita */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-1.5 text-xs text-emerald-950">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-800 flex items-center gap-1">
                <User size={12} /> Destinatario / Responsable a Depositar
              </span>
              <span className="text-[10px] font-bold bg-emerald-200/70 text-emerald-900 px-2 py-0.2 rounded-full">
                Vía Transferencia
              </span>
            </div>

            {responsable?.nombre ? (
              <div className="pt-0.5 space-y-0.5">
                <p className="font-bold text-sm text-ink-900">{responsable.nombre}</p>
                {responsable.identificacion && (
                  <p className="text-[11px] text-ink-600 font-mono">
                    CI / RUC: {responsable.identificacion}
                  </p>
                )}
                {responsable.cuenta && (
                  <p className="text-[11px] text-emerald-900 font-mono font-medium">
                    Cuenta: {responsable.banco || "Banco"} ({responsable.tipo_cuenta || "Ahorros"}) · {responsable.cuenta}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-amber-800 bg-amber-50/80 p-2 rounded-lg border border-amber-200 mt-1">
                <p className="text-[11px]">
                  ⚠️ Aún no se ha registrado un custodio con cuenta bancaria personal para esta caja chica. Puedes asignarlo desde la pantalla principal de Caja Chica.
                </p>
              </div>
            )}
          </div>

          {/* Cuenta Origen institucional de Niagas */}
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1 flex items-center gap-1">
              <Building2 size={13} className="text-green-600" /> Cuenta de origen Niagas *
            </label>
            <select
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
              required
              disabled={loading}
              className="w-full border border-green-200 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white font-medium"
            >
              <option value="">— Seleccionar cuenta bancaria de Niagas —</option>
              {sourceAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bank_name}
                  {b.account_number ? ` · ${b.account_number}` : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-ink-400 mt-1">
              ℹ️ Las reposiciones solo pueden salir por transferencia desde cuentas bancarias de Niagas (no desde Caja General).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Monto de reposición *
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
                  className="w-full border border-green-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white font-mono font-bold"
                />
              </div>
              {deficit > 0 && (
                <p className="text-[11px] text-ink-500 mt-1 font-mono">
                  Déficit: ${deficit.toFixed(2)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Fecha de transferencia *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                disabled={loading}
                className="w-full border border-green-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
              />
            </div>
          </div>

          {/* Referencia o N° de Comprobante de Transferencia */}
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1 flex items-center gap-1">
              <FileText size={12} className="text-ink-400" /> N° de Transferencia / Comprobante
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej. TRF-12345678 o N° de comprobante bancario"
              disabled={loading}
              className="w-full border border-green-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-400 bg-white font-mono"
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
              disabled={loading || sourceAccounts.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Confirmar Transferencia</span>
            </button>
          </div>
        </form>
      </StandardModal>
    </>
  );
}
