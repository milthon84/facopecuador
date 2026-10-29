"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Plus, AlertCircle, UserCheck } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { setupCajaChicaAction } from "@/app/(admin)/erp/caja-chica/actions";

export default function SetupCajaChicaModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [bankName, setBankName] = useState("Caja Chica Principal");
  const [initialBalance, setInitialBalance] = useState("100");
  const [responsableNombre, setResponsableNombre] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [responsableBanco, setResponsableBanco] = useState("Banco Pichincha");
  const [responsableCuenta, setResponsableCuenta] = useState("");

  function handleOpen() {
    setBankName("Caja Chica Principal");
    setInitialBalance("100");
    setResponsableNombre("");
    setResponsableId("");
    setResponsableBanco("Banco Pichincha");
    setResponsableCuenta("");
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
      setErrorMsg("El nombre de la caja chica es obligatorio.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await setupCajaChicaAction({
        bank_name: bankName.trim(),
        initial_balance: Number(initialBalance) || 0,
        responsable: responsableNombre.trim()
          ? {
              nombre: responsableNombre.trim(),
              identificacion: responsableId.trim(),
              banco: responsableBanco.trim(),
              cuenta: responsableCuenta.trim(),
              tipo_cuenta: "Ahorros",
            }
          : null,
      });

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al configurar la caja chica.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors cursor-pointer shadow-md shadow-lilac-200"
      >
        <Plus size={16} />
        <span>Configurar Caja Chica</span>
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Configurar Caja Chica"
        subtitle="Establece el nombre, fondo inicial y custodio responsable"
        icon={<Wallet size={20} className="text-lilac-600" />}
        loading={loading}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {errorMsg && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Nombre de la Caja Chica *
            </label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              required
              disabled={loading}
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Fondo inicial ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs font-semibold">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                disabled={loading}
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono"
              />
            </div>
          </div>

          {/* Custodio Responsable */}
          <div className="pt-2 border-t border-lilac-100 space-y-2.5">
            <span className="text-[11px] font-bold text-ink-600 uppercase tracking-wider flex items-center gap-1">
              <UserCheck size={13} className="text-lilac-600" /> Custodio Responsable (opcional)
            </span>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Nombre del Responsable
              </label>
              <input
                type="text"
                value={responsableNombre}
                onChange={(e) => setResponsableNombre(e.target.value)}
                placeholder="Ej. Milton Aguilera"
                disabled={loading}
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  CI / Identificación
                </label>
                <input
                  type="text"
                  value={responsableId}
                  onChange={(e) => setResponsableId(e.target.value)}
                  placeholder="1790483851"
                  disabled={loading}
                  className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  N° Cuenta Depósito
                </label>
                <input
                  type="text"
                  value={responsableCuenta}
                  onChange={(e) => setResponsableCuenta(e.target.value)}
                  placeholder="2201928374"
                  disabled={loading}
                  className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono"
                />
              </div>
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
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Plus size={16} />
              <span>Crear Caja Chica</span>
            </button>
          </div>
        </form>
      </StandardModal>
    </>
  );
}
