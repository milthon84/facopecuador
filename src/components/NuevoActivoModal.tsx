"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Plus, AlertCircle, Loader2, DollarSign } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { createAssetAction } from "@/app/(admin)/erp/activos/actions";

const ASSET_CATEGORIES = [
  { label: "Inmuebles", years: 20 },
  { label: "Equipos odontológicos", years: 10 },
  { label: "Equipos de computación", years: 3 },
  { label: "Muebles y enseres", years: 10 },
  { label: "Vehículos", years: 5 },
  { label: "Otros equipos y maquinaria", years: 10 },
];

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string | null;
}

interface Props {
  bankAccounts: BankAccount[];
}

export default function NuevoActivoModal({ bankAccounts }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(ASSET_CATEGORIES[1].label);
  const [usefulLife, setUsefulLife] = useState(ASSET_CATEGORIES[1].years);
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [purchaseValue, setPurchaseValue] = useState("");
  const [salvageValue, setSalvageValue] = useState("0");
  const [bankAccountId, setBankAccountId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierRuc, setSupplierRuc] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [description, setDescription] = useState("");

  function handleOpen() {
    setName("");
    setCategory(ASSET_CATEGORIES[1].label);
    setUsefulLife(ASSET_CATEGORIES[1].years);
    setPurchaseDate(today);
    setPurchaseValue("");
    setSalvageValue("0");
    setBankAccountId("");
    setPaymentReference("");
    setSupplierName("");
    setSupplierRuc("");
    setInvoiceNumber("");
    setDescription("");
    setErrorMsg(null);
    setIsOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
  }

  function handleCategoryChange(catLabel: string) {
    setCategory(catLabel);
    const cat = ASSET_CATEGORIES.find((c) => c.label === catLabel);
    if (cat) setUsefulLife(cat.years);
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
        category,
        useful_life_years: Number(usefulLife),
        purchase_date: purchaseDate,
        purchase_value: val,
        salvage_value: Number(salvageValue || 0),
        bank_account_id: bankAccountId || null,
        payment_reference: paymentReference.trim() || null,
        supplier_name: supplierName.trim() || null,
        supplier_ruc: supplierRuc.trim() || null,
        invoice_number: invoiceNumber.trim() || null,
        description: description.trim() || null,
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
        subtitle="Ingresa la información de adquisición, depreciación y compra"
        icon={<Landmark size={20} className="text-lilac-600" />}
        loading={loading}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Nombre del activo *
              </label>
              <input
                type="text"
                required
                disabled={loading}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Sillón Odontológico Gnatus S300"
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Categoría del bien *
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                disabled={loading}
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
              >
                {ASSET_CATEGORIES.map((c) => (
                  <option key={c.label} value={c.label}>
                    {c.label} ({c.years} años)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Vida útil (años) *
              </label>
              <input
                type="number"
                min="1"
                required
                disabled={loading}
                value={usefulLife}
                onChange={(e) => setUsefulLife(Number(e.target.value))}
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Fecha de adquisición *
              </label>
              <input
                type="date"
                required
                disabled={loading}
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Valor de compra ($) *
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
                  className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Valor residual / salvamento ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs font-semibold">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={loading}
                  value={salvageValue}
                  onChange={(e) => setSalvageValue(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Forma de pago / Cuenta
              </label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                disabled={loading}
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
              >
                <option value="">A crédito (sin pago bancario ahora)</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name}
                    {b.account_number ? ` · ${b.account_number}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {bankAccountId && (
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Referencia de pago
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  disabled={loading}
                  placeholder="N° cheque, transferencia..."
                  className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Proveedor
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                disabled={loading}
                placeholder="Nombre de la empresa o persona"
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                RUC Proveedor
              </label>
              <input
                type="text"
                value={supplierRuc}
                onChange={(e) => setSupplierRuc(e.target.value)}
                disabled={loading}
                placeholder="1790012345001"
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                N° Factura
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                disabled={loading}
                placeholder="001-002-000123456"
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Descripción / Detalles
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                placeholder="Marca, modelo, número de serie, ubicación..."
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 resize-none"
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
