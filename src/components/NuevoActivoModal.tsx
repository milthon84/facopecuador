"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Plus, AlertCircle, Loader2 } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { createAssetAction } from "@/app/(admin)/erp/activos/actions";
import { ASSET_TYPES } from "@/lib/fixed-assets-utils";

interface Props {
  bankAccounts?: any[];
}

export default function NuevoActivoModal({ bankAccounts = [] }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [assetTypeKey, setAssetTypeKey] = useState("equipos_medicos");
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [purchaseValue, setPurchaseValue] = useState("");

  const currentType = ASSET_TYPES[assetTypeKey] || ASSET_TYPES.equipos_medicos;

  function handleOpen() {
    setName("");
    setAssetTypeKey("equipos_medicos");
    setPurchaseDate(today);
    setPurchaseValue("");
    setErrorMsg(null);
    setIsOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = Number(purchaseValue);
    if (!name.trim() || val <= 0 || !purchaseDate) {
      setErrorMsg("Completa los campos obligatorios (*) y un valor de compra válido.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await createAssetAction({
        name: name.trim(),
        asset_type: assetTypeKey,
        purchase_date: purchaseDate,
        purchase_value: val,
        salvage_value: 0,
        useful_life_years: currentType.years,
      });

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al registrar el activo fijo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors shadow-md shadow-lilac-200 shrink-0 cursor-pointer"
      >
        <Plus size={16} />
        <span>Registrar activo</span>
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Registrar Activo Fijo"
        subtitle="Ingresa el bien. La cuenta del Plan de Cuentas define su código, vida útil y porcentaje de depreciación."
        icon={<Landmark size={20} className="text-lilac-600" />}
        loading={loading}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Nombre del Activo */}
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Nombre o Descripción del Activo *
            </label>
            <input
              type="text"
              required
              disabled={loading}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Sillón Odontológico Gnatus S300, Laptop MacBook Pro M3..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 focus:bg-white"
            />
          </div>

          {/* Cuenta de Activo Fijo (Plan de Cuentas) */}
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Cuenta de Activo Fijo (Plan de Cuentas) *
            </label>
            <select
              value={assetTypeKey}
              onChange={(e) => setAssetTypeKey(e.target.value)}
              disabled={loading}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-medium text-ink-900 focus:bg-white cursor-pointer"
            >
              {Object.entries(ASSET_TYPES).map(([k, t]) => (
                <option key={k} value={k}>
                  {t.label} ({t.years} años · {t.percentage}%)
                </option>
              ))}
            </select>
          </div>

          {/* Ficha Informativa Automática de Depreciación y Contabilidad */}
          <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold bg-purple-200/70 text-purple-900 px-2 py-0.5 rounded-md border border-purple-300">
                  Código: {currentType.prefix}-XXXX
                </span>
                <span className="text-[11px] font-semibold text-purple-700">
                  (Secuencial automático)
                </span>
              </div>
              <span className="font-bold text-purple-950 bg-white px-2 py-0.5 rounded-md border border-purple-200">
                {currentType.percentage}% Anual
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] border-t border-purple-100 text-purple-900">
              <div>
                <span className="text-purple-600 block">Vida Útil Tributaria:</span>
                <strong className="text-purple-950">{currentType.years} años</strong> (Línea recta)
              </div>
              <div>
                <span className="text-purple-600 block">Cuenta de Activo:</span>
                <strong className="text-purple-950">{currentType.accountCode} · {currentType.accountName}</strong>
              </div>
              <div className="col-span-2">
                <span className="text-purple-600 inline mr-1">Gasto de Depreciación:</span>
                <strong className="text-purple-950">{currentType.depExpCode} · {currentType.depExpName}</strong>
              </div>
            </div>
          </div>

          {/* Fecha y Valor de Compra */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Fecha de Adquisición / Registro *
              </label>
              <input
                type="date"
                required
                disabled={loading}
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Valor del Activo ($ Costo) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs font-semibold">
                  $
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  disabled={loading}
                  value={purchaseValue}
                  onChange={(e) => setPurchaseValue(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono font-bold text-ink-900 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
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
              className="flex items-center gap-1.5 px-5 py-2.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Guardando Activo...</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Guardar Activo Fijo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </StandardModal>
    </>
  );
}
