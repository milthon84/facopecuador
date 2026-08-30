"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Package, Plus, X, Save, Loader2, AlertCircle } from "lucide-react";
import { createInventoryProductAction } from "@/app/(admin)/erp/inventario/actions";

type CategoryOption = { name: string; prefix: string };

export default function ModalNuevoProductItem({
  isOpen,
  onClose,
  categories,
  units,
}: {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryOption[];
  units: string[];
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]?.name || "");
  const [unitOfMeasure, setUnitOfMeasure] = useState<string>("Unidad");
  const [initialStock, setInitialStock] = useState<string>("0");
  const [minimumStock, setMinimumStock] = useState<string>("5");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  // Función para normalizar y desduplicar unidades de medida
  function normalizeUnit(u: string): string {
    const trimmed = (u || "").trim();
    if (/^unidad(es)?$/i.test(trimmed)) return "Unidad";
    if (/^caja(s)?$/i.test(trimmed)) return "Cajas";
    if (/^paquete(s)?$/i.test(trimmed)) return "Paquete";
    if (/^tubo(s)?$/i.test(trimmed)) return "Tubo";
    if (/^frasco(s)?$/i.test(trimmed)) return "Frasco";
    if (/^gramo(s)?(\s*\(g\))?$/i.test(trimmed)) return "Gramos";
    if (/^mililitro(s)?(\s*\(ml\))?$/i.test(trimmed)) return "Mililitros";
    if (/^litro(s)?(\s*\(l\))?$/i.test(trimmed)) return "Litro";
    return trimmed;
  }

  const rawUnits = ["Unidad", "Cajas", "Paquete", "Frasco", "Tubo", "Gramos", "Mililitros", "Litro", ...(units || [])];
  const normalizedUnits = Array.from(new Set(rawUnits.map(normalizeUnit).filter(Boolean)));
  const orderedUnits = [
    "Unidad",
    "Cajas",
    ...normalizedUnits.filter((u) => u !== "Unidad" && u !== "Cajas"),
  ];

  const activeCategoryObj = categories.find((c) => c.name === selectedCategory) || categories[0];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const formEl = e.currentTarget;
      const formData = new FormData(formEl);

      await createInventoryProductAction(formData);

      router.refresh();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al guardar el nuevo insumo.");
      setLoading(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
      onClick={() => !loading && onClose()}
    >
      <div
        className="relative w-full max-w-lg bg-white border border-lilac-100 rounded-3xl shadow-2xl overflow-hidden my-auto animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center gap-3 p-6 text-center animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-lilac-100 text-lilac-700 flex items-center justify-center shadow-inner">
              <Loader2 size={26} className="animate-spin text-lilac-600" />
            </div>
            <div>
              <h4 className="text-base font-bold text-ink-900">Creando insumo...</h4>
              <p className="text-xs text-ink-500 mt-1">Generando código SKU y guardando en inventario.</p>
            </div>
          </div>
        )}

        {/* Modal Header */}
        <div className="bg-lilac-50/70 border-b border-lilac-100 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-lilac-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Plus size={18} />
            </div>
            <h3 className="font-bold text-ink-900 text-base">Nuevo Item Inventario</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-full bg-white border border-lilac-200 text-ink-500 hover:bg-lilac-100 flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Nombre del Insumo */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-ink-700 block">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              autoFocus
              placeholder="Ej. Resina 3M A2, Guantes Nitrilo M, Amalgama"
              className="w-full border border-lilac-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-medium"
            />
          </div>

          {/* Categoría y Prefix */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-ink-700 block">
              Categoría <span className="text-red-500">*</span>
            </label>
            <select
              name="category"
              required
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border border-lilac-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
            >
              {categories.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
            <input type="hidden" name="category_prefix" value={activeCategoryObj?.prefix || "OTR"} />
          </div>

          {/* Unidad de Medida (Unidad por defecto, luego Cajas) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-ink-700 block">
              Unidad de Medida <span className="text-red-500">*</span>
            </label>
            <select
              name="unit_of_measure"
              required
              value={unitOfMeasure}
              onChange={(e) => setUnitOfMeasure(e.target.value)}
              className="w-full border border-lilac-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-semibold"
            >
              {orderedUnits.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Cantidades: Primero Inventario Inicial, después Stock Mínimo */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            
            {/* 1. Inventario Inicial */}
            <div className="space-y-1 bg-green-50/60 border border-green-200 rounded-2xl p-3">
              <label className="text-xs font-bold text-green-900 block">
                Inventario Inicial
              </label>
              <input
                type="number"
                name="initial_stock"
                min="0"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                className="w-full border border-green-300 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white font-mono font-bold text-green-900"
              />
              <p className="text-[11px] text-green-700 leading-tight">Cantidad física en bodega al crear.</p>
            </div>

            {/* 2. Stock Mínimo */}
            <div className="space-y-1 bg-amber-50/60 border border-amber-200 rounded-2xl p-3">
              <label className="text-xs font-bold text-amber-900 block">
                Stock Mínimo
              </label>
              <input
                type="number"
                name="minimum_stock"
                min="0"
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
                className="w-full border border-amber-300 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white font-mono font-bold text-amber-900"
              />
              <p className="text-[11px] text-amber-700 leading-tight">Nivel para alerta de stock bajo.</p>
            </div>

          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-lilac-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-600 hover:bg-lilac-50 border border-lilac-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-5 py-2 rounded-xl transition-colors font-semibold text-xs shadow-md shadow-lilac-200 disabled:opacity-50 cursor-pointer"
            >
              <Save size={15} /> Guardar Insumo
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
