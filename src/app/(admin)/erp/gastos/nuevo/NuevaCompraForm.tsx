"use client";

import { useState, useRef, ChangeEvent } from "react";
import {
  Save,
  Stethoscope,
  GraduationCap,
  Building2,
  Paperclip,
  Eye,
  X,
  ExternalLink,
  Loader2,
  Calendar,
  FileText,
} from "lucide-react";
import { resolveExpenseArea, ExpenseArea, resolveReceiptUrl } from "@/lib/expense-areas";
import { proxyStorageUrl } from "@/lib/storage-proxy";

type Account = {
  id: string;
  bank_name: string;
  account_number: string | null;
  account_type: string;
  notes?: string | null;
};

type SupplierItem = { ruc: string; name: string };

interface Props {
  today: string;
  bankAccounts: Account[];
  cajaAccounts: Account[];
  knownSuppliersList?: SupplierItem[];
  initialData?: any;
  saveExpense: (formData: FormData) => Promise<void | { success?: boolean; error?: string; url?: string }>;
}

export default function NuevaCompraForm({
  today,
  bankAccounts,
  cajaAccounts,
  knownSuppliersList = [],
  initialData,
  saveExpense,
}: Props) {
  const isEditing = Boolean(initialData?.id);
  const [area, setArea] = useState<ExpenseArea>(resolveExpenseArea(initialData || {}));
  const [method, setMethod] = useState(initialData?.payment_method || "efectivo");
  const [docType, setDocType] = useState<"factura" | "nota_venta" | "sin_documento">(
    initialData
      ? initialData.document_number
        ? "factura"
        : "sin_documento"
      : "factura"
  );

  const [subtotal, setSubtotal] = useState<number | string>(
    initialData
      ? Number(initialData.subtotal_0 || 0) + Number(initialData.subtotal_15 || 0)
      : 0
  );
  const [ivaAmount, setIvaAmount] = useState<number | string>(initialData?.iva_amount ?? 0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [supplierRuc, setSupplierRuc] = useState(initialData?.supplier_ruc || "");
  const [supplierName, setSupplierName] = useState(initialData?.supplier_name || "");

  // Respaldo digital (solo botón y chip)
  const initialReceipt = resolveReceiptUrl(initialData || {});
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(initialReceipt);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleRucChange(val: string) {
    setSupplierRuc(val);
    const cleanRuc = val.trim();
    if (cleanRuc) {
      const match = knownSuppliersList.find((s) => s.ruc === cleanRuc);
      if (match) setSupplierName(match.name);
    }
  }

  const numSubtotal = Number(subtotal) || 0;
  const numIva = Number(ivaAmount) || 0;
  const calculatedTotal = Math.round((numSubtotal + numIva) * 100) / 100;

  const needsAccount = method === "efectivo" || method === "transferencia";
  const needsReference = method === "transferencia";
  const accountOptions = method === "efectivo" ? cajaAccounts : bankAccounts;
  const accountLabel = method === "efectivo" ? "Caja Chica" : "Cuenta Bancaria";

  const isSinDocumento = docType === "sin_documento";

  function handleAutoCalcIva() {
    if (numSubtotal > 0) {
      const calc = Math.round(numSubtotal * 0.15 * 100) / 100;
      setIvaAmount(calc.toFixed(2));
    }
  }

  function handleFileSelected(file: File) {
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isImage && !isPdf) {
      setErrorMsg("Formato no compatible. Adjunta un PDF o una foto.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg("El archivo es demasiado pesado (máx 15MB).");
      return;
    }

    setErrorMsg(null);
    setReceiptFile(file);

    if (isImage) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  }

  function removeReceipt() {
    setReceiptFile(null);
    setFilePreview(null);
    setExistingReceiptUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      const res = (await saveExpense(formData)) as { success?: boolean; error?: string; url?: string };
      if (res?.success) {
        window.location.href = res.url || "/erp/gastos";
      } else if (res?.error) {
        setErrorMsg(res.error);
        setLoading(false);
      }
    } catch (err: any) {
      if (err?.message?.includes("NEXT_REDIRECT")) return;
      setErrorMsg(err.message || "Error al guardar el gasto.");
      setLoading(false);
    }
  }

  const isExistingPdf = Boolean(
    existingReceiptUrl &&
      (existingReceiptUrl.toLowerCase().includes(".pdf") ||
        existingReceiptUrl.toLowerCase().includes("application/pdf"))
  );

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="bg-white border border-lilac-200/80 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        {isEditing && <input type="hidden" name="id" value={initialData.id} />}
        {existingReceiptUrl && <input type="hidden" name="existing_receipt_url" value={existingReceiptUrl} />}
        {/* Categoría automática para la base de datos */}
        <input type="hidden" name="category" value={initialData?.category || (area === "clinica" ? "Insumos dentales" : area === "cursos" ? "Cursos" : "General")} />

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-3.5 py-2 rounded-xl font-medium flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700 p-1">
              <X size={14} />
            </button>
          </div>
        )}

        {/* 1. Fila de Encabezado: Destino del Gasto y Tipo de Comprobante en una sola franja */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-lilac-100">
          {/* Destino (3 pills limpias) */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wide block">
              Destino del Gasto *
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setArea("clinica")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                  area === "clinica"
                    ? "border-teal-500 bg-teal-50 text-teal-950 ring-2 ring-teal-200 font-bold"
                    : "border-lilac-200 bg-white text-ink-600 hover:bg-lilac-50"
                }`}
              >
                <Stethoscope size={13} className={area === "clinica" ? "text-teal-600" : "text-ink-400"} />
                Clínica Dental
              </button>

              <button
                type="button"
                onClick={() => setArea("cursos")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                  area === "cursos"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-200 font-bold"
                    : "border-lilac-200 bg-white text-ink-600 hover:bg-lilac-50"
                }`}
              >
                <GraduationCap size={13} className={area === "cursos" ? "text-indigo-600" : "text-ink-400"} />
                Cursos / Educación
              </button>

              <button
                type="button"
                onClick={() => setArea("general")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                  area === "general"
                    ? "border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-200 font-bold"
                    : "border-lilac-200 bg-white text-ink-600 hover:bg-lilac-50"
                }`}
              >
                <Building2 size={13} className={area === "general" ? "text-amber-600" : "text-ink-400"} />
                General / Admin
              </button>
            </div>
            <input type="hidden" name="area" value={area} />
          </div>

          {/* Tipo de Comprobante Simple */}
          <div className="space-y-1 sm:text-right">
            <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wide block">
              Comprobante
            </span>
            <select
              value={docType}
              onChange={(e) => {
                const val = e.target.value as any;
                setDocType(val);
                if (val !== "factura") setIvaAmount(0);
              }}
              className="border border-lilac-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-ink-800 bg-white focus:outline-none focus:ring-2 focus:ring-lilac-400"
            >
              <option value="factura">Factura</option>
              <option value="nota_venta">Nota de Venta</option>
              <option value="sin_documento">Gasto Directo (Sin Doc)</option>
            </select>
          </div>
        </div>

        {/* 2. RUC y Proveedor */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-ink-700">
              {isSinDocumento ? "RUC / Cédula" : "RUC / Cédula *"}
            </label>
            <input
              name="supplier_ruc"
              maxLength={13}
              value={supplierRuc}
              onChange={(e) => handleRucChange(e.target.value)}
              list="suppliers-list"
              placeholder="1790483851001"
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono text-ink-900"
            />
            <datalist id="suppliers-list">
              {knownSuppliersList.map((s) => (
                <option key={s.ruc} value={s.ruc}>
                  {s.name}
                </option>
              ))}
            </datalist>
          </div>

          <div className="sm:col-span-8 space-y-1">
            <label className="text-xs font-semibold text-ink-700">
              {isSinDocumento ? "Concepto / Beneficiario *" : "Proveedor / Beneficiario *"}
            </label>
            <input
              name="supplier_name"
              required
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder={isSinDocumento ? "Ej. Taxi, Caja Chica, Almuerzo" : "Nombre del proveedor o razón social"}
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-medium text-ink-900"
            />
          </div>
        </div>

        {/* 3. N° Documento y Fecha */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {!isSinDocumento ? (
            <>
              <div className="sm:col-span-6 space-y-1">
                <label className="text-xs font-semibold text-ink-700">
                  N° {docType === "factura" ? "Factura" : "Nota de Venta"} (opcional)
                </label>
                <input
                  name="document_number"
                  defaultValue={initialData?.document_number || ""}
                  placeholder={docType === "factura" ? "001-001-000000001" : "001-001-000001"}
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono text-ink-900"
                />
              </div>
              <div className="sm:col-span-6 space-y-1">
                <label className="text-xs font-semibold text-ink-700 flex items-center gap-1">
                  <Calendar size={13} className="text-ink-400" /> Fecha *
                </label>
                <input
                  type="date"
                  name="expense_date"
                  required
                  defaultValue={initialData?.expense_date || today}
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
                />
              </div>
            </>
          ) : (
            <div className="sm:col-span-12 space-y-1">
              <label className="text-xs font-semibold text-ink-700 flex items-center gap-1">
                <Calendar size={13} className="text-ink-400" /> Fecha *
              </label>
              <input
                type="date"
                name="expense_date"
                required
                defaultValue={initialData?.expense_date || today}
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
              />
              <input type="hidden" name="document_number" value="" />
            </div>
          )}
        </div>

        {/* 4. Descripción del Gasto */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-700">Descripción / Justificación</label>
          <input
            name="description"
            defaultValue={initialData?.description || ""}
            placeholder="Detalle o descripción de los bienes o servicios adquiridos"
            className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
          />
        </div>

        {/* 5. Forma de Pago en una sola fila compacta */}
        <div className="bg-lilac-50/40 border border-lilac-100 rounded-xl p-3 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-ink-600 uppercase tracking-wide">Forma de Pago</span>
            <div className="flex gap-1.5">
              {[
                { value: "efectivo", label: "💵 Efectivo" },
                { value: "transferencia", label: "🏦 Transferencia" },
                { value: "tarjeta_credito", label: "💳 Tarjeta" },
              ].map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    method === m.value
                      ? "bg-lilac-600 text-white shadow-xs font-bold"
                      : "bg-white text-ink-600 border border-lilac-200 hover:bg-lilac-50"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <input type="hidden" name="payment_method" value={method} />

          {/* Subcampos dinámicos según el método */}
          {needsAccount && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
              <div className={needsReference ? "sm:col-span-7 space-y-1" : "sm:col-span-12 space-y-1"}>
                <label className="text-xs font-semibold text-ink-700">{accountLabel} *</label>
                <select
                  name="bank_account_id"
                  required
                  defaultValue={initialData?.bank_account_id || ""}
                  className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
                >
                  <option value="">— Seleccionar Cuenta —</option>
                  {accountOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bank_name}
                      {a.account_number ? ` · ${a.account_number}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {needsReference && (
                <div className="sm:col-span-5 space-y-1">
                  <label className="text-xs font-semibold text-ink-700">N° Referencia *</label>
                  <input
                    type="text"
                    name="payment_reference"
                    required
                    defaultValue={initialData?.payment_reference || ""}
                    placeholder="TRF-001234"
                    className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono text-ink-900"
                  />
                </div>
              )}
            </div>
          )}

          {method === "tarjeta_credito" && (
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-ink-700">Tarjeta *</label>
                <input
                  type="text"
                  name="card_type"
                  required
                  placeholder="Visa / Master"
                  className="w-full border border-lilac-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-ink-700">Lote *</label>
                <input
                  type="text"
                  name="card_lote"
                  required
                  placeholder="0012"
                  className="w-full border border-lilac-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-ink-700">Voucher *</label>
                <input
                  type="text"
                  name="card_voucher"
                  required
                  placeholder="000123"
                  className="w-full border border-lilac-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* 6. Importes (Subtotal + IVA) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-700">
              Monto Sin IVA / Subtotal ($) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 font-bold text-sm">$</span>
              <input
                type="number"
                name="subtotal_0"
                min="0"
                step="0.01"
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
                placeholder="0.00"
                className="w-full border border-lilac-200 rounded-xl pl-8 pr-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono font-bold text-ink-950"
              />
            </div>
          </div>

          {docType === "factura" ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-ink-700">IVA ($)</label>
                {numSubtotal > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoCalcIva}
                    className="text-[11px] text-lilac-700 hover:text-lilac-900 font-bold px-1.5 py-0.5 rounded bg-lilac-50 border border-lilac-200"
                  >
                    +15% IVA
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 font-bold text-sm">$</span>
                <input
                  type="number"
                  name="iva_amount"
                  min="0"
                  step="0.01"
                  value={ivaAmount}
                  onChange={(e) => setIvaAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-lilac-200 rounded-xl pl-8 pr-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono font-semibold text-ink-900"
                />
              </div>
            </div>
          ) : (
            <input type="hidden" name="iva_amount" value="0" />
          )}
        </div>

        {/* Input oculto para adjuntar archivo nativo */}
        <input
          ref={fileInputRef}
          type="file"
          name="receipt_file"
          accept=".pdf,image/*"
          onChange={onFileInputChange}
          className="hidden"
        />

        {/* 7. Franja Inferior: Botón de Respaldo + Total a Pagar + Botón Guardar */}
        <div className="pt-3 border-t border-lilac-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Botón de Adjuntar Respaldo (Simple y directo) */}
          <div>
            {!receiptFile && !existingReceiptUrl ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-lilac-300 bg-lilac-50/60 hover:bg-lilac-100 text-xs font-semibold text-lilac-800 transition"
              >
                <Paperclip size={15} className="text-lilac-600" />
                <span>Adjuntar Respaldo (PDF o Foto)</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-lilac-50 border border-lilac-200 text-xs">
                <Paperclip size={13} className="text-lilac-600 shrink-0" />
                <span className="font-semibold text-ink-800 truncate max-w-[170px] sm:max-w-[220px]">
                  {receiptFile ? receiptFile.name : "Respaldo digital adjunto"}
                </span>
                {(filePreview || existingReceiptUrl) && (
                  <button
                    type="button"
                    onClick={() => setPreviewModalOpen(true)}
                    className="text-lilac-700 hover:text-lilac-900 p-1"
                    title="Ver archivo"
                  >
                    <Eye size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={removeReceipt}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Quitar archivo"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Total y Botón de Guardado */}
          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
            <div className="text-left sm:text-right">
              <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider block">
                Total a Pagar
              </span>
              <span className="text-xl font-black text-lilac-700 font-mono">
                ${calculatedTotal.toFixed(2)}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-lilac-200 transition active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {isEditing ? "Guardar Cambios" : "Guardar Gasto"}
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Modal Lightbox para previsualizar el respaldo */}
      {previewModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-lilac-100 flex items-center justify-between bg-ink-50/60">
              <span className="text-xs font-bold text-ink-900">Respaldo Digital Adjunto</span>
              <div className="flex items-center gap-2">
                {(existingReceiptUrl || filePreview) && (
                  <a
                    href={filePreview || proxyStorageUrl(existingReceiptUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-lilac-700 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <ExternalLink size={13} /> Abrir original
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="w-7 h-7 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-ink-100/40">
              {filePreview ? (
                <img
                  src={filePreview}
                  alt="Vista previa"
                  className="max-h-[65vh] object-contain rounded-lg shadow-xs"
                />
              ) : existingReceiptUrl ? (
                isExistingPdf ? (
                  <div className="text-center py-10 space-y-3">
                    <FileText size={44} className="text-red-600 mx-auto" />
                    <p className="text-xs font-bold text-ink-900">Factura / Respaldo en PDF</p>
                    <a
                      href={proxyStorageUrl(existingReceiptUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-2 rounded-xl font-semibold"
                    >
                      <ExternalLink size={13} /> Ver y Descargar PDF
                    </a>
                  </div>
                ) : (
                  <img
                    src={proxyStorageUrl(existingReceiptUrl)}
                    alt="Respaldo actual"
                    className="max-h-[65vh] object-contain rounded-lg shadow-xs"
                  />
                )
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
