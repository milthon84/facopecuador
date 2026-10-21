"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import {
  Save,
  Stethoscope,
  GraduationCap,
  Building2,
  UploadCloud,
  FileText,
  FileImage,
  Eye,
  X,
  Trash2,
  ExternalLink,
  Receipt,
  CheckCircle2,
  Loader2,
  Calendar,
  CreditCard,
  Tag,
  Building,
  KeyRound,
  Calculator,
  Percent,
} from "lucide-react";
import { resolveExpenseArea, ExpenseArea, resolveReceiptUrl } from "@/lib/expense-areas";
import { proxyStorageUrl } from "@/lib/storage-proxy";

const CATEGORIES = [
  "Insumos dentales",
  "Equipos",
  "Arriendo",
  "Servicios básicos",
  "Salarios",
  "Suministros oficina",
  "Mantenimiento",
  "Publicidad",
  "Otros",
];

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

  // Estado del archivo de respaldo
  const initialReceipt = resolveReceiptUrl(initialData || {});
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(initialReceipt);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const needsAccount = method === "efectivo" || method === "transferencia";
  const needsReference = method === "transferencia";
  const accountOptions = method === "efectivo" ? cajaAccounts : bankAccounts;
  const accountLabel = method === "efectivo" ? "Caja Chica" : "Cuenta Bancaria Destino";

  const isSinDocumento = docType === "sin_documento";

  function handleAutoCalcIva() {
    if (numSubtotal > 0) {
      const calc = Math.round(numSubtotal * 0.15 * 100) / 100;
      setIvaAmount(calc.toFixed(2));
    }
  }

  function handleSetZeroIva() {
    setIvaAmount(0);
  }

  function handleFileSelected(file: File) {
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isImage && !isPdf) {
      setErrorMsg("Formato no compatible. Por favor adjunta un archivo PDF o imagen (JPG, PNG, WEBP).");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg("El archivo es demasiado pesado (máximo 15 MB).");
      return;
    }

    setErrorMsg(null);
    setReceiptFile(file);

    if (isImage) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  }

  function removeReceipt() {
    setReceiptFile(null);
    setFilePreview(null);
    setExistingReceiptUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {isEditing && <input type="hidden" name="id" value={initialData.id} />}
        {existingReceiptUrl && <input type="hidden" name="existing_receipt_url" value={existingReceiptUrl} />}

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-3.5 py-2.5 rounded-xl font-medium flex items-center justify-between animate-fadeIn">
            <span className="flex items-center gap-1.5">⚠️ {errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-red-500 hover:text-red-700 text-xs p-1"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Layout Grid Ejecutivo: 7 columnas a la izquierda, 5 columnas a la derecha en Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* COLUMNA IZQUIERDA: Clasificación, Proveedor, Factura, Pago    */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 space-y-3.5">
            {/* 1. Barra de Clasificación Ejecutiva (Comprobante y Destino) */}
            <div className="bg-white border border-lilac-100 rounded-2xl p-3.5 shadow-xs space-y-2.5">
              {/* Tipo de Comprobante Segmentado */}
              <div>
                <label className="text-[11px] font-bold text-ink-500 uppercase tracking-wider block mb-1.5">
                  Tipo de Comprobante Fiscal
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-ink-50/80 rounded-xl border border-lilac-100">
                  <button
                    type="button"
                    onClick={() => setDocType("factura")}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      docType === "factura"
                        ? "bg-white text-ink-900 shadow-xs border border-lilac-200"
                        : "text-ink-600 hover:text-ink-900"
                    }`}
                  >
                    <Receipt size={13} className={docType === "factura" ? "text-lilac-600" : "text-ink-400"} />
                    Factura
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDocType("nota_venta");
                      setIvaAmount(0);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      docType === "nota_venta"
                        ? "bg-white text-ink-900 shadow-xs border border-lilac-200"
                        : "text-ink-600 hover:text-ink-900"
                    }`}
                  >
                    <FileText size={13} className={docType === "nota_venta" ? "text-lilac-600" : "text-ink-400"} />
                    Nota Venta
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDocType("sin_documento");
                      setIvaAmount(0);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      docType === "sin_documento"
                        ? "bg-white text-ink-900 shadow-xs border border-lilac-200"
                        : "text-ink-600 hover:text-ink-900"
                    }`}
                  >
                    <Building size={13} className={docType === "sin_documento" ? "text-lilac-600" : "text-ink-400"} />
                    Gasto Directo
                  </button>
                </div>
              </div>

              {/* Destino del Gasto (Área / Centro de Costos) - Optimizado en espacio */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-ink-500 uppercase tracking-wider">
                    Centro de Costo / Destino *
                  </label>
                  <span className="text-[10px] text-ink-400 font-medium">Asigna métricas de ERP</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setArea("clinica")}
                    className={`px-2.5 py-2 rounded-xl border text-left transition-all flex items-center gap-2 ${
                      area === "clinica"
                        ? "border-teal-500 bg-teal-50/90 text-teal-950 ring-2 ring-teal-200/70 shadow-xs font-bold"
                        : "border-lilac-100 bg-white text-ink-700 hover:bg-lilac-50/50 font-medium"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        area === "clinica" ? "bg-teal-600 text-white" : "bg-teal-100 text-teal-700"
                      }`}
                    >
                      <Stethoscope size={13} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs leading-none">Clínica Dental</div>
                      <div className="text-[9px] text-ink-400 truncate mt-0.5 font-normal">Insumos y médicos</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setArea("cursos")}
                    className={`px-2.5 py-2 rounded-xl border text-left transition-all flex items-center gap-2 ${
                      area === "cursos"
                        ? "border-indigo-500 bg-indigo-50/90 text-indigo-950 ring-2 ring-indigo-200/70 shadow-xs font-bold"
                        : "border-lilac-100 bg-white text-ink-700 hover:bg-lilac-50/50 font-medium"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        area === "cursos" ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      <GraduationCap size={13} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs leading-none">Educación</div>
                      <div className="text-[9px] text-ink-400 truncate mt-0.5 font-normal">Cursos y docentes</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setArea("general")}
                    className={`px-2.5 py-2 rounded-xl border text-left transition-all flex items-center gap-2 ${
                      area === "general"
                        ? "border-amber-500 bg-amber-50/90 text-amber-950 ring-2 ring-amber-200/70 shadow-xs font-bold"
                        : "border-lilac-100 bg-white text-ink-700 hover:bg-lilac-50/50 font-medium"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        area === "general" ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      <Building2 size={13} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs leading-none">General / Admin</div>
                      <div className="text-[9px] text-ink-400 truncate mt-0.5 font-normal">Arriendo y suministros</div>
                    </div>
                  </button>
                </div>
                <input type="hidden" name="area" value={area} />
              </div>
            </div>

            {/* 2. Datos del Proveedor y Factura / Documento */}
            <div className="bg-white border border-lilac-100 rounded-2xl p-3.5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-lilac-50 pb-2">
                <FileText size={15} className="text-lilac-600" />
                <h3 className="text-xs font-bold text-ink-800 uppercase tracking-wide">
                  Datos del Proveedor y Emisión
                </h3>
              </div>

              {/* RUC + Proveedor */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-5 space-y-1">
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
                    className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono text-ink-900"
                  />
                  <datalist id="suppliers-list">
                    {knownSuppliersList.map((s) => (
                      <option key={s.ruc} value={s.ruc}>
                        {s.name}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div className="sm:col-span-7 space-y-1">
                  <label className="text-xs font-semibold text-ink-700">
                    {isSinDocumento ? "Beneficiario / Concepto *" : "Proveedor / Beneficiario *"}
                  </label>
                  <input
                    name="supplier_name"
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder={isSinDocumento ? "Ej. Caja Chica, Almuerzo, Movilización" : "Razón social o nombre"}
                    className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-medium text-ink-900"
                  />
                </div>
              </div>

              {/* N° Comprobante + Fecha */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
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
                        className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono text-ink-900"
                      />
                    </div>
                    <div className="sm:col-span-6 space-y-1">
                      <label className="text-xs font-semibold text-ink-700 flex items-center gap-1">
                        <Calendar size={12} className="text-ink-400" /> Fecha *
                      </label>
                      <input
                        type="date"
                        name="expense_date"
                        required
                        defaultValue={initialData?.expense_date || today}
                        className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
                      />
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-12 space-y-1">
                    <label className="text-xs font-semibold text-ink-700 flex items-center gap-1">
                      <Calendar size={12} className="text-ink-400" /> Fecha de Registro *
                    </label>
                    <input
                      type="date"
                      name="expense_date"
                      required
                      defaultValue={initialData?.expense_date || today}
                      className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
                    />
                    <input type="hidden" name="document_number" value="" />
                  </div>
                )}
              </div>

              {/* Clave de Acceso SRI (solo para Factura) */}
              {docType === "factura" && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-ink-700 flex items-center gap-1">
                      <KeyRound size={12} className="text-ink-400" />
                      Clave de Acceso SRI / N° Autorización (opcional)
                    </label>
                    <span className="text-[10px] text-ink-400 font-mono">10 a 49 dígitos</span>
                  </div>
                  <input
                    name="authorization_number"
                    maxLength={49}
                    defaultValue={initialData?.authorization_number || ""}
                    placeholder="Ej: 3008202601179234567800120010010000000011234567819"
                    className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono text-ink-800 placeholder:text-ink-300"
                  />
                </div>
              )}

              {/* Categoría y Descripción */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-5 space-y-1">
                  <label className="text-xs font-semibold text-ink-700 flex items-center gap-1">
                    <Tag size={12} className="text-ink-400" /> Categoría *
                  </label>
                  <select
                    name="category"
                    required
                    defaultValue={initialData?.category || CATEGORIES[0]}
                    className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900 font-medium"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-7 space-y-1">
                  <label className="text-xs font-semibold text-ink-700">Descripción / Detalle</label>
                  <input
                    name="description"
                    defaultValue={initialData?.description || ""}
                    placeholder="Detalle o justificación del gasto"
                    className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
                  />
                </div>
              </div>
            </div>

            {/* 3. Forma de Pago Ejecutiva */}
            <div className="bg-white border border-lilac-100 rounded-2xl p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-lilac-50 pb-2">
                <div className="flex items-center gap-2">
                  <CreditCard size={15} className="text-lilac-600" />
                  <h3 className="text-xs font-bold text-ink-800 uppercase tracking-wide">Forma de Pago</h3>
                </div>

                {/* Métodos de Pago Pills */}
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
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        method === m.value
                          ? "bg-lilac-600 text-white shadow-xs font-bold"
                          : "bg-ink-50 text-ink-600 hover:bg-lilac-50"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <input type="hidden" name="payment_method" value={method} />

              {/* Campos dinámicos según forma de pago */}
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
                          {a.notes ? ` (${a.notes})` : ""}
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-700">Tarjeta *</label>
                    <input
                      type="text"
                      name="card_type"
                      required
                      list="tarjetas-ec"
                      placeholder="Visa / Master"
                      className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
                    />
                    <datalist id="tarjetas-ec">
                      <option value="Visa" />
                      <option value="Mastercard" />
                      <option value="American Express" />
                      <option value="Diners Club" />
                      <option value="Discover" />
                      <option value="PacifiCard" />
                    </datalist>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-700">N° Lote *</label>
                    <input
                      type="text"
                      name="card_lote"
                      required
                      placeholder="0012"
                      className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-700">N° Voucher *</label>
                    <input
                      type="text"
                      name="card_voucher"
                      required
                      placeholder="000123"
                      className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* COLUMNA DERECHA: Respaldo Digital y Liquidación Financiera   */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 space-y-3.5">
            {/* 1. Módulo de Adjuntar Respaldo Digital */}
            <div className="bg-white border border-lilac-100 rounded-2xl p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-lilac-50 pb-2">
                <div className="flex items-center gap-1.5">
                  <UploadCloud size={16} className="text-lilac-600" />
                  <h3 className="text-xs font-bold text-ink-800 uppercase tracking-wide">
                    Respaldo Digital
                  </h3>
                </div>
                <span className="text-[10px] text-ink-400 font-medium">Factura PDF / Recibo</span>
              </div>

              {/* Input de archivo nativo oculto */}
              <input
                ref={fileInputRef}
                type="file"
                name="receipt_file"
                accept=".pdf,image/png,image/jpeg,image/webp"
                onChange={onFileInputChange}
                className="hidden"
              />

              {/* Área de Visualización si ya hay archivo cargado o nuevo */}
              {receiptFile || existingReceiptUrl ? (
                <div className="border border-lilac-200 rounded-xl p-3 bg-lilac-50/20 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {receiptFile ? (
                        receiptFile.type.startsWith("image/") ? (
                          <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                            <FileImage size={16} />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                            <FileText size={16} />
                          </div>
                        )
                      ) : isExistingPdf ? (
                        <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                          <FileText size={16} />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                          <FileImage size={16} />
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="text-xs font-bold text-ink-900 truncate">
                          {receiptFile ? receiptFile.name : "Respaldo digital adjunto"}
                        </p>
                        <p className="text-[10px] text-ink-400">
                          {receiptFile
                            ? `${(receiptFile.size / 1024).toFixed(0)} KB · Nuevo archivo`
                            : "Almacenado en la nube"}
                        </p>
                      </div>
                    </div>

                    {/* Acciones del archivo */}
                    <div className="flex items-center gap-1 shrink-0">
                      {(filePreview || existingReceiptUrl) && (
                        <button
                          type="button"
                          onClick={() => setPreviewModalOpen(true)}
                          className="p-1.5 rounded-lg text-ink-600 hover:text-lilac-700 hover:bg-white border border-transparent hover:border-lilac-200 transition"
                          title="Visualizar respaldo"
                        >
                          <Eye size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={removeReceipt}
                        className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition"
                        title="Quitar respaldo"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Thumbnail de miniatura si es imagen */}
                  {filePreview && (
                    <div
                      onClick={() => setPreviewModalOpen(true)}
                      className="cursor-pointer relative rounded-lg overflow-hidden border border-lilac-200 max-h-32 bg-ink-950 flex items-center justify-center group"
                    >
                      <img
                        src={filePreview}
                        alt="Vista previa del comprobante"
                        className="max-h-32 object-contain group-hover:opacity-85 transition"
                      />
                      <div className="absolute inset-0 bg-ink-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold gap-1.5 transition">
                        <Eye size={14} /> Clic para ampliar
                      </div>
                    </div>
                  )}

                  {!filePreview && existingReceiptUrl && !isExistingPdf && (
                    <div
                      onClick={() => setPreviewModalOpen(true)}
                      className="cursor-pointer relative rounded-lg overflow-hidden border border-lilac-200 max-h-32 bg-ink-950 flex items-center justify-center group"
                    >
                      <img
                        src={proxyStorageUrl(existingReceiptUrl)}
                        alt="Comprobante actual"
                        className="max-h-32 object-contain group-hover:opacity-85 transition"
                      />
                      <div className="absolute inset-0 bg-ink-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold gap-1.5 transition">
                        <Eye size={14} /> Clic para ampliar
                      </div>
                    </div>
                  )}

                  {/* Botón para cambiar de archivo */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full text-center text-[11px] font-semibold text-lilac-700 hover:text-lilac-900 hover:underline pt-0.5"
                  >
                    Cambiar archivo adjunto
                  </button>
                </div>
              ) : (
                /* Dropzone interactiva cuando no hay archivo */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                    isDragOver
                      ? "border-lilac-500 bg-lilac-50/70 scale-[0.99]"
                      : "border-lilac-200 hover:border-lilac-400 bg-ink-50/40 hover:bg-lilac-50/30"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-lilac-100 text-lilac-600 flex items-center justify-center mx-auto mb-2">
                    <UploadCloud size={20} />
                  </div>
                  <p className="text-xs font-bold text-ink-800">
                    Adjuntar Factura o Recibo
                  </p>
                  <p className="text-[11px] text-ink-500 mt-0.5">
                    Arrastra aquí o haz clic para examinar
                  </p>
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    <span className="text-[10px] bg-white border border-lilac-100 text-ink-500 px-2 py-0.5 rounded-full font-medium">
                      PDF
                    </span>
                    <span className="text-[10px] bg-white border border-lilac-100 text-ink-500 px-2 py-0.5 rounded-full font-medium">
                      JPG / PNG
                    </span>
                    <span className="text-[10px] text-ink-400 font-medium">máx 15MB</span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Liquidación Financiera y Totales */}
            <div className="bg-white border border-lilac-100 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-lilac-50 pb-2">
                <Calculator size={15} className="text-lilac-600" />
                <h3 className="text-xs font-bold text-ink-800 uppercase tracking-wide">
                  Liquidación e Importes
                </h3>
              </div>

              {/* Subtotal */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-ink-700">
                    Monto Sin IVA / Subtotal ($) *
                  </label>
                  <span className="text-[10px] text-ink-400">Base Imponible</span>
                </div>
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

              {/* IVA (solo si es Factura) */}
              {docType === "factura" ? (
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-ink-700 flex items-center gap-1">
                      <Percent size={12} className="text-ink-400" /> Monto IVA ($)
                    </label>

                    {numSubtotal > 0 && (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={handleSetZeroIva}
                          className="text-[10px] text-ink-500 hover:text-ink-800 font-semibold px-1.5 py-0.5 rounded bg-ink-50 border border-ink-200 hover:bg-ink-100 transition"
                        >
                          Tarifa 0%
                        </button>
                        <button
                          type="button"
                          onClick={handleAutoCalcIva}
                          className="text-[10px] text-lilac-700 hover:text-lilac-900 font-bold px-1.5 py-0.5 rounded bg-lilac-50 border border-lilac-200 hover:bg-lilac-100 transition"
                        >
                          +15% IVA
                        </button>
                      </div>
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
                      className="w-full border border-lilac-200 rounded-xl pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono font-semibold text-ink-900"
                    />
                  </div>
                </div>
              ) : (
                <input type="hidden" name="iva_amount" value="0" />
              )}

              {/* Resumen de Total Ejecutivo */}
              <div className="bg-gradient-to-br from-lilac-50/70 to-ink-50/50 border border-lilac-200 rounded-xl p-3 space-y-2 mt-1">
                <div className="flex justify-between items-center text-xs text-ink-600">
                  <span>Subtotal Bruto:</span>
                  <span className="font-mono font-semibold">${numSubtotal.toFixed(2)}</span>
                </div>
                {docType === "factura" && numIva > 0 && (
                  <div className="flex justify-between items-center text-xs text-lilac-800">
                    <span>IVA (15%):</span>
                    <span className="font-mono font-semibold">+${numIva.toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-lilac-200/80 flex items-baseline justify-between">
                  <span className="text-xs font-black uppercase text-ink-700 tracking-wider">
                    Total a Pagar:
                  </span>
                  <span className="text-xl font-black text-lilac-700 font-mono tracking-tight">
                    ${calculatedTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Botón de Envío Principal */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white py-2.5 px-4 rounded-xl font-bold text-sm shadow-md shadow-lilac-200 hover:shadow-lg transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Guardando...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {isEditing ? "Guardar Cambios del Gasto" : "Registrar Gasto / Compra"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Modal / Lightbox de visualización de comprobante */}
      {previewModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-lilac-100 flex items-center justify-between bg-ink-50/50">
              <div className="flex items-center gap-2">
                <FileImage size={16} className="text-lilac-600" />
                <h4 className="text-sm font-bold text-ink-900">Respaldo Digital del Gasto</h4>
              </div>
              <div className="flex items-center gap-2">
                {(existingReceiptUrl || filePreview) && (
                  <a
                    href={filePreview || proxyStorageUrl(existingReceiptUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-lilac-700 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <ExternalLink size={13} /> Abrir en pestaña nueva
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

            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-ink-100/50">
              {filePreview ? (
                <img
                  src={filePreview}
                  alt="Vista previa de respaldo"
                  className="max-h-[70vh] object-contain rounded-lg shadow-xs"
                />
              ) : existingReceiptUrl ? (
                isExistingPdf ? (
                  <div className="text-center py-12 space-y-3">
                    <FileText size={48} className="text-red-600 mx-auto" />
                    <p className="text-sm font-bold text-ink-900">Archivo PDF de Respaldo</p>
                    <a
                      href={proxyStorageUrl(existingReceiptUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-2 rounded-xl font-semibold shadow-sm"
                    >
                      <ExternalLink size={14} /> Abrir y Descargar PDF
                    </a>
                  </div>
                ) : (
                  <img
                    src={proxyStorageUrl(existingReceiptUrl)}
                    alt="Respaldo del gasto"
                    className="max-h-[70vh] object-contain rounded-lg shadow-xs"
                  />
                )
              ) : (
                <p className="text-xs text-ink-400">Sin vista previa disponible.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
