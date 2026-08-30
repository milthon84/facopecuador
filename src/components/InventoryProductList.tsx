"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, ArrowUpRight, ArrowDownRight, X, Save, Loader2, AlertCircle, Layers } from "lucide-react";
import { saveInventoryTransactionAction } from "@/app/(admin)/erp/inventario/actions";

type ProductItem = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  current_stock: number;
  minimum_stock: number;
  unit_of_measure: string;
};

export default function InventoryProductList({
  items,
  canRegisterTx,
  canViewTx,
}: {
  items: ProductItem[];
  canRegisterTx: boolean;
  canViewTx: boolean;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [type, setType] = useState<"entrada" | "salida">("entrada");
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedProduct]);

  function openModal(product: ProductItem) {
    setSelectedProduct(product);
    setType("entrada");
    setQuantity("");
    setReason("");
    setErrorMsg(null);
  }

  function closeModal() {
    if (loading) return;
    setSelectedProduct(null);
    setErrorMsg(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedProduct) return;

    setErrorMsg(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("product_id", selectedProduct.id);
      formData.set("type", type);
      formData.set("quantity", quantity);
      formData.set("reason", reason);

      await saveInventoryTransactionAction(formData);

      router.refresh();
      setSelectedProduct(null);
    } catch (err: any) {
      setErrorMsg(err?.message || "Ocurrió un error al guardar el movimiento.");
      setLoading(false);
    }
  }

  return (
    <>
      <div className="bg-white border border-lilac-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-lilac-50/50 text-ink-600 text-xs uppercase font-semibold">
              <tr>
                <th className="px-5 py-4">Producto</th>
                <th className="px-5 py-4">Categoría</th>
                <th className="px-5 py-4 text-center">Stock Actual</th>
                <th className="px-5 py-4 text-center">Stock Mínimo</th>
                {(canRegisterTx || canViewTx) && <th className="px-5 py-4 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-lilac-50">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-ink-500">
                    <div className="flex flex-col items-center gap-3">
                      <Package size={40} className="text-lilac-200" />
                      <p>No se encontraron productos.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((p) => {
                  const isLow = Number(p.current_stock) <= Number(p.minimum_stock);
                  return (
                    <tr key={p.id} className="hover:bg-lilac-50/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-medium text-ink-900">{p.name}</div>
                        {p.sku && <div className="text-xs text-ink-500 mt-0.5">SKU: {p.sku}</div>}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-lilac-100 text-lilac-700">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold ${isLow ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                          {p.current_stock}
                          <span className="text-[10px] uppercase ml-1 opacity-70 font-semibold">{p.unit_of_measure}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center text-ink-500 font-medium">
                        {p.minimum_stock}
                      </td>
                      {(canRegisterTx || canViewTx) && (
                        <td className="px-5 py-4 text-right">
                          {canRegisterTx ? (
                            <button
                              type="button"
                              onClick={() => openModal(p)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-lilac-700 hover:text-lilac-900 bg-lilac-50 hover:bg-lilac-100 border border-lilac-200 px-3 py-1.5 rounded-xl transition-colors shadow-2xs cursor-pointer"
                            >
                              <span>Registrar</span>
                              <ArrowUpRight size={14} className="shrink-0" />
                            </button>
                          ) : (
                            <Link
                              href={`/erp/inventario/transacciones?product=${p.id}`}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-600 hover:text-ink-800 bg-lilac-50 hover:bg-lilac-100 border border-lilac-200 px-3 py-1.5 rounded-xl transition-colors"
                            >
                              <span>Ver historial</span>
                              <ArrowUpRight size={14} className="shrink-0" />
                            </Link>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Popup Modal con React Portal en document.body (z-[99999]) ──────── */}
      {selectedProduct && mounted && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-md bg-white border border-lilac-100 rounded-3xl shadow-2xl overflow-hidden my-auto animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pantalla Bloqueante de Carga durante Procesamiento */}
            {loading && (
              <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center gap-3 p-6 text-center animate-fade-in">
                <div className="w-12 h-12 rounded-2xl bg-lilac-100 text-lilac-700 flex items-center justify-center shadow-inner">
                  <Loader2 size={26} className="animate-spin text-lilac-600" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-ink-900">Procesando movimiento...</h4>
                  <p className="text-xs text-ink-500 mt-1">Guardando la transacción y actualizando el stock de inventario.</p>
                </div>
              </div>
            )}

            {/* Header del Modal Optimizado */}
            <div className="bg-lilac-50/70 border-b border-lilac-100 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-lilac-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <Layers size={16} />
                </div>
                <h3 className="font-bold text-ink-900 text-base">Movimiento de Inventario</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="w-8 h-8 rounded-full bg-white border border-lilac-200 text-ink-500 hover:bg-lilac-100 flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              
              {/* Tarjeta Destacada del Producto */}
              <div className="bg-lilac-50/50 border border-lilac-100 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-ink-900 capitalize">{selectedProduct.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-ink-500 font-mono mt-0.5">
                      {selectedProduct.sku && <span>SKU: {selectedProduct.sku}</span>}
                      <span>·</span>
                      <span className="font-sans text-lilac-700 bg-lilac-100 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                        {selectedProduct.category}
                      </span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold font-mono shrink-0 ${
                    Number(selectedProduct.current_stock) <= Number(selectedProduct.minimum_stock)
                      ? 'bg-red-100 text-red-700 border border-red-200'
                      : 'bg-green-100 text-green-700 border border-green-200'
                  }`}>
                    {selectedProduct.current_stock} {selectedProduct.unit_of_measure}
                  </div>
                </div>
              </div>

              {/* Error Alert */}
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-red-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Selector de Tipo (Entrada / Salida) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink-700 block">Tipo de Transacción *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType("entrada")}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                      type === "entrada"
                        ? "bg-green-600 border-green-600 text-white shadow-sm"
                        : "bg-white border-lilac-200 text-ink-600 hover:bg-green-50 hover:border-green-200"
                    }`}
                  >
                    <ArrowDownRight size={16} /> Entrada (Ingreso)
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("salida")}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                      type === "salida"
                        ? "bg-red-600 border-red-600 text-white shadow-sm"
                        : "bg-white border-lilac-200 text-ink-600 hover:bg-red-50 hover:border-red-200"
                    }`}
                  >
                    <ArrowUpRight size={16} /> Salida (Egreso)
                  </button>
                </div>
              </div>

              {/* Cantidad */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink-700 block">Cantidad *</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                    className="w-full border border-lilac-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-500 font-semibold uppercase">
                    {selectedProduct.unit_of_measure}
                  </span>
                </div>
              </div>

              {/* Motivo / Observación */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink-700 block">Motivo / Razón *</label>
                <input
                  type="text"
                  required
                  list="motivos-inventario"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej. Uso en clínica, Compra, Ajuste, Merma..."
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
                />
                <datalist id="motivos-inventario">
                  <option value="Uso en consulta / clínica" />
                  <option value="Compra e ingreso de insumo" />
                  <option value="Ajuste de inventario periódico" />
                  <option value="Merma o producto vencido" />
                  <option value="Devolución a proveedor" />
                </datalist>
              </div>

              {/* Botones del Modal */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-lilac-100">
                <button
                  type="button"
                  onClick={closeModal}
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
                  <Save size={15} /> Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
