"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Stethoscope, Save, AlertCircle, DollarSign } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { addServiceAction } from "@/app/(admin)/erp/servicios/actions";

interface Props {
  existingCategories: string[];
  cashDiscountPercent?: number;
}

export default function NuevoServicioModal({
  existingCategories,
  cashDiscountPercent = 6.0,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [cashPrice, setCashPrice] = useState("");
  const [ivaCode, setIvaCode] = useState("4");

  function handleOpen() {
    setName("");
    setCategory("General");
    setCashPrice("");
    setIvaCode("4");
    setErrorMsg(null);
    setIsOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
  }

  const numCashPrice = Number(cashPrice) || 0;
  const calculatedPvp = numCashPrice > 0 ? numCashPrice / (1 - cashDiscountPercent / 100) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("El nombre del servicio es obligatorio.");
      return;
    }
    if (numCashPrice <= 0) {
      setErrorMsg("Ingresa un precio efectivo válido mayor a cero.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await addServiceAction({
        name: name.trim(),
        cash_price: numCashPrice,
        iva_code: ivaCode,
        category: category.trim() || "General",
      });
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al registrar el servicio.");
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
        <span>Nuevo Servicio</span>
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Nuevo Servicio Clínico"
        subtitle="Agrega un procedimiento o tratamiento al catálogo"
        icon={<Stethoscope size={18} />}
        loading={loading}
        loadingText="Guardando servicio y calculando PVP..."
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
              <Save size={14} /> Guardar Servicio
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              Nombre del servicio <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Profilaxis Dental Profunda, Implante Unitario..."
              className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              Categoría
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="service-categories-list"
              placeholder="Selecciona o escribe una nueva..."
              className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition bg-white"
            />
            <datalist id="service-categories-list">
              {existingCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink-800 mb-1.5">
                Precio Efectivo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm font-bold">$</span>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={cashPrice}
                  onChange={(e) => setCashPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-800 mb-1.5">
                Tarifa IVA <span className="text-red-500">*</span>
              </label>
              <select
                value={ivaCode}
                onChange={(e) => setIvaCode(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition bg-white"
              >
                <option value="4">IVA 15%</option>
                <option value="0">IVA 0%</option>
              </select>
            </div>
          </div>

          {numCashPrice > 0 && (
            <div className="p-3 bg-lilac-50/60 border border-lilac-200/80 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-ink-600 font-medium">PVP Oficial Estimado (Tarjeta):</span>
              <span className="font-bold text-lilac-800 text-sm font-mono">
                ${calculatedPvp.toFixed(2)} USD
              </span>
            </div>
          )}

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
