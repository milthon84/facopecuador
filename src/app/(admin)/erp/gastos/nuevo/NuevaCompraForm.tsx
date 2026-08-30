"use client";

import { useState } from "react";
import { Save } from "lucide-react";

const CATEGORIES = [
  "Insumos dentales", "Equipos", "Arriendo", "Servicios básicos",
  "Salarios", "Suministros oficina", "Mantenimiento", "Publicidad", "Otros",
];

type Account = { id: string; bank_name: string; account_number: string | null; account_type: string; notes?: string | null };

type SupplierItem = { ruc: string; name: string };

interface Props {
  today: string;
  bankAccounts: Account[];
  cajaAccounts: Account[];
  knownSuppliersList?: SupplierItem[];
  initialData?: any;
  saveExpense: (formData: FormData) => Promise<void>;
}

export default function NuevaCompraForm({ today, bankAccounts, cajaAccounts, knownSuppliersList = [], initialData, saveExpense }: Props) {
  const isEditing = Boolean(initialData?.id);
  const [method, setMethod] = useState(initialData?.payment_method || "efectivo");
  const [docType, setDocType] = useState(
    initialData
      ? (initialData.document_number ? "factura" : "sin_documento")
      : "factura"
  );
  const [subtotal, setSubtotal] = useState<number | string>(
    initialData ? (Number(initialData.subtotal_0 || 0) + Number(initialData.subtotal_15 || 0)) : 0
  );
  const [ivaAmount, setIvaAmount] = useState<number | string>(initialData?.iva_amount ?? 0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [supplierRuc, setSupplierRuc] = useState(initialData?.supplier_ruc || "");
  const [supplierName, setSupplierName] = useState(initialData?.supplier_name || "");

  function handleRucChange(val: string) {
    setSupplierRuc(val);
    const cleanRuc = val.trim();
    if (cleanRuc) {
      const match = knownSuppliersList.find((s) => s.ruc === cleanRuc);
      if (match) {
        setSupplierName(match.name);
      }
    }
  }

  const numSubtotal = Number(subtotal) || 0;
  const numIva = Number(ivaAmount) || 0;
  const calculatedTotal = Math.round((numSubtotal + numIva) * 100) / 100;

  const needsAccount   = method === "efectivo" || method === "transferencia";
  const needsReference = method === "transferencia";
  const accountOptions = method === "efectivo" ? cajaAccounts : bankAccounts;
  const accountLabel   = method === "efectivo" ? "Caja chica" : "Cuenta bancaria destino";

  const isSinDocumento = docType === "sin_documento";

  function handleAutoCalcIva() {
    if (numSubtotal > 0) {
      const calc = Math.round(numSubtotal * 0.15 * 100) / 100;
      setIvaAmount(calc.toFixed(2));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      await saveExpense(formData);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al guardar el gasto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      {isEditing && <input type="hidden" name="id" value={initialData.id} />}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-xl font-medium">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Tipo de Comprobante */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-ink-700">Tipo de Comprobante *</label>
        <select
          value={docType}
          onChange={(e) => {
            const val = e.target.value;
            setDocType(val);
            if (val !== "factura") setIvaAmount(0);
          }}
          className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-medium"
        >
          <option value="factura">Factura</option>
          <option value="nota_venta">Nota de Venta</option>
          <option value="sin_documento">Sin Documento / Gasto Directo</option>
        </select>
      </div>

      {/* RUC / Cédula (PRIMERO) + Proveedor / Beneficiario */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-700">
            {isSinDocumento ? "RUC / Cédula (opcional)" : "RUC / Cédula *"}
          </label>
          <input
            name="supplier_ruc"
            maxLength={13}
            value={supplierRuc}
            onChange={(e) => handleRucChange(e.target.value)}
            list="suppliers-list"
            placeholder="0000000000001"
            className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono"
          />
          <datalist id="suppliers-list">
            {knownSuppliersList.map((s) => (
              <option key={s.ruc} value={s.ruc}>
                {s.name}
              </option>
            ))}
          </datalist>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-700">
            {isSinDocumento ? "Concepto / Beneficiario *" : "Proveedor / Beneficiario *"}
          </label>
          <input
            name="supplier_name"
            required
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder={isSinDocumento ? "Ej. Taxi, Almuerzo, Caja Chica" : "Nombre del proveedor"}
            className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
          />
        </div>
      </div>

      {/* Factura / Documento + Fecha */}
      <div className="grid grid-cols-2 gap-3">
        {!isSinDocumento ? (
          <>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">
                N° {docType === "factura" ? "Factura" : "Nota de Venta"} (opcional)
              </label>
              <input
                name="document_number"
                defaultValue={initialData?.document_number || ""}
                placeholder={docType === "factura" ? "001-001-000000001" : "001-001-000001"}
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Fecha *</label>
              <input
                type="date"
                name="expense_date"
                required
                defaultValue={initialData?.expense_date || today}
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
              />
            </div>

            {docType === "factura" && (
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-semibold text-ink-700">
                  N° de Autorización / Clave de Acceso SRI (opcional)
                </label>
                <input
                  name="authorization_number"
                  maxLength={49}
                  defaultValue={initialData?.authorization_number || ""}
                  placeholder="Ej: 3008202601179234567800120010010000000011234567819 (10 a 49 dígitos)"
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono text-xs"
                />
              </div>
            )}
          </>
        ) : (
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-semibold text-ink-700">Fecha *</label>
            <input
              type="date"
              name="expense_date"
              required
              defaultValue={initialData?.expense_date || today}
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
            />
            {/* Input oculto para document_number */}
            <input type="hidden" name="document_number" value="" />
          </div>
        )}
      </div>

      {/* Categoría + Descripción */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-700">Categoría *</label>
          <select
            name="category"
            required
            defaultValue={initialData?.category || CATEGORIES[0]}
            className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-700">Descripción</label>
          <input
            name="description"
            defaultValue={initialData?.description || ""}
            placeholder="Detalle del gasto"
            className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
          />
        </div>
      </div>

      {/* Montos y Totales */}
      <div className="bg-lilac-50/40 border border-lilac-100 rounded-xl p-3.5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-700">
              Monto Sin IVA / Subtotal ($) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">$</span>
              <input
                type="number"
                name="subtotal_0"
                min="0"
                step="0.01"
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
                placeholder="0.00"
                className="w-full border border-lilac-200 rounded-xl pl-7 pr-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono font-semibold text-ink-900"
              />
            </div>
            <p className="text-[11px] text-ink-500">
              Valor neto o subtotal sin impuestos
            </p>
          </div>

          {docType === "factura" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-ink-700">IVA ($)</label>
                {numSubtotal > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoCalcIva}
                    className="text-[10px] text-lilac-600 hover:underline font-semibold"
                  >
                    + Calc 15%
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">$</span>
                <input
                  type="number"
                  name="iva_amount"
                  min="0"
                  step="0.01"
                  value={ivaAmount}
                  onChange={(e) => setIvaAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-lilac-200 rounded-xl pl-7 pr-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono"
                />
              </div>
              <p className="text-[11px] text-ink-500">Monto del IVA (si aplica en factura)</p>
            </div>
          )}
          {docType !== "factura" && (
            <input type="hidden" name="iva_amount" value="0" />
          )}
        </div>

        {/* Resumen en vivo */}
        <div className="flex items-center justify-between pt-2.5 border-t border-lilac-200/60 text-xs flex-wrap gap-2">
          <div className="flex gap-4 text-ink-600 flex-wrap">
            {numSubtotal > 0 && <span>Subtotal: <strong>${numSubtotal.toFixed(2)}</strong></span>}
            {numIva > 0 && <span>+ IVA: <strong className="text-lilac-700">${numIva.toFixed(2)}</strong></span>}
          </div>
          <div className="text-right ml-auto">
            <span className="text-xs font-semibold text-ink-600 mr-2">TOTAL A PAGAR:</span>
            <span className="text-base font-bold text-lilac-700">${calculatedTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* ── Forma de pago — al final ────────────────────────────────────── */}
      <div className="border border-lilac-200 rounded-xl p-3 bg-white space-y-3">
        <p className="text-xs font-bold text-ink-600 uppercase tracking-wide">Forma de Pago</p>

        {/* Selector de método */}
        <div className="flex flex-wrap gap-2">
          {[
            { value: "efectivo",        label: "💵 Efectivo" },
            { value: "transferencia",   label: "🏦 Transferencia" },
            { value: "tarjeta_credito", label: "💳 Tarjeta" },
          ].map(m => (
            <button key={m.value} type="button"
              onClick={() => setMethod(m.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                method === m.value
                  ? "bg-lilac-600 text-white border-lilac-600"
                  : "bg-white text-ink-600 border-lilac-200 hover:border-lilac-400"
              }`}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Hidden input del método */}
        <input type="hidden" name="payment_method" value={method} />

        {/* Cuenta (caja chica o banco) */}
        {needsAccount && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-700">{accountLabel} *</label>
            <select
              name="bank_account_id"
              required
              defaultValue={initialData?.bank_account_id || ""}
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
            >
              <option value="">— Seleccionar —</option>
              {accountOptions.map(a => (
                <option key={a.id} value={a.id}>
                  {a.bank_name}{a.account_number ? ` · ${a.account_number}` : ""}{a.notes ? ` (${a.notes})` : ""}
                </option>
              ))}
            </select>
            {accountOptions.length === 0 && (
              <p className="text-[11px] text-amber-600">
                {method === "efectivo"
                  ? <a href="/erp/caja-chica" className="underline">Configura la caja chica</a>
                  : <a href="/erp/bancos" className="underline">Registra una cuenta bancaria</a>}
              </p>
            )}
          </div>
        )}

        {/* N° Referencia (transferencia) */}
        {needsReference && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-700">
              N° Referencia / Comprobante *
            </label>
            <input type="text" name="payment_reference"
              required
              defaultValue={initialData?.payment_reference || ""}
              placeholder="TRF-001234"
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono" />
          </div>
        )}

        {/* Detalles de Tarjeta */}
        {method === "tarjeta_credito" && (
          <div className="space-y-3 mt-1">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Tipo de Tarjeta *</label>
              <input type="text" name="card_type" required list="tarjetas-ec"
                placeholder="Ej. Visa, Mastercard..."
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white" />
              <datalist id="tarjetas-ec">
                <option value="Visa" />
                <option value="Mastercard" />
                <option value="American Express" />
                <option value="Diners Club" />
                <option value="Discover" />
                <option value="Alia" />
                <option value="PacifiCard" />
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">N° Lote *</label>
                <input type="text" name="card_lote" required placeholder="0012"
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">N° Baucher / Autorización *</label>
                <input type="text" name="card_voucher" required placeholder="000123"
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono" />
              </div>
            </div>
          </div>
        )}

      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-6 py-2.5 rounded-xl transition-colors font-semibold text-sm shadow-md shadow-lilac-200 disabled:opacity-50"
        >
          <Save size={16} /> {loading ? "Guardando..." : (isEditing ? "Guardar Cambios" : "Guardar Gasto")}
        </button>
      </div>
    </form>
  );
}
