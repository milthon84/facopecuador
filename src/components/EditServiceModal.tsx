"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Stethoscope, Save, AlertCircle } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { updateServiceAction } from "@/app/(admin)/erp/servicios/actions";

interface Props {
  service: {
    id: string;
    name: string;
    price: number;
    iva_code: string;
    category: string;
  };
  existingCategories: string[];
  cashDiscountPercent?: number;
}

export default function EditServiceModal({
  service,
  existingCategories,
  cashDiscountPercent = 6.0,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const initialCashPrice = (Number(service.price) * (1 - cashDiscountPercent / 100)).toFixed(2);

  const [name, setName] = useState(service.name);
  const [category, setCategory] = useState(service.category);
  const [cashPrice, setCashPrice] = useState(initialCashPrice);
  const [ivaCode, setIvaCode] = useState(service.iva_code);

  function handleOpen() {
    setName(service.name);
    setCategory(service.category);
    setCashPrice((Number(service.price) * (1 - cashDiscountPercent / 100)).toFixed(2));
    setIvaCode(service.iva_code);
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
      await updateServiceAction({
        id: service.id,
        name: name.trim(),
        cash_price: numCashPrice,
        iva_code: ivaCode,
        category: category.trim() || "General",
      });
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al actualizar el servicio.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="p-1.5 text-lilac-600 hover:text-lilac-800 hover:bg-lilac-100 rounded-lg transition cursor-pointer"
        title="Editar servicio"
      >
        <Pencil size={13} />
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Modificar Servicio Clínico"
        subtitle="Actualiza tarifas, categoría o descripción del procedimiento"
        icon={<Stethoscope size={18} />}
        loading={loading}
        loadingText="Actualizando servicio y recalculando PVP..."
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
              <Save size={14} /> Guardar Cambios
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
              list="service-edit-categories-list"
              className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition bg-white"
            />
            <datalist id="service-edit-categories-list">
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
              <span className="text-ink-600 font-medium">PVP Oficial Recalculado:</span>
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
