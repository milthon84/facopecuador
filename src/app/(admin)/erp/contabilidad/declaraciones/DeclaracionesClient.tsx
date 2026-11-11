"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  FileText,
  Upload,
  Trash2,
  Eye,
  Download,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  ExternalLink,
  PlusCircle,
  FileCode,
  FileArchive,
  FileSpreadsheet,
  FileImage,
  File as FileIcon,
  Search,
  Filter,
  Check,
  Copy,
  Clock,
  ArrowLeft,
  Receipt,
  Lock,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { proxyStorageUrl } from "@/lib/storage-proxy";
import {
  TaxDeclarationDocument,
  TaxDocType,
  TAX_DOC_CATEGORIES,
  MONTH_NAMES_ES,
  getCategoryDef,
  formatFileSize,
} from "@/lib/tax-declarations";

interface DeclaracionesClientProps {
  initialDocuments: TaxDeclarationDocument[];
  initialPeriod: string; // "YYYY-MM"
  closedPeriods: string[];
  tableMissing?: boolean;
}

export default function DeclaracionesClient({
  initialDocuments = [],
  initialPeriod,
  closedPeriods = [],
  tableMissing: initialTableMissing = false,
}: DeclaracionesClientProps) {
  // Estado general
  const [documents, setDocuments] = useState<TaxDeclarationDocument[]>(initialDocuments);
  const [tableMissing, setTableMissing] = useState(initialTableMissing);

  // Período activo
  const initialYear = Number(initialPeriod.split("-")[0]) || new Date().getFullYear();
  const initialMonth = Number(initialPeriod.split("-")[1]) || (new Date().getMonth() + 1);

  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth);
  const [viewAllMonths, setViewAllMonths] = useState(false);

  const selectedPeriod = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

  // Filtros de documentos
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState("");

  // Modales
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<TaxDeclarationDocument | null>(null);
  const [docToDelete, setDocToDelete] = useState<TaxDeclarationDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Formulario de subida
  const [uploadPeriod, setUploadPeriod] = useState<string>(selectedPeriod);
  const [uploadDocType, setUploadDocType] = useState<TaxDocType>("iva_104");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copiado SQL
  const [copiedSql, setCopiedSql] = useState(false);

  // Años disponibles (año actual +/- 3 años)
  const availableYears = useMemo(() => {
    const curYear = new Date().getFullYear();
    return [curYear + 1, curYear, curYear - 1, curYear - 2, curYear - 3];
  }, []);

  // Conjunto de períodos cerrados
  const closedSet = useMemo(() => new Set(closedPeriods), [closedPeriods]);

  // Agrupar conteo de documentos por mes en el año seleccionado
  const docsByMonth = useMemo(() => {
    const map: Record<number, TaxDeclarationDocument[]> = {};
    for (let m = 1; m <= 12; m++) map[m] = [];

    for (const doc of documents) {
      if (doc.year === selectedYear) {
        if (!map[doc.month]) map[doc.month] = [];
        map[doc.month].push(doc);
      }
    }
    return map;
  }, [documents, selectedYear]);

  // Documentos filtrados para la vista actual
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Filtro de período
      if (!viewAllMonths) {
        if (doc.period !== selectedPeriod) return false;
      } else {
        if (doc.year !== selectedYear) return false;
      }

      // Filtro por tipo/categoría
      if (categoryFilter !== "todos" && doc.document_type !== categoryFilter) {
        return false;
      }

      // Filtro de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = doc.title?.toLowerCase().includes(q);
        const matchName = doc.file_name?.toLowerCase().includes(q);
        const matchNotes = doc.notes?.toLowerCase().includes(q);
        return matchTitle || matchName || matchNotes;
      }

      return true;
    });
  }, [documents, viewAllMonths, selectedPeriod, selectedYear, categoryFilter, searchQuery]);

  // Estado de las 4 obligaciones principales del mes seleccionado
  const activeMonthDocs = docsByMonth[selectedMonth] || [];
  const hasIva104 = activeMonthDocs.some((d) => d.document_type === "iva_104");
  const hasRet103 = activeMonthDocs.some((d) => d.document_type === "retenciones_103");
  const hasPagoSri = activeMonthDocs.some((d) => d.document_type === "pago_sri");
  const hasAts = activeMonthDocs.some((d) => d.document_type === "ats");

  // Abrir modal con categoría preseleccionada
  const openUploadModal = (docType?: TaxDocType) => {
    const targetType = docType || "iva_104";
    const [y, m] = selectedPeriod.split("-").map(Number);
    const monthName = MONTH_NAMES_ES[m - 1];
    const catDef = getCategoryDef(targetType);

    setUploadPeriod(selectedPeriod);
    setUploadDocType(targetType);
    setUploadTitle(catDef.defaultTitleTemplate(monthName, y));
    setUploadNotes("");
    setUploadFile(null);
    setUploadError("");
    setUploadSuccess("");
    setIsUploadOpen(true);
  };

  // Al cambiar la categoría en el modal, actualizar el título sugerido
  const handleDocTypeChange = (type: TaxDocType) => {
    setUploadDocType(type);
    const [y, m] = uploadPeriod.split("-").map(Number);
    const monthName = MONTH_NAMES_ES[m - 1] || "";
    const catDef = getCategoryDef(type);
    setUploadTitle(catDef.defaultTitleTemplate(monthName, y));
  };

  // Al cambiar el mes en el modal, actualizar el título sugerido
  const handleUploadPeriodChange = (newPeriod: string) => {
    setUploadPeriod(newPeriod);
    const [y, m] = newPeriod.split("-").map(Number);
    const monthName = MONTH_NAMES_ES[m - 1] || "";
    const catDef = getCategoryDef(uploadDocType);
    setUploadTitle(catDef.defaultTitleTemplate(monthName, y));
  };

  // Manejador de subida
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      setUploadError("Por favor ingresa un título o descripción para el respaldo.");
      return;
    }
    if (!uploadFile) {
      setUploadError("Debes seleccionar o arrastrar un archivo para subir.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadError("");

      const formData = new FormData();
      formData.append("period", uploadPeriod);
      formData.append("document_type", uploadDocType);
      formData.append("title", uploadTitle.trim());
      if (uploadNotes.trim()) formData.append("notes", uploadNotes.trim());
      formData.append("documentFile", uploadFile);

      const res = await fetch("/api/admin/contabilidad/declaraciones", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.tableMissing) {
          setTableMissing(true);
        }
        setUploadError(data.error || "Ocurrió un error al subir el documento.");
        return;
      }

      setUploadSuccess("¡Respaldo subido y archivado correctamente!");
      if (data.document) {
        setDocuments((prev) => [data.document, ...prev]);
        setTableMissing(false);
      }

      // Si subió para otro período, sincronizar selección
      if (uploadPeriod !== selectedPeriod && !viewAllMonths) {
        const [upY, upM] = uploadPeriod.split("-").map(Number);
        setSelectedYear(upY);
        setSelectedMonth(upM);
      }

      setTimeout(() => {
        setIsUploadOpen(false);
        setUploadSuccess("");
      }, 1100);
    } catch (err: any) {
      setUploadError(err.message || "Error al procesar el archivo.");
    } finally {
      setIsUploading(false);
    }
  };

  // Manejador de eliminación
  const handleDeleteDoc = async () => {
    if (!docToDelete) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/admin/contabilidad/declaraciones?id=${docToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
        setDocToDelete(null);
        if (previewDoc?.id === docToDelete.id) {
          setPreviewDoc(null);
        }
      } else {
        alert(data.error || "No se pudo eliminar el documento.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al intentar eliminar el respaldo.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper de icono según tipo de archivo
  const getFileIcon = (fileName: string, mimeType?: string | null) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "pdf" || mimeType?.includes("pdf")) {
      return <FileText className="text-red-500" size={24} />;
    }
    if (["xml", "json"].includes(ext || "") || mimeType?.includes("xml")) {
      return <FileCode className="text-cyan-600" size={24} />;
    }
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext || "")) {
      return <FileArchive className="text-amber-600" size={24} />;
    }
    if (["xls", "xlsx", "csv"].includes(ext || "")) {
      return <FileSpreadsheet className="text-emerald-600" size={24} />;
    }
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "") || mimeType?.startsWith("image/")) {
      return <FileImage className="text-blue-500" size={24} />;
    }
    return <FileIcon className="text-slate-500" size={24} />;
  };

  // Helper para saber si se puede previsualizar en modal
  const canPreviewInline = (doc: TaxDeclarationDocument) => {
    const ext = doc.file_name.split(".").pop()?.toLowerCase();
    const isImg =
      ["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "") ||
      doc.file_type?.startsWith("image/");
    const isPdf = ext === "pdf" || doc.file_type?.includes("pdf");
    return isPdf || isImg;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Alerta de migración de base de datos si la tabla no existe */}
      {tableMissing && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
            <div className="flex-1 text-sm">
              <h3 className="font-bold text-amber-900">
                La tabla de respaldos tributarios aún no está creada en Supabase
              </h3>
              <p className="text-amber-800 text-xs mt-1">
                Para comenzar a guardar los archivos, ejecuta el script de migración SQL en tu panel de Supabase (SQL Editor).
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `-- Ejecutar en Supabase SQL Editor\n\\i supabase/migration_tax_declarations.sql`
                    );
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition"
                >
                  {copiedSql ? <Check size={14} /> : <Copy size={14} />}
                  {copiedSql ? "¡Copiado!" : "Copiar instrucción SQL"}
                </button>
                <span className="text-xs text-amber-700">
                  Archivo local: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-[11px]">supabase/migration_tax_declarations.sql</code>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header superior con enlaces de navegación */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-2xl p-4 md:p-5 border border-lilac-100 shadow-sm">
        <div className="flex items-start gap-3">
          <Link
            href="/erp/contabilidad"
            className="p-2 rounded-xl bg-lilac-50 text-lilac-700 hover:bg-lilac-100 transition shrink-0"
            title="Volver a Contabilidad"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                SRI & Tributación
              </span>
              <h1 className="text-xl font-bold text-ink-900">
                Respaldos de Declaraciones Tributarias
              </h1>
            </div>
            <p className="text-xs text-ink-500 mt-1">
              Expediente digital mensual de declaraciones SRI: Formulario 104 (IVA), 103 (Retenciones), Comprobantes de Pago CEEP, ATS y justificativos.
            </p>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => openUploadModal()}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition"
          >
            <PlusCircle size={15} />
            <span>Subir Respaldo</span>
          </button>
        </div>
      </div>

      {/* Selector de Año y Cuadrícula de 12 Meses */}
      <div className="bg-white rounded-2xl p-4 md:p-5 border border-lilac-100 shadow-sm space-y-4">
        {/* Barra superior de año */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-lilac-50">
          <div className="flex items-center gap-2">
            <Calendar className="text-lilac-600" size={18} />
            <span className="text-xs font-bold text-ink-700 uppercase tracking-wide">
              Ejercicio Fiscal:
            </span>
            <div className="flex items-center gap-1 bg-lilac-50/60 p-1 rounded-xl">
              {availableYears.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setSelectedYear(y)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedYear === y
                      ? "bg-lilac-600 text-white shadow-xs"
                      : "text-ink-600 hover:bg-white hover:text-lilac-700"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* Alternar vista de todo el año */}
          <button
            type="button"
            onClick={() => setViewAllMonths(!viewAllMonths)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              viewAllMonths
                ? "bg-lilac-100 text-lilac-800 border border-lilac-300"
                : "bg-white border border-gray-200 text-ink-600 hover:bg-gray-50"
            }`}
          >
            <Layers size={13} />
            <span>{viewAllMonths ? "Viendo todo el año" : "Ver todo el año completo"}</span>
          </button>
        </div>

        {/* Cuadrícula organizada de los 12 meses */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {MONTH_NAMES_ES.map((name, idx) => {
            const m = idx + 1;
            const periodKey = `${selectedYear}-${String(m).padStart(2, "0")}`;
            const monthDocs = docsByMonth[m] || [];
            const docCount = monthDocs.length;
            const isClosed = closedSet.has(periodKey);
            const isSelected = !viewAllMonths && selectedMonth === m;

            // Flags de documentos claves
            const has104 = monthDocs.some((d) => d.document_type === "iva_104");
            const has103 = monthDocs.some((d) => d.document_type === "retenciones_103");
            const hasCeep = monthDocs.some((d) => d.document_type === "pago_sri");
            const hasAtsDoc = monthDocs.some((d) => d.document_type === "ats");

            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setSelectedMonth(m);
                  setViewAllMonths(false);
                }}
                className={`relative p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-24 ${
                  isSelected
                    ? "bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-400 shadow-xs"
                    : "bg-white border-lilac-100 hover:border-lilac-300 hover:bg-lilac-50/30"
                }`}
              >
                {/* Header de la tarjeta del mes */}
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-bold leading-tight ${isSelected ? "text-emerald-900" : "text-ink-800"}`}>
                    {name}
                  </span>
                  {isClosed && (
                    <span
                      title="Período con Cierre Mensual Contable"
                      className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200"
                    >
                      <Lock size={10} className="inline mr-0.5" />
                    </span>
                  )}
                </div>

                {/* Indicadores de comprobantes subidos */}
                <div className="flex items-center gap-1 my-1">
                  <span
                    title={has104 ? "Formulario 104 (IVA) cargado" : "Pendiente Form. 104"}
                    className={`w-2 h-2 rounded-full ${has104 ? "bg-emerald-500 ring-1 ring-emerald-300" : "bg-gray-200"}`}
                  />
                  <span
                    title={has103 ? "Formulario 103 (Retenciones) cargado" : "Pendiente Form. 103"}
                    className={`w-2 h-2 rounded-full ${has103 ? "bg-blue-500 ring-1 ring-blue-300" : "bg-gray-200"}`}
                  />
                  <span
                    title={hasCeep ? "Comprobante de Pago SRI cargado" : "Pendiente Pago SRI"}
                    className={`w-2 h-2 rounded-full ${hasCeep ? "bg-indigo-500 ring-1 ring-indigo-300" : "bg-gray-200"}`}
                  />
                  <span
                    title={hasAtsDoc ? "Talón ATS cargado" : "Pendiente ATS"}
                    className={`w-2 h-2 rounded-full ${hasAtsDoc ? "bg-purple-500 ring-1 ring-purple-300" : "bg-gray-200"}`}
                  />
                </div>

                {/* Badge de cantidad */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className={`font-semibold ${docCount > 0 ? "text-emerald-700" : "text-ink-400"}`}>
                    {docCount} {docCount === 1 ? "archivo" : "archivos"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel del Mes Activo: Resumen de Obligaciones y Accesos Rápidos */}
      {!viewAllMonths && (
        <div className="bg-gradient-to-r from-emerald-50/60 via-lilac-50/40 to-white rounded-2xl p-4 md:p-5 border border-emerald-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <FileCheck2 className="text-emerald-600" size={20} />
              <h2 className="text-base font-bold text-ink-900">
                Obligaciones Tributarias — {MONTH_NAMES_ES[selectedMonth - 1]} {selectedYear}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-600">
              <span className="text-[11px] font-semibold text-ink-400">Accesos directos del mes:</span>
              <Link
                href={`/erp/contabilidad/iva?period=${selectedPeriod}`}
                className="px-2 py-1 rounded-lg bg-white border border-lilac-200 hover:bg-lilac-50 text-ink-700 font-medium transition"
              >
                Cálculo IVA
              </Link>
              <Link
                href={`/erp/contabilidad/ats?period=${selectedPeriod}`}
                className="px-2 py-1 rounded-lg bg-white border border-lilac-200 hover:bg-lilac-50 text-ink-700 font-medium transition"
              >
                Generar ATS
              </Link>
              <Link
                href={`/erp/contabilidad/cierre?period=${selectedPeriod}`}
                className="px-2 py-1 rounded-lg bg-white border border-lilac-200 hover:bg-lilac-50 text-ink-700 font-medium transition"
              >
                Cierre Contable
              </Link>
            </div>
          </div>

          {/* 4 Cards de estado de obligaciones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Formulario 104 (IVA) */}
            <div className={`p-3 rounded-xl border transition-all ${
              hasIva104 ? "bg-white border-emerald-300 shadow-xs" : "bg-white/80 border-dashed border-gray-300"
            }`}>
              <div className="flex items-start justify-between gap-1">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    Form. 104
                  </span>
                  <p className="text-xs font-bold text-ink-900 leading-tight mt-0.5">
                    Declaración IVA
                  </p>
                </div>
                {hasIva104 ? (
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 size={13} />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
                    <Clock size={12} />
                  </span>
                )}
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs">
                <span className={hasIva104 ? "text-emerald-700 font-semibold" : "text-gray-500 italic"}>
                  {hasIva104 ? "Cargado al archivo" : "Pendiente"}
                </span>
                <button
                  type="button"
                  onClick={() => openUploadModal("iva_104")}
                  className="text-xs text-emerald-700 hover:text-emerald-900 font-bold underline decoration-dotted"
                >
                  {hasIva104 ? "+ Subir otro" : "+ Subir"}
                </button>
              </div>
            </div>

            {/* 2. Formulario 103 (Retenciones) */}
            <div className={`p-3 rounded-xl border transition-all ${
              hasRet103 ? "bg-white border-blue-300 shadow-xs" : "bg-white/80 border-dashed border-gray-300"
            }`}>
              <div className="flex items-start justify-between gap-1">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                    Form. 103
                  </span>
                  <p className="text-xs font-bold text-ink-900 leading-tight mt-0.5">
                    Retenciones Fuente
                  </p>
                </div>
                {hasRet103 ? (
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                    <CheckCircle2 size={13} />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
                    <Clock size={12} />
                  </span>
                )}
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs">
                <span className={hasRet103 ? "text-blue-700 font-semibold" : "text-gray-500 italic"}>
                  {hasRet103 ? "Cargado al archivo" : "Pendiente"}
                </span>
                <button
                  type="button"
                  onClick={() => openUploadModal("retenciones_103")}
                  className="text-xs text-blue-700 hover:text-blue-900 font-bold underline decoration-dotted"
                >
                  {hasRet103 ? "+ Subir otro" : "+ Subir"}
                </button>
              </div>
            </div>

            {/* 3. Comprobante de Pago SRI (CEEP) */}
            <div className={`p-3 rounded-xl border transition-all ${
              hasPagoSri ? "bg-white border-indigo-300 shadow-xs" : "bg-white/80 border-dashed border-gray-300"
            }`}>
              <div className="flex items-start justify-between gap-1">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
                    CEEP / Débito
                  </span>
                  <p className="text-xs font-bold text-ink-900 leading-tight mt-0.5">
                    Comprobante de Pago
                  </p>
                </div>
                {hasPagoSri ? (
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <CheckCircle2 size={13} />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
                    <Clock size={12} />
                  </span>
                )}
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs">
                <span className={hasPagoSri ? "text-indigo-700 font-semibold" : "text-gray-500 italic"}>
                  {hasPagoSri ? "Cargado al archivo" : "Pendiente"}
                </span>
                <button
                  type="button"
                  onClick={() => openUploadModal("pago_sri")}
                  className="text-xs text-indigo-700 hover:text-indigo-900 font-bold underline decoration-dotted"
                >
                  {hasPagoSri ? "+ Subir otro" : "+ Subir"}
                </button>
              </div>
            </div>

            {/* 4. ATS / Talón Resumen */}
            <div className={`p-3 rounded-xl border transition-all ${
              hasAts ? "bg-white border-purple-300 shadow-xs" : "bg-white/80 border-dashed border-gray-300"
            }`}>
              <div className="flex items-start justify-between gap-1">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
                    ATS SRI
                  </span>
                  <p className="text-xs font-bold text-ink-900 leading-tight mt-0.5">
                    Talón Anexo Transacc.
                  </p>
                </div>
                {hasAts ? (
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
                    <CheckCircle2 size={13} />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
                    <Clock size={12} />
                  </span>
                )}
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs">
                <span className={hasAts ? "text-purple-700 font-semibold" : "text-gray-500 italic"}>
                  {hasAts ? "Cargado al archivo" : "Pendiente"}
                </span>
                <button
                  type="button"
                  onClick={() => openUploadModal("ats")}
                  className="text-xs text-purple-700 hover:text-purple-900 font-bold underline decoration-dotted"
                >
                  {hasAts ? "+ Subir otro" : "+ Subir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Documentos con Filtros y Buscador */}
      <div className="bg-white rounded-2xl border border-lilac-100 shadow-sm overflow-hidden">
        {/* Barra de Filtros y Búsqueda */}
        <div className="p-4 border-b border-lilac-50 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-lilac-50/20">
          {/* Filtros por Categoría */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setCategoryFilter("todos")}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                categoryFilter === "todos"
                  ? "bg-lilac-600 text-white shadow-xs"
                  : "bg-white border border-gray-200 text-ink-600 hover:bg-gray-50"
              }`}
            >
              Todos ({filteredDocuments.length})
            </button>
            {TAX_DOC_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  categoryFilter === cat.id
                    ? "bg-lilac-600 text-white shadow-xs"
                    : "bg-white border border-gray-200 text-ink-600 hover:bg-gray-50"
                }`}
              >
                {cat.shortLabel}
              </button>
            ))}
          </div>

          {/* Buscador */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar título, archivo o nota..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
            />
          </div>
        </div>

        {/* Tabla / Listado de Archivos */}
        {filteredDocuments.length === 0 ? (
          <div className="py-14 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
              <FileCheck2 size={24} />
            </div>
            <h3 className="text-sm font-bold text-ink-800">
              No hay documentos de respaldo para este criterio
            </h3>
            <p className="text-xs text-ink-500 max-w-md mx-auto mt-1">
              {!viewAllMonths
                ? `Aún no se han cargado declaraciones ni comprobantes para ${MONTH_NAMES_ES[selectedMonth - 1]} ${selectedYear}.`
                : `No se encontraron documentos en el ejercicio fiscal ${selectedYear}.`}
            </p>
            <button
              type="button"
              onClick={() => openUploadModal()}
              className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition"
            >
              <Upload size={14} />
              <span>Subir primer respaldo</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-lilac-50">
            {filteredDocuments.map((doc) => {
              const catDef = getCategoryDef(doc.document_type);
              const previewable = canPreviewInline(doc);
              const proxiedUrl = proxyStorageUrl(doc.file_url);

              return (
                <div
                  key={doc.id}
                  className="p-4 hover:bg-lilac-50/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 shrink-0">
                      {getFileIcon(doc.file_name, doc.file_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${catDef.badgeColor}`}>
                          {catDef.shortLabel}
                        </span>
                        {viewAllMonths && (
                          <span className="text-[10px] font-semibold text-ink-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {MONTH_NAMES_ES[doc.month - 1]} {doc.year}
                          </span>
                        )}
                        <h4 className="text-sm font-bold text-ink-900 truncate">
                          {doc.title}
                        </h4>
                      </div>

                      {doc.notes && (
                        <p className="text-xs text-ink-600 mt-1 italic line-clamp-2">
                          “{doc.notes}”
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-400 mt-1.5">
                        <span className="font-mono text-ink-500">{doc.file_name}</span>
                        {doc.file_size && <span>• {formatFileSize(doc.file_size)}</span>}
                        <span>• Subido el {new Date(doc.created_at).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        {doc.uploaded_by_email && (
                          <span className="text-ink-400">por {doc.uploaded_by_email.split("@")[0]}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones del archivo */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {previewable ? (
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-ink-700 text-xs font-semibold flex items-center gap-1 transition"
                        title="Ver vista previa"
                      >
                        <Eye size={13} />
                        <span className="hidden sm:inline">Ver</span>
                      </button>
                    ) : (
                      <a
                        href={proxiedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-ink-700 text-xs font-semibold flex items-center gap-1 transition"
                        title="Abrir archivo"
                      >
                        <ExternalLink size={13} />
                        <span className="hidden sm:inline">Abrir</span>
                      </a>
                    )}

                    <a
                      href={proxiedUrl}
                      download={doc.file_name}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-ink-700 transition"
                      title="Descargar archivo"
                    >
                      <Download size={14} />
                    </a>

                    <button
                      type="button"
                      onClick={() => setDocToDelete(doc)}
                      className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition"
                      title="Eliminar respaldo"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: SUBIR RESPALDO */}
      <StandardModal
        isOpen={isUploadOpen}
        onClose={() => !isUploading && setIsUploadOpen(false)}
        title="Subir Respaldo de Declaración Tributaria"
        subtitle="Archiva formularios SRI, comprobantes de pago o anexos organizados por mes"
        icon={<Upload size={20} className="text-emerald-600" />}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          {uploadError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-semibold">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
              <span>{uploadSuccess}</span>
            </div>
          )}

          {/* Selector de Período y Categoría */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink-700 mb-1">
                Período Fiscal (Mes / Año) *
              </label>
              <select
                value={uploadPeriod}
                onChange={(e) => handleUploadPeriodChange(e.target.value)}
                className="w-full text-xs rounded-xl border border-gray-300 p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-medium"
              >
                {availableYears.map((y) =>
                  MONTH_NAMES_ES.map((name, idx) => {
                    const p = `${y}-${String(idx + 1).padStart(2, "0")}`;
                    return (
                      <option key={p} value={p}>
                        {name} {y}
                      </option>
                    );
                  })
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-700 mb-1">
                Tipo de Declaración / Documento *
              </label>
              <select
                value={uploadDocType}
                onChange={(e) => handleDocTypeChange(e.target.value as TaxDocType)}
                className="w-full text-xs rounded-xl border border-gray-300 p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-medium"
              >
                {TAX_DOC_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Título o Asunto */}
          <div>
            <label className="block text-xs font-bold text-ink-700 mb-1">
              Título / Descripción del Respaldo *
            </label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Ej: Declaración IVA Form. 104 - Noviembre 2026"
              className="w-full text-xs rounded-xl border border-gray-300 p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
              required
            />
          </div>

          {/* Notas / Observaciones */}
          <div>
            <label className="block text-xs font-bold text-ink-700 mb-1">
              Notas u Observaciones del Contador (Opcional)
            </label>
            <textarea
              rows={2}
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
              placeholder="Ej: Declaración original con número de adhesión 123456789. Sin valores a pagar."
              className="w-full text-xs rounded-xl border border-gray-300 p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Zona de Arrastrar y Soltar Archivo */}
          <div>
            <label className="block text-xs font-bold text-ink-700 mb-1">
              Archivo Digital * (PDF, XML, ZIP, Imagen o Excel - Máx. 25 MB)
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.[0]) {
                  setUploadFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-emerald-500 bg-emerald-50"
                  : uploadFile
                  ? "border-emerald-400 bg-emerald-50/40"
                  : "border-gray-300 hover:border-emerald-400 hover:bg-gray-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.xml,.zip,.rar,.7z,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setUploadFile(e.target.files[0]);
                  }
                }}
              />

              {uploadFile ? (
                <div className="flex flex-col items-center justify-center">
                  <div className="p-2.5 rounded-full bg-emerald-100 text-emerald-700 mb-2">
                    <CheckCircle2 size={24} />
                  </div>
                  <span className="text-xs font-bold text-ink-900 max-w-xs truncate">
                    {uploadFile.name}
                  </span>
                  <span className="text-[11px] text-ink-500 mt-0.5">
                    {formatFileSize(uploadFile.size)} • Clic para cambiar archivo
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <div className="p-2.5 rounded-full bg-lilac-50 text-lilac-600 mb-2">
                    <Upload size={22} />
                  </div>
                  <span className="text-xs font-bold text-ink-800">
                    Arrastra aquí tu archivo o haz clic para explorar
                  </span>
                  <span className="text-[11px] text-ink-400 mt-1">
                    Formatos soportados: PDF, XML de ATS, ZIP, JPG, PNG, Excel
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => setIsUploadOpen(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-ink-600 hover:bg-gray-50 text-xs font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Subiendo y archivando...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Guardar Respaldo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </StandardModal>

      {/* MODAL: VISTA PREVIA DE DOCUMENTO */}
      <StandardModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || "Vista Previa de Respaldo"}
        subtitle={`${previewDoc?.file_name} • ${formatFileSize(previewDoc?.file_size)}`}
        icon={<Eye size={20} className="text-lilac-600" />}
        maxWidth="max-w-4xl"
      >
        {previewDoc && (
          <div className="space-y-4">
            <div className="bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center min-h-[400px] max-h-[68vh]">
              {previewDoc.file_type?.startsWith("image/") ||
              /\.(jpg|jpeg|png|webp|gif)$/i.test(previewDoc.file_name) ? (
                <img
                  src={proxyStorageUrl(previewDoc.file_url)}
                  alt={previewDoc.title}
                  className="max-h-[65vh] w-auto object-contain mx-auto"
                />
              ) : (
                <iframe
                  src={proxyStorageUrl(previewDoc.file_url)}
                  title={previewDoc.title}
                  className="w-full h-[65vh] border-0"
                />
              )}
            </div>

            {previewDoc.notes && (
              <div className="p-3 bg-lilac-50/60 rounded-xl border border-lilac-100 text-xs text-ink-700">
                <span className="font-bold">Observaciones: </span>
                <span>{previewDoc.notes}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100">
              <span className="text-ink-400">
                Período: {previewDoc.period} • Subido por {previewDoc.uploaded_by_email || "usuario"}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={proxyStorageUrl(previewDoc.file_url)}
                  download={previewDoc.file_name}
                  className="px-3 py-1.5 rounded-lg bg-lilac-600 hover:bg-lilac-700 text-white font-semibold flex items-center gap-1.5 shadow-sm transition"
                >
                  <Download size={13} />
                  <span>Descargar Archivo</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </StandardModal>

      {/* MODAL: CONFIRMAR ELIMINACIÓN */}
      <StandardModal
        isOpen={Boolean(docToDelete)}
        onClose={() => !isDeleting && setDocToDelete(null)}
        title="Eliminar Respaldo de Declaración"
        icon={<Trash2 size={20} className="text-red-600" />}
        maxWidth="max-w-md"
      >
        {docToDelete && (
          <div className="space-y-4">
            <p className="text-xs text-ink-600">
              ¿Estás seguro de que deseas eliminar permanentemente este archivo del expediente tributario?
            </p>
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs">
              <p className="font-bold text-red-900">{docToDelete.title}</p>
              <p className="text-red-700 font-mono text-[11px] mt-0.5">{docToDelete.file_name}</p>
              <p className="text-red-600 text-[10px] mt-1">
                Período: {docToDelete.period} ({MONTH_NAMES_ES[docToDelete.month - 1]} {docToDelete.year})
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-ink-600 hover:bg-gray-50 text-xs font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteDoc}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Sí, eliminar archivo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </StandardModal>
    </div>
  );
}
