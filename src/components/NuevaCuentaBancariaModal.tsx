"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Landmark, Save, AlertCircle } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { createBankAccountAction } from "@/app/(admin)/erp/bancos/actions";

const BANKS_EC = [
  "Banco Pichincha",
  "Banco Guayaquil",
  "Produbanco",
  "Banco del Pacífico",
  "Banco Internacional",
  "Banco Bolivariano",
  "Banco Solidario",
  "Banco General Rumiñahui",
  "Banco del Austro",
  "Cooperativa JEP",
  "Cooperativa 29 de Octubre",
  "Mutualista Pichincha",
];

interface Props {
  canAddCaja?: boolean;
}

export default function NuevaCuentaBancariaModal({ canAddCaja = true }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("corriente");
  const [initialBalance, setInitialBalance] = useState("");
  const [notes, setNotes] = useState("");

  function handleOpen() {
    setBankName("");
    setAccountNumber("");
    setAccountType("corriente");
    setInitialBalance("");
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
    if (!bankName.trim()) {
      setErrorMsg("El nombre del banco o institución es obligatorio.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await createBankAccountAction({
        bank_name: bankName.trim(),
        account_number: accountNumber.trim() || null,
        account_type: accountType,
        initial_balance: Number(initialBalance || 0),
        notes: notes.trim() || null,
      });
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "No se pudo registrar la cuenta bancaria.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
      >
        <Plus size={16} />
        <span>Nueva Cuenta</span>
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Nueva Cuenta Bancaria / Caja"
        subtitle="Agrega una entidad financiera o fondo de caja para control contable"
        icon={<Landmark size={18} />}
        loading={loading}
        loadingText="Registrando cuenta bancaria y balance inicial..."
        footer={
          <>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-ink-600 hover:bg-lilac-100 transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-lilac-600 hover:bg-lilac-700 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              <Save size={14} /> Guardar Cuenta
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              Tipo de Cuenta <span className="text-red-500">*</span>
            </label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition bg-white"
            >
              <option value="corriente">Cuenta Corriente</option>
              <option value="ahorros">Cuenta de Ahorros</option>
              {canAddCaja && <option value="caja">Caja / Efectivo</option>}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              Banco o Entidad <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              list="bancos-ec-list"
              placeholder="Ej: Banco Pichincha, Banco Guayaquil..."
              className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition"
              autoFocus
            />
            <datalist id="bancos-ec-list">
              {BANKS_EC.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>

          {accountType !== "caja" && (
            <div>
              <label className="block text-xs font-bold text-ink-800 mb-1.5">
                Número de Cuenta
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Ej: 2200123456"
                className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              Saldo Inicial ($)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm font-bold">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              Notas u Observaciones (Opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles sobre uso o titular de la cuenta..."
              className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition resize-none"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </form>
      </StandardModal>
    </>
  );
}
