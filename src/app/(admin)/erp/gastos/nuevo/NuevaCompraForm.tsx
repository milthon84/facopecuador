"use client";

import { useState, useRef, ChangeEvent, useEffect } from "react";
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
  Plus,
  Trash2,
  Sparkles,
  Search,
  CheckCircle2,
  Receipt,
  FileCheck2,
  Info,
  HelpCircle,
} from "lucide-react";
import { resolveExpenseArea, ExpenseArea, resolveReceiptUrl } from "@/lib/expense-areas";
import { proxyStorageUrl } from "@/lib/storage-proxy";
import {
  FacturaRecibida,
  ExpenseItemRow,
  calculateItemRow,
  calculateExpenseTotals,
  EXPENSE_ITEM_CATEGORIES,
  EXPENSE_CATEGORY_DETAILS,
  normalizeCategoryName,
} from "@/lib/expense-types";

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
  pendingFacturas?: FacturaRecibida[];
  initialFacturaClave?: string | null;
  initialData?: any;
  initialItems?: ExpenseItemRow[];
  saveExpense: (formData: FormData) => Promise<void | { success?: boolean; error?: string; url?: string }>;
}

export default function NuevaCompraForm({
  today,
  bankAccounts,
  cajaAccounts,
  knownSuppliersList = [],
  pendingFacturas = [],
  initialFacturaClave = null,
  initialData,
  initialItems = [],
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

  const [supplierRuc, setSupplierRuc] = useState(initialData?.supplier_ruc || "");
  const [supplierName, setSupplierName] = useState(initialData?.supplier_name || "");
  const [docNumber, setDocNumber] = useState(initialData?.document_number || "");
  const [expenseDate, setExpenseDate] = useState(initialData?.expense_date || today);
  const [authNumber, setAuthNumber] = useState(initialData?.authorization_number || "");
  const [selectedFacturaClave, setSelectedFacturaClave] = useState<string | null>(
    initialFacturaClave || initialData?.factura_recibida_clave_acceso || null
  );

  // Selector y buscador de facturas recibidas
  const [facturaSearch, setFacturaSearch] = useState("");
  const [facturaDropdownOpen, setFacturaDropdownOpen] = useState(false);

  // Guía interactiva de categorías
  const [guiaCategoriasOpen, setGuiaCategoriasOpen] = useState(false);

  // Líneas de detalle del gasto (Cabecera y Detalle)
  const [items, setItems] = useState<ExpenseItemRow[]>(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map((it) => ({
        ...it,
        category: normalizeCategoryName(it.category),
      }));
    }
    if (initialData) {
      const sub0 = Number(initialData.subtotal_0) || 0;
      const sub15 = Number(initialData.subtotal_15) || 0;
      const defaultCat = normalizeCategoryName(initialData.category);
      const result: ExpenseItemRow[] = [];
      if (sub15 > 0) {
        result.push({
          id: "init-15",
          description: initialData.description || "Bienes / Servicios gravados IVA",
          category: defaultCat,
          quantity: 1,
          unit_price: sub15,
          iva_rate: 15,
        });
      }
      if (sub0 > 0) {
        result.push({
          id: "init-0",
          description: initialData.description || "Bienes / Servicios tarifa 0%",
          category: defaultCat,
          quantity: 1,
          unit_price: sub0,
          iva_rate: 0,
        });
      }
      if (result.length > 0) return result;
    }
    return [
      {
        id: "item-1",
        description: "",
        category: "Insumo y Material",
        quantity: 1,
        unit_price: "",
        iva_rate: 15,
      },
    ];
  });

  // Totales calculados en tiempo real desde el detalle
  const totals = calculateExpenseTotals(items);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Respaldo digital (solo botón y chip)
  const initialReceipt = resolveReceiptUrl(initialData || {});
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(initialReceipt);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-cargar factura recibida si viene por parámetro inicial
  useEffect(() => {
    if (initialFacturaClave && pendingFacturas.length > 0 && !isEditing) {
      const match = pendingFacturas.find((f) => f.clave_acceso === initialFacturaClave);
      if (match) {
        aplicarFacturaRecibida(match);
      }
    }
  }, [initialFacturaClave, pendingFacturas, isEditing]);

  function aplicarFacturaRecibida(factura: FacturaRecibida) {
    setSelectedFacturaClave(factura.clave_acceso);
    setSupplierRuc(factura.ruc_emisor || "");
    setSupplierName(factura.razon_social || "");
    setDocNumber(factura.numero_comprobante || "");
    if (factura.fecha_emision) setExpenseDate(factura.fecha_emision);
    setAuthNumber(factura.clave_acceso || "");
    setDocType("factura");

    // Construir filas de detalle con base en los montos de la factura
    const subtotal = Number(factura.subtotal) || 0;
    const iva = Number(factura.iva) || 0;
    const total = Number(factura.total) || 0;

    const newRows: ExpenseItemRow[] = [];
    if (subtotal > 0) {
      newRows.push({
        id: `fac-${Date.now()}-1`,
        description: factura.razon_social ? `${factura.razon_social} - Fac #${factura.numero_comprobante || ""}` : "Compra según factura electrónica",
        category: "Insumo y Material",
        quantity: 1,
        unit_price: subtotal,
        iva_rate: iva > 0 ? 15 : 0,
      });
    } else if (total > 0) {
      newRows.push({
        id: `fac-${Date.now()}-1`,
        description: factura.razon_social ? `${factura.razon_social} - Fac #${factura.numero_comprobante || ""}` : "Compra según factura electrónica",
        category: "Insumo y Material",
        quantity: 1,
        unit_price: total,
        iva_rate: 0,
      });
    } else {
      newRows.push({
        id: `fac-${Date.now()}-1`,
        description: factura.razon_social || "Factura electrónica SRI",
        category: "Insumo y Material",
        quantity: 1,
        unit_price: "",
        iva_rate: 15,
      });
    }
    setItems(newRows);
    setFacturaDropdownOpen(false);
  }

  function desvincularFactura() {
    setSelectedFacturaClave(null);
  }

  function handleRucChange(val: string) {
    setSupplierRuc(val);
    const cleanRuc = val.trim();
    if (cleanRuc) {
      const match = knownSuppliersList.find((s) => s.ruc === cleanRuc);
      if (match) setSupplierName(match.name);
    }
  }

  // Manejo de filas de detalle
  function addItemRow() {
    const lastCategory = items[items.length - 1]?.category || "Insumo y Material";
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        description: "",
        category: lastCategory,
        quantity: 1,
        unit_price: "",
        iva_rate: docType === "factura" ? 15 : 0,
      },
    ]);
  }

  function updateItemRow(id: string, field: keyof ExpenseItemRow, val: any) {
    setItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        return { ...row, [field]: val };
      })
    );
  }

  function removeItemRow(id: string) {
    if (items.length <= 1) {
      // Dejar una fila limpia en lugar de vaciar
      setItems([
        {
          id: `item-${Date.now()}`,
          description: "",
          quantity: 1,
          unit_price: "",
          iva_rate: docType === "factura" ? 15 : 0,
        },
      ]);
      return;
    }
    setItems((prev) => prev.filter((r) => r.id !== id));
  }

  const needsAccount = method === "efectivo" || method === "transferencia";
  const needsReference = method === "transferencia";

  // Cuentas de Caja Chica para Efectivo
  const efectivoCajaAccounts = cajaAccounts.filter((a) =>
    (a.bank_name || "").toLowerCase().includes("caja chica")
  );
  const finalCajaAccounts = efectivoCajaAccounts.length > 0 ? efectivoCajaAccounts : cajaAccounts;

  const accountOptions = method === "efectivo" ? finalCajaAccounts : bankAccounts;
  const accountLabel = method === "efectivo" ? "Caja Chica de Salida" : "Cuenta Bancaria Emisora";

  const isSinDocumento = docType === "sin_documento";

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

    if (totals.total <= 0) {
      setErrorMsg("El total del gasto debe ser mayor a cero.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      // Adjuntar los ítems como JSON estructurado
      const validItems = items
        .filter((it) => (Number(it.unit_price) > 0 || it.description.trim() !== ""))
        .map((it) => {
          const calc = calculateItemRow(it);
          return {
            description: it.description.trim() || "Item de gasto",
            category: normalizeCategoryName(it.category),
            quantity: calc.qty || 1,
            unit_price: calc.price || 0,
            iva_rate: it.iva_rate,
            subtotal: calc.subtotal,
            iva_amount: calc.iva,
            total: calc.total,
          };
        });

      formData.set("items_json", JSON.stringify(validItems));
      formData.set("subtotal_0", totals.subtotal0.toString());
      formData.set("subtotal_15", totals.subtotal15.toString());
      formData.set("iva_amount", totals.ivaAmount.toString());
      formData.set("total", totals.total.toString());
      const mainCategory = validItems[0]?.category || initialData?.category || (area === "clinica" ? "Insumo y Material" : "Suministro");
      formData.set("category", mainCategory);
      if (selectedFacturaClave) {
        formData.set("factura_recibida_clave_acceso", selectedFacturaClave);
      }
      if (authNumber) {
        formData.set("authorization_number", authNumber);
      }

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

  // Filtrado de facturas pendientes para el buscador
  const filteredFacturas = pendingFacturas.filter((f) => {
    if (!facturaSearch.trim()) return true;
    const q = facturaSearch.toLowerCase();
    return (
      (f.razon_social || "").toLowerCase().includes(q) ||
      (f.ruc_emisor || "").toLowerCase().includes(q) ||
      (f.numero_comprobante || "").toLowerCase().includes(q)
    );
  });

  const facturaVinculada = selectedFacturaClave
    ? pendingFacturas.find((f) => f.clave_acceso === selectedFacturaClave)
    : null;

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="bg-white border border-lilac-200/80 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        {isEditing && <input type="hidden" name="id" value={initialData.id} />}
        {existingReceiptUrl && <input type="hidden" name="existing_receipt_url" value={existingReceiptUrl} />}
        <input type="hidden" name="category" value={items[0]?.category || initialData?.category || (area === "clinica" ? "Insumo y Material" : "Suministro")} />
        <input type="hidden" name="factura_recibida_clave_acceso" value={selectedFacturaClave || ""} />
        <input type="hidden" name="authorization_number" value={authNumber || ""} />

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-3.5 py-2.5 rounded-xl font-medium flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700 p-1">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── PANEL DE VINCULACIÓN CON FACTURAS RECIBIDAS DEL SRI ── */}
        {!isEditing && pendingFacturas.length > 0 && (
          <div className="bg-gradient-to-r from-lilac-50/70 via-indigo-50/40 to-teal-50/50 border border-lilac-200/90 rounded-2xl p-3.5 space-y-2.5 transition">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-lilac-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Receipt size={15} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink-900 tracking-tight">
                      Vincular Factura Electrónica Recibida (SRI)
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-lilac-200/70 text-lilac-900">
                      {pendingFacturas.length} pendientes
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-500">
                    Selecciona una factura descargada del SRI para autocompletar cabecera, montos y detalle
                  </p>
                </div>
              </div>

              {facturaVinculada ? (
                <div className="flex items-center gap-2 bg-white/90 border border-teal-300 rounded-xl px-2.5 py-1 text-xs">
                  <CheckCircle2 size={14} className="text-teal-600 shrink-0" />
                  <span className="font-semibold text-teal-950 font-mono text-[11px]">
                    {facturaVinculada.numero_comprobante || "Factura SRI"}
                  </span>
                  <button
                    type="button"
                    onClick={desvincularFactura}
                    className="text-ink-400 hover:text-red-600 p-0.5 rounded transition"
                    title="Desvincular factura"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setFacturaDropdownOpen(!facturaDropdownOpen)}
                  className="inline-flex items-center gap-1.5 bg-white border border-lilac-300 hover:border-lilac-400 text-lilac-700 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs hover:bg-lilac-50/50 transition"
                >
                  <Sparkles size={13} className="text-lilac-600" />
                  {facturaDropdownOpen ? "Cerrar catálogo" : "Elegir factura recibida"}
                </button>
              )}
            </div>

            {/* Menú desplegable o buscador de facturas pendientes */}
            {facturaDropdownOpen && (
              <div className="bg-white border border-lilac-200 rounded-xl p-3 shadow-md space-y-2 mt-2 animate-fadeIn">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    value={facturaSearch}
                    onChange={(e) => setFacturaSearch(e.target.value)}
                    placeholder="Buscar por proveedor, RUC o N° comprobante..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-lilac-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-lilac-50/30 font-medium"
                    autoFocus
                  />
                </div>

                <div className="max-h-56 overflow-y-auto divide-y divide-lilac-50 text-xs">
                  {filteredFacturas.length === 0 ? (
                    <p className="text-ink-400 text-center py-4 text-[11px]">No se encontraron facturas coincidentes.</p>
                  ) : (
                    filteredFacturas.map((fac) => (
                      <div
                        key={fac.clave_acceso}
                        className="py-2 px-2 hover:bg-lilac-50/60 rounded-lg flex items-center justify-between gap-3 transition cursor-pointer"
                        onClick={() => aplicarFacturaRecibida(fac)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink-900 truncate">
                              {fac.razon_social || "Sin Razón Social"}
                            </span>
                            <span className="text-[10px] text-ink-500 font-mono">
                              RUC: {fac.ruc_emisor}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-ink-400 mt-0.5 font-mono">
                            <span>#{fac.numero_comprobante || "N/A"}</span>
                            <span>{fac.fecha_emision}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-ink-950 text-sm block">
                            ${Number(fac.total || 0).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-lilac-600 font-semibold hover:underline">
                            Cargar datos →
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 1. Encabezado: Destino del Gasto y Tipo de Comprobante ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-lilac-100">
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

          <div className="space-y-1 sm:text-right">
            <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wide block">
              Comprobante
            </span>
            <select
              value={docType}
              onChange={(e) => {
                const val = e.target.value as any;
                setDocType(val);
                if (val !== "factura") {
                  // Si no es factura, setear tarifa iva 0 en ítems
                  setItems((prev) => prev.map((it) => ({ ...it, iva_rate: 0 })));
                }
              }}
              className="border border-lilac-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-ink-800 bg-white focus:outline-none focus:ring-2 focus:ring-lilac-400"
            >
              <option value="factura">Factura</option>
              <option value="nota_venta">Nota de Venta</option>
              <option value="sin_documento">Gasto Directo (Sin Doc)</option>
            </select>
            <input type="hidden" name="document_type" value={docType} />
          </div>
        </div>

        {/* ── 2. RUC y Proveedor ── */}
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

        {/* ── 3. N° Documento y Fecha ── */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {!isSinDocumento ? (
            <>
              <div className="sm:col-span-6 space-y-1">
                <label className="text-xs font-semibold text-ink-700">
                  N° {docType === "factura" ? "Factura" : "Nota de Venta"} (opcional)
                </label>
                <input
                  name="document_number"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
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
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
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
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
              />
              <input type="hidden" name="document_number" value="" />
            </div>
          )}
        </div>

        {/* ── 4. Descripción General ── */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-700">Descripción / Justificación General</label>
          <input
            name="description"
            defaultValue={initialData?.description || ""}
            placeholder="Resumen o justificación del gasto (opcional)"
            className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
          />
        </div>

        {/* ── 5. DETALLE DE ÍTEMS / LÍNEAS DEL GASTO (CABECERA Y DETALLE) ── */}
        <div className="border border-lilac-200 rounded-2xl p-3 sm:p-4 bg-lilac-50/20 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wide flex items-center gap-1.5">
                <FileCheck2 size={15} className="text-lilac-600" />
                Detalle de Ítems / Bienes o Servicios
              </h3>
              <p className="text-[11px] text-ink-500">
                Desglose de productos o servicios adquiridos
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1 text-xs font-bold text-lilac-700 hover:text-lilac-900 bg-white border border-lilac-300 hover:bg-lilac-50 px-2.5 py-1 rounded-xl shadow-2xs transition"
              >
                <Plus size={13} /> Agregar Ítem
              </button>
            </div>
          </div>

          {/* Tabla de ítems */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-lilac-200 text-ink-500 text-[11px] font-bold uppercase tracking-wider text-left">
                  <th className="py-2 pr-3 font-bold">Descripción del Bien / Servicio</th>
                  <th className="py-2 px-2 w-36 sm:w-40 font-bold">Categoría Contable</th>
                  <th className="py-2 px-2 w-16 text-center font-bold">Cant.</th>
                  <th className="py-2 px-2 w-24 text-right font-bold">P. Unitario ($)</th>
                  {docType === "factura" && (
                    <th className="py-2 px-2 w-16 text-center font-bold">IVA</th>
                  )}
                  <th className="py-2 pl-2 pr-1 w-20 text-right font-bold">Subtotal</th>
                  <th className="py-2 pl-1 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-100">
                {items.map((item, idx) => {
                  const calc = calculateItemRow(item);
                  const currentCat = normalizeCategoryName(item.category);
                  const catDetail = EXPENSE_CATEGORY_DETAILS[currentCat];
                  return (
                    <tr key={item.id} className="group hover:bg-white/60">
                      <td className="py-2 pr-3 align-middle">
                        <input
                          type="text"
                          required
                          value={item.description}
                          onChange={(e) => updateItemRow(item.id, "description", e.target.value)}
                          placeholder={`Ej. Descripción del bien o servicio ${idx + 1}`}
                          className="w-full border border-lilac-200 rounded-lg px-3 py-1.5 bg-white text-ink-900 text-xs focus:ring-1 focus:ring-lilac-400 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-2 align-middle w-36 sm:w-40">
                        <select
                          value={currentCat}
                          onChange={(e) => updateItemRow(item.id, "category", e.target.value)}
                          title={`${catDetail?.description || currentCat} — Contempla: ${catDetail?.examples || ""}`}
                          className="w-full border border-lilac-200 rounded-lg px-2 py-1.5 bg-white text-ink-900 text-xs font-semibold focus:ring-1 focus:ring-lilac-400 focus:outline-none truncate"
                        >
                          {EXPENSE_ITEM_CATEGORIES.map((cat) => (
                            <option
                              key={cat}
                              value={cat}
                              title={`${EXPENSE_CATEGORY_DETAILS[cat]?.description} (${EXPENSE_CATEGORY_DETAILS[cat]?.examples})`}
                            >
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2 align-top">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          value={item.quantity}
                          onChange={(e) => updateItemRow(item.id, "quantity", e.target.value)}
                          className="w-full border border-lilac-200 rounded-lg px-2 py-1.5 bg-white text-center text-ink-900 text-xs font-mono focus:ring-1 focus:ring-lilac-400 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={item.unit_price}
                          onChange={(e) => updateItemRow(item.id, "unit_price", e.target.value)}
                          placeholder="0.00"
                          className="w-full border border-lilac-200 rounded-lg px-2 py-1.5 bg-white text-right text-ink-900 text-xs font-mono focus:ring-1 focus:ring-lilac-400 focus:outline-none"
                        />
                      </td>
                      {docType === "factura" && (
                        <td className="py-2 px-2 text-center">
                          <select
                            value={item.iva_rate}
                            onChange={(e) => updateItemRow(item.id, "iva_rate", Number(e.target.value))}
                            className="border border-lilac-200 rounded-lg px-1.5 py-1.5 bg-white text-xs font-semibold text-ink-800 focus:ring-1 focus:ring-lilac-400 focus:outline-none"
                          >
                            <option value={15}>15%</option>
                            <option value={0}>0%</option>
                          </select>
                        </td>
                      )}
                      <td className="py-2 pl-2 pr-1 text-right font-mono font-bold text-ink-900 text-xs">
                        ${calc.subtotal.toFixed(2)}
                      </td>
                      <td className="py-2 pl-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(item.id)}
                          className="text-ink-300 hover:text-red-600 p-1 rounded transition"
                          title="Eliminar fila"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Resumen dinámico del detalle */}
          <div className="pt-2 border-t border-lilac-200/60 flex flex-wrap items-center justify-end gap-x-6 gap-y-1.5 text-xs text-ink-600 font-medium">
            <div>
              <span>Subtotal 0%: </span>
              <strong className="font-mono text-ink-900">${totals.subtotal0.toFixed(2)}</strong>
            </div>
            {docType === "factura" && (
              <>
                <div>
                  <span>Subtotal 15%: </span>
                  <strong className="font-mono text-ink-900">${totals.subtotal15.toFixed(2)}</strong>
                </div>
                <div>
                  <span>IVA 15%: </span>
                  <strong className="font-mono text-lilac-700">${totals.ivaAmount.toFixed(2)}</strong>
                </div>
              </>
            )}
            <div className="text-sm font-bold text-ink-950">
              <span>Total Detalle: </span>
              <span className="font-mono text-lilac-700 font-black">${totals.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* ── 6. Forma de Pago ── */}
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

          {needsAccount && (
            <div className="space-y-1.5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className={needsReference ? "sm:col-span-7 space-y-1" : "sm:col-span-12 space-y-1"}>
                  <label className="text-xs font-semibold text-ink-700">{accountLabel} *</label>
                  <select
                    name="bank_account_id"
                    required
                    defaultValue={
                      initialData?.bank_account_id ||
                      (method === "efectivo" && accountOptions.length === 1 ? accountOptions[0].id : "")
                    }
                    className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
                  >
                    <option value="">
                      {method === "efectivo" ? "— Seleccionar Caja Chica —" : "— Seleccionar Cuenta Bancaria —"}
                    </option>
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
                      placeholder="Ej. TRF-123456"
                      className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono text-ink-900"
                    />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-ink-500">
                {method === "efectivo"
                  ? "ℹ️ Todo pago en efectivo debe liquidarse exclusivamente desde una Caja Chica autorizada."
                  : "ℹ️ Transferencias originadas exclusivamente desde cuentas bancarias habilitadas de la institución."}
              </p>
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

        {/* Input oculto para adjuntar archivo nativo */}
        <input
          ref={fileInputRef}
          type="file"
          name="receipt_file"
          accept=".pdf,image/*"
          onChange={onFileInputChange}
          className="hidden"
        />

        {/* ── 7. Franja Inferior: Respaldo + Total + Botón Guardar ── */}
        <div className="pt-3 border-t border-lilac-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
            <div className="text-left sm:text-right">
              <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider block">
                Total a Pagar
              </span>
              <span className="text-2xl font-black text-lilac-700 font-mono">
                ${totals.total.toFixed(2)}
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

      {/* Modal Guía de Categorías Contables */}
      {guiaCategoriasOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setGuiaCategoriasOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-lilac-200 animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-lilac-100 flex items-center justify-between bg-lilac-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-lilac-600 text-white flex items-center justify-center shadow-xs">
                  <HelpCircle size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-900">Guía de Categorías Contables</h3>
                  <p className="text-[11px] text-ink-500">¿Qué contempla cada categoría y a qué cuenta NIIF se direcciona?</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuiaCategoriasOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-lilac-100 flex items-center justify-center text-ink-500 hover:text-ink-700 transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3">
              {EXPENSE_ITEM_CATEGORIES.map((catKey) => {
                const detail = EXPENSE_CATEGORY_DETAILS[catKey];
                return (
                  <div key={catKey} className="p-3.5 rounded-xl border border-lilac-100 bg-white hover:bg-lilac-50/40 transition space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-ink-950 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-lilac-600"></span>
                        {detail.name}
                      </span>
                      <span className="text-[10px] font-mono font-bold bg-lilac-100 text-lilac-800 px-2 py-0.5 rounded-full border border-lilac-200">
                        Cta {detail.accountCode} · {detail.accountName}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-700 font-medium leading-relaxed">
                      {detail.description}
                    </p>
                    <div className="text-[11px] text-ink-600 bg-lilac-50/60 rounded-lg p-2 border border-lilac-100/80 leading-relaxed">
                      <strong className="text-ink-900">¿Qué contempla?</strong> {detail.examples}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-lilac-100 bg-lilac-50/30 flex justify-end">
              <button
                type="button"
                onClick={() => setGuiaCategoriasOpen(false)}
                className="px-4 py-2 bg-ink-900 hover:bg-ink-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                Cerrar Guía
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
