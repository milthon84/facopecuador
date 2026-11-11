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
  Building2,
  Sparkles,
  Info,
  X,
  UploadCloud,
  ChevronDown,
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
  detectTaxDocType,
} from "@/lib/tax-declarations";

interface DeclaracionesClientProps {
  initialDocuments: TaxDeclarationDocument[];
  initialPeriod: string; // "YYYY-MM"
  closedPeriods: string[];
  tableMissing?: boolean;
}

interface UploadQueueItem {
  id: string;
  file: File;
  document_type: TaxDocType;
  title: string;
  notes: string;
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
  const initialMonth = initialPeriod.includes("anual")
    ? 0
    : (Number(initialPeriod.split("-")[1]) || (new Date().getMonth() + 1));

  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth); // 0 = Cierre Anual SuperCías, 1..12 = Meses
  const [viewAllMonths, setViewAllMonths] = useState(false);

  const selectedPeriod = selectedMonth === 0
    ? `${selectedYear}-anual`
    : `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

  // Filtros de documentos
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState("");

  // Modales
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<TaxDeclarationDocument | null>(null);
  const [docToDelete, setDocToDelete] = useState<TaxDeclarationDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Formulario de subida multi-archivo
  const [uploadPeriod, setUploadPeriod] = useState<string>(selectedPeriod);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [defaultSuggestedType, setDefaultSuggestedType] = useState<TaxDocType | null>(null);
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

  // Agrupar conteo de documentos por mes y anual (0) en el año seleccionado
  const docsByMonth = useMemo(() => {
    const map: Record<number, TaxDeclarationDocument[]> = {};
    for (let m = 0; m <= 12; m++) map[m] = [];

    for (const doc of documents) {
      if (doc.year === selectedYear) {
        const isAnnual = doc.period?.includes("anual") || doc.month === 0;
        const m = isAnnual ? 0 : Number(doc.month || 0);
        if (!map[m]) map[m] = [];
        map[m].push(doc);
      }
    }
    return map;
  }, [documents, selectedYear]);

  // Documentos filtrados para la vista actual
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Filtro de período
      if (!viewAllMonths) {
        if (selectedMonth === 0) {
          const isDocAnnual = doc.period === `${selectedYear}-anual` || doc.period === `${selectedYear}-00` || (doc.year === selectedYear && doc.month === 0);
          if (!isDocAnnual) return false;
        } else {
          if (doc.period !== selectedPeriod) return false;
        }
      } else {
        if (doc.year !== selectedYear) return false;
      }

      // Filtro por tipo/categoría
      if (categoryFilter !== "todos") {
        if (categoryFilter === "otro") {
          if (doc.document_type !== "otro" && doc.document_type !== "retenciones_recibidas") {
            return false;
          }
        } else if (doc.document_type !== categoryFilter) {
          return false;
        }
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

  // Abrir modal de subida
  const openUploadModal = (preferredType?: TaxDocType) => {
    setUploadPeriod(selectedPeriod);
    setUploadQueue([]);
    setDefaultSuggestedType(preferredType || null);
    setUploadError("");
    setUploadSuccess("");
    setIsUploadOpen(true);
  };

  // Procesar archivos agregados a la cola (arrastrados o seleccionados)
  const addFilesToQueue = (files: FileList | File[]) => {
    const [y, m] = uploadPeriod.split("-").map(Number);
    const monthName = MONTH_NAMES_ES[m - 1] || "";

    const newItems: UploadQueueItem[] = Array.from(files).map((f) => {
      // Si el usuario presionó el botón específico de una obligación (ej: Form. 104) y subió 1 archivo, preferir ese tipo
      let targetType: TaxDocType = defaultSuggestedType || detectTaxDocType(f.name);
      // Si subió múltiples, detectar inteligentemente cada uno por su nombre
      if (files.length > 1 || !defaultSuggestedType) {
        targetType = detectTaxDocType(f.name);
      }

      const catDef = getCategoryDef(targetType);
      return {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        document_type: targetType,
        title: catDef.defaultTitleTemplate(monthName, y),
        notes: "",
      };
    });

    setUploadQueue((prev) => [...prev, ...newItems]);
    setUploadError("");
  };

  // Cambiar período en el modal y actualizar títulos que no hayan sido personalizados
  const handleUploadPeriodChange = (newPeriod: string) => {
    setUploadPeriod(newPeriod);
    const isAnnual = newPeriod.endsWith("-anual");
    const y = Number(newPeriod.split("-")[0]);
    const m = isAnnual ? 0 : Number(newPeriod.split("-")[1]);
    const periodLabel = isAnnual ? `Cierre Anual ${y}` : (MONTH_NAMES_ES[m - 1] || "");

    setUploadQueue((prev) =>
      prev.map((item) => {
        const catDef = getCategoryDef(item.document_type);
        return {
          ...item,
          title: catDef.defaultTitleTemplate(periodLabel, y),
        };
      })
    );
  };

  // Cambiar el tipo de documento para un archivo en la cola
  const updateQueueItemType = (itemId: string, newType: TaxDocType) => {
    const [y, m] = uploadPeriod.split("-").map(Number);
    const monthName = MONTH_NAMES_ES[m - 1] || "";
    const catDef = getCategoryDef(newType);

    setUploadQueue((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              document_type: newType,
              title: catDef.defaultTitleTemplate(monthName, y),
            }
          : item
      )
    );
  };

  // Actualizar título de un archivo en la cola
  const updateQueueItemTitle = (itemId: string, newTitle: string) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, title: newTitle } : item))
    );
  };

  // Actualizar notas de un archivo en la cola
  const updateQueueItemNotes = (itemId: string, newNotes: string) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, notes: newNotes } : item))
    );
  };

  // Eliminar un archivo de la cola de subida
  const removeQueueItem = (itemId: string) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== itemId));
  };

  // Manejador de subida masiva o individual
  const handleBatchUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadQueue.length === 0) {
      setUploadError("Por favor selecciona o arrastra al menos un archivo.");
      return;
    }

    // Validar que todos tengan título
    for (const item of uploadQueue) {
      if (!item.title.trim()) {
        setUploadError(`El archivo "${item.file.name}" debe tener un título.`);
        return;
      }
    }

    try {
      setIsUploading(true);
      setUploadError("");

      const formData = new FormData();
      formData.append("isBatch", "true");

      const meta = uploadQueue.map((item) => ({
        period: uploadPeriod,
        document_type: item.document_type,
        title: item.title.trim(),
        notes: item.notes.trim() || null,
      }));

      formData.append("batchMeta", JSON.stringify(meta));
      uploadQueue.forEach((item) => {
        formData.append("files", item.file);
      });

      const res = await fetch("/api/admin/contabilidad/declaraciones", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.tableMissing) {
          setTableMissing(true);
        }
        setUploadError(data.error || "Ocurrió un error al subir los archivos.");
        return;
      }

      setUploadSuccess(`¡${uploadQueue.length} archivo(s) guardado(s) exitosamente!`);

      if (data.documents && Array.isArray(data.documents)) {
        setDocuments((prev) => [...data.documents, ...prev]);
        setTableMissing(false);
      }

      // Sincronizar el mes activo si subió a un período diferente
      if (uploadPeriod !== selectedPeriod && !viewAllMonths) {
        if (uploadPeriod.endsWith("-anual")) {
          const upY = Number(uploadPeriod.split("-")[0]);
          setSelectedYear(upY);
          setSelectedMonth(0);
        } else {
          const [upY, upM] = uploadPeriod.split("-").map(Number);
          setSelectedYear(upY);
          setSelectedMonth(upM);
        }
      }

      setTimeout(() => {
        setIsUploadOpen(false);
        setUploadSuccess("");
        setUploadQueue([]);
      }, 1000);
    } catch (err: any) {
      setUploadError(err.message || "Error al procesar la subida.");
    } finally {
      setIsUploading(false);
    }
  };

  // Manejador de eliminación permanente
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
      return <FileText className="text-red-500" size={22} />;
    }
    if (["xml", "json"].includes(ext || "") || mimeType?.includes("xml")) {
      return <FileCode className="text-cyan-600" size={22} />;
    }
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext || "")) {
      return <FileArchive className="text-amber-600" size={22} />;
    }
    if (["xls", "xlsx", "csv"].includes(ext || "")) {
      return <FileSpreadsheet className="text-emerald-600" size={22} />;
    }
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "") || mimeType?.startsWith("image/")) {
      return <FileImage className="text-blue-500" size={22} />;
    }
    return <FileIcon className="text-slate-500" size={22} />;
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

  // Cálculo de tamaño total de archivos en cola
  const totalQueueSize = useMemo(() => {
    return uploadQueue.reduce((acc, item) => acc + item.file.size, 0);
  }, [uploadQueue]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Alerta de migración de base de datos si la tabla no existe */}
      {tableMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div className="flex-1 text-xs">
              <h3 className="font-bold text-amber-900">
                La tabla de respaldos tributarios aún no está creada en Supabase
              </h3>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Para comenzar a guardar los archivos, ejecuta el script de migración SQL en tu panel de Supabase.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `-- Ejecutar en Supabase SQL Editor\n\\i supabase/migration_tax_declarations.sql`
                    );
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-2xs transition"
                >
                  {copiedSql ? <Check size={13} /> : <Copy size={13} />}
                  {copiedSql ? "¡Copiado!" : "Copiar SQL"}
                </button>
                <span className="text-[11px] text-amber-700 font-mono">
                  supabase/migration_tax_declarations.sql
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Minimalista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Link
            href="/erp/contabilidad"
            className="p-2 rounded-xl text-ink-500 hover:text-ink-900 hover:bg-gray-100 transition"
            title="Volver a Contabilidad"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-ink-900 tracking-tight">
                Respaldos Tributarios y Societarios
              </h1>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                SRI & SuperCías
              </span>
            </div>
            <p className="text-xs text-ink-400 mt-0.5">
              Expediente mensual SRI (IVA 104, Ret 103, CEP, ATS) y societario anual SuperCías (Balances NIIF, Form. 101, Informes y Actas).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openUploadModal()}
          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 shadow-2xs transition self-start sm:self-auto"
        >
          <UploadCloud size={15} />
          <span>Subir Archivos</span>
        </button>
      </div>

{/* Selector de Período Minimalista con Indicadores de Obligaciones (Puntitos) */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-3 shadow-2xs space-y-2.5">
        {/* Barra superior de años y accesos */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-ink-400 uppercase tracking-wider">Ejercicio:</span>
            <div className="flex items-center gap-1 bg-gray-100/80 p-0.5 rounded-xl">
              {availableYears.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setSelectedYear(y)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    selectedYear === y
                      ? "bg-white text-ink-900 shadow-2xs font-bold"
                      : "text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {!viewAllMonths && (
              <div className="hidden lg:flex items-center gap-1 text-[11px] text-ink-500 mr-1">
                <span className="text-ink-400 text-[10px]">Accesos:</span>
                <Link href={`/erp/contabilidad/iva?period=${selectedPeriod}`} className="px-1.5 py-0.5 rounded hover:bg-gray-100 text-ink-600 font-medium">
                  IVA
                </Link>
                <span>·</span>
                <Link href={`/erp/contabilidad/ats?period=${selectedPeriod}`} className="px-1.5 py-0.5 rounded hover:bg-gray-100 text-ink-600 font-medium">
                  ATS
                </Link>
                <span>·</span>
                <Link href={`/erp/contabilidad/cierre?period=${selectedPeriod}`} className="px-1.5 py-0.5 rounded hover:bg-gray-100 text-ink-600 font-medium">
                  Cierre
                </Link>
              </div>
            )}

            <button
              type="button"
              onClick={() => setViewAllMonths(!viewAllMonths)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                viewAllMonths
                  ? "bg-ink-900 text-white font-semibold"
                  : "text-ink-500 hover:text-ink-900 hover:bg-gray-100"
              }`}
            >
              <Layers size={13} />
              <span>{viewAllMonths ? "Viendo todo el año" : "Ver todo el año"}</span>
            </button>
          </div>
        </div>

        {/* 12 Meses en barra horizontal con puntitos indicadores de las 4 obligaciones */}
        <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-[repeat(13,minmax(0,1fr))] gap-1 pt-1.5 border-t border-gray-100">
          {MONTH_NAMES_ES.map((name, idx) => {
            const m = idx + 1;
            const periodKey = `${selectedYear}-${String(m).padStart(2, "0")}`;
            const monthDocs = docsByMonth[m] || [];
            const docCount = monthDocs.length;
            const isClosed = closedSet.has(periodKey);
            const isSelected = !viewAllMonths && selectedMonth === m;
            const shortName = name.slice(0, 3);

            // Indicadores de las 4 obligaciones obligatorias: 104, ATS, 103, Pago SRI (CEP)
            const has104 = monthDocs.some((d) => d.document_type === "iva_104");
            const hasAts = monthDocs.some((d) => d.document_type === "ats");
            const has103 = monthDocs.some((d) => d.document_type === "retenciones_103");
            const hasCep = monthDocs.some((d) => d.document_type === "pago_sri");

            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setSelectedMonth(m);
                  setViewAllMonths(false);
                }}
                className={`relative py-2 px-1 rounded-xl text-center transition flex flex-col items-center justify-center gap-0.5 ${
                  isSelected
                    ? "bg-emerald-600 text-white shadow-2xs font-bold"
                    : "hover:bg-gray-50 text-ink-700 bg-white border border-gray-100/70"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs">
                    <span className="hidden lg:inline">{name}</span>
                    <span className="lg:hidden">{shortName}</span>
                  </span>
                  {isClosed && (
                    <Lock size={10} className={isSelected ? "text-emerald-200" : "text-amber-500"} />
                  )}
                </div>

                {/* 4 Puntitos indicadores con colores correspondientes a cada filtro */}
                <div
                  className="flex items-center justify-center gap-1 my-0.5"
                  title={`Obligaciones: 104 IVA (${has104 ? "Listo" : "Falta"}), ATS (${hasAts ? "Listo" : "Falta"}), 103 Ret (${has103 ? "Listo" : "Falta"}), CEP Pago (${hasCep ? "Listo" : "Falta"})`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition ${
                      has104
                        ? isSelected ? "bg-emerald-300 ring-1 ring-white" : "bg-emerald-500 ring-1 ring-emerald-300"
                        : isSelected ? "bg-emerald-900/60" : "bg-gray-200"
                    }`}
                    title="104: Declaración IVA (Verde)"
                  />
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition ${
                      hasAts
                        ? isSelected ? "bg-purple-300 ring-1 ring-white" : "bg-purple-500 ring-1 ring-purple-300"
                        : isSelected ? "bg-emerald-900/60" : "bg-gray-200"
                    }`}
                    title="ATS: Anexo Transaccional SRI (Púrpura)"
                  />
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition ${
                      has103
                        ? isSelected ? "bg-sky-300 ring-1 ring-white" : "bg-blue-500 ring-1 ring-blue-300"
                        : isSelected ? "bg-emerald-900/60" : "bg-gray-200"
                    }`}
                    title="103: Retenciones en la Fuente (Azul)"
                  />
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition ${
                      hasCep
                        ? isSelected ? "bg-amber-300 ring-1 ring-white" : "bg-amber-500 ring-1 ring-amber-300"
                        : isSelected ? "bg-emerald-900/60" : "bg-gray-200"
                    }`}
                    title="CEP: Comprobante de Pago SRI (Ámbar)"
                  />
                </div>

                <span
                  className={`text-[9px] leading-none ${
                    docCount > 0
                      ? isSelected ? "text-emerald-100 font-semibold" : "text-emerald-700 font-medium"
                      : isSelected ? "text-emerald-200/80" : "text-gray-300"
                  }`}
                >
                  {docCount > 0 ? `${docCount} arch.` : "—"}
                </span>
              </button>
            );
          })}

          {/* 13ª Casilla: Cierre Anual y Obligaciones SuperCías */}
          {(() => {
            const annualDocs = docsByMonth[0] || [];
            const annualDocCount = annualDocs.length;
            const isSelected = !viewAllMonths && selectedMonth === 0;

            // 4 Obligaciones obligatorias de fin de año (SRI & SuperCías)
            const has101 = annualDocs.some((d) => d.document_type === "renta_101");
            const hasBalances = annualDocs.some((d) => d.document_type === "supercias_balances");
            const hasActas = annualDocs.some((d) => d.document_type === "supercias_actas");
            const hasSocios = annualDocs.some((d) => d.document_type === "supercias_socios");

            return (
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth(0);
                  setViewAllMonths(false);
                }}
                className={`relative py-2 px-1 rounded-xl text-center transition flex flex-col items-center justify-center gap-0.5 border ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-2xs font-bold border-indigo-600"
                    : "hover:bg-indigo-50/60 text-indigo-900 bg-indigo-50/25 border-indigo-200/80"
                }`}
                title="Cierre Anual y Respaldos SuperCías"
              >
                <div className="flex items-center gap-1">
                  <Building2 size={11} className={isSelected ? "text-indigo-200" : "text-indigo-600"} />
                  <span className="text-xs font-bold">
                    Anual
                  </span>
                </div>

                {/* 4 Puntitos indicadores anuales con colores distintivos */}
                <div
                  className="flex items-center justify-center gap-1 my-0.5"
                  title={`Obligaciones Anuales: Form. 101 (${has101 ? "Listo" : "Falta"}), Balances (${hasBalances ? "Listo" : "Falta"}), Informes/Actas (${hasActas ? "Listo" : "Falta"}), Nómina Socios (${hasSocios ? "Listo" : "Falta"})`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition ${
                      has101
                        ? isSelected ? "bg-rose-300 ring-1 ring-white" : "bg-rose-500 ring-1 ring-rose-300"
                        : isSelected ? "bg-indigo-900/60" : "bg-gray-200"
                    }`}
                    title="Form. 101: Impuesto a la Renta SRI (Rosa)"
                  />
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition ${
                      hasBalances
                        ? isSelected ? "bg-indigo-300 ring-1 ring-white" : "bg-indigo-500 ring-1 ring-indigo-300"
                        : isSelected ? "bg-indigo-900/60" : "bg-gray-200"
                    }`}
                    title="SuperCias: Balances NIIF (Índigo)"
                  />
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition ${
                      hasActas
                        ? isSelected ? "bg-amber-300 ring-1 ring-white" : "bg-orange-500 ring-1 ring-orange-300"
                        : isSelected ? "bg-indigo-900/60" : "bg-gray-200"
                    }`}
                    title="SuperCias: Informes y Acta de Junta (Naranja)"
                  />
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition ${
                      hasSocios
                        ? isSelected ? "bg-teal-300 ring-1 ring-white" : "bg-teal-500 ring-1 ring-teal-300"
                        : isSelected ? "bg-indigo-900/60" : "bg-gray-200"
                    }`}
                    title="SuperCias: Nómina de Socios (Teal)"
                  />
                </div>

                <span
                  className={`text-[9px] leading-none ${
                    annualDocCount > 0
                      ? isSelected ? "text-indigo-100 font-semibold" : "text-indigo-700 font-bold"
                      : isSelected ? "text-indigo-200/80" : "text-gray-300"
                  }`}
                >
                  {annualDocCount > 0 ? `${annualDocCount} arch.` : "—"}
                </span>
              </button>
            );
          })()}
        </div>
      </div>

            {/* Listado de Documentos con Filtros y Buscador */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs overflow-hidden">
        {/* Barra de Filtros y Búsqueda */}
        <div className="p-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-gray-50/40">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setCategoryFilter("todos")}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                categoryFilter === "todos"
                  ? "bg-ink-900 text-white font-semibold"
                  : "text-ink-600 hover:bg-gray-100"
              }`}
            >
              Todos ({filteredDocuments.length})
            </button>
            {/* Categorías con colores distintivos que coinciden con los puntitos de cada mes */}
            {(() => {
              const CATEGORY_THEMES: Record<string, { dot: string; active: string; inactive: string }> = {
                iva_104: {
                  dot: "bg-emerald-500",
                  active: "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold",
                  inactive: "bg-emerald-50/80 border-emerald-200 text-emerald-800 hover:bg-emerald-100",
                },
                retenciones_103: {
                  dot: "bg-blue-500",
                  active: "bg-blue-600 text-white border-blue-600 shadow-2xs font-bold",
                  inactive: "bg-blue-50/80 border-blue-200 text-blue-800 hover:bg-blue-100",
                },
                pago_sri: {
                  dot: "bg-amber-500",
                  active: "bg-amber-500 text-white border-amber-500 shadow-2xs font-bold",
                  inactive: "bg-amber-50/80 border-amber-200 text-amber-900 hover:bg-amber-100",
                },
                ats: {
                  dot: "bg-purple-500",
                  active: "bg-purple-600 text-white border-purple-600 shadow-2xs font-bold",
                  inactive: "bg-purple-50/80 border-purple-200 text-purple-800 hover:bg-purple-100",
                },
                renta_101: {
                  dot: "bg-rose-500",
                  active: "bg-rose-600 text-white border-rose-600 shadow-2xs font-bold",
                  inactive: "bg-rose-50/80 border-rose-200 text-rose-800 hover:bg-rose-100",
                },
                retenciones_recibidas: {
                  dot: "bg-cyan-500",
                  active: "bg-cyan-600 text-white border-cyan-600 shadow-2xs font-bold",
                  inactive: "bg-cyan-50/80 border-cyan-200 text-cyan-800 hover:bg-cyan-100",
                },
                otro: {
                  dot: "bg-slate-500",
                  active: "bg-slate-700 text-white border-slate-700 shadow-2xs font-bold",
                  inactive: "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200",
                },
              };

              // Filtrar categorías contextuales según si ve mes o cierre anual
              const categoriesToShow = TAX_DOC_CATEGORIES.filter((cat) => {
                if (viewAllMonths) return cat.id !== "retenciones_recibidas";
                if (selectedMonth === 0) {
                  // En Cierre Anual SuperCías: mostrar Renta 101, Balances, Actas, Nómina Socios y Otro
                  return ["renta_101", "supercias_balances", "supercias_actas", "supercias_socios", "otro"].includes(cat.id);
                } else {
                  // En Meses SRI: Formulario 104, ATS, Formulario 103, Pago SRI y Otros (incluye retenciones)
                  return ["iva_104", "ats", "retenciones_103", "pago_sri", "otro"].includes(cat.id);
                }
              });

              return categoriesToShow.map((cat) => {
                const count = documents.filter((d) => {
                  if (!viewAllMonths && d.period !== selectedPeriod) return false;
                  if (viewAllMonths && d.year !== selectedYear) return false;
                  if (cat.id === "otro") {
                    return d.document_type === "otro" || d.document_type === "retenciones_recibidas";
                  }
                  return d.document_type === cat.id;
                }).length;

                const theme = CATEGORY_THEMES[cat.id] || {
                  dot: "bg-gray-400",
                  active: "bg-ink-900 text-white border-ink-900 font-bold",
                  inactive: "bg-gray-50 border-gray-200 text-ink-700 hover:bg-gray-100",
                };

                const isSelected = categoryFilter === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
                      isSelected ? theme.active : theme.inactive
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? "bg-white ring-1 ring-white/50" : theme.dot}`} />
                    <span>{cat.shortLabel}</span>
                    {count > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-white/90 text-ink-800 border border-black/5"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              });
            })()}
          </div>

          <div className="relative w-full sm:w-60 shrink-0">
            <Search className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar archivo o nota..."
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-ink-400 bg-white"
            />
          </div>
        </div>

        {/* Lista de Documentos o Estado Vacío */}
        {filteredDocuments.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 text-gray-400 mx-auto flex items-center justify-center mb-2">
              <FileText size={18} />
            </div>
            <p className="text-xs font-semibold text-ink-700">
              No hay respaldos guardados para este período
            </p>
            <p className="text-[11px] text-ink-400 max-w-sm mx-auto mt-0.5">
              {!viewAllMonths
                ? `Aún no has cargado declaraciones de ${MONTH_NAMES_ES[selectedMonth - 1]} ${selectedYear}.`
                : `No se encontraron documentos en el año ${selectedYear}.`}
            </p>
            <button
              type="button"
              onClick={() => openUploadModal()}
              className="mt-3 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-ink-800 text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <UploadCloud size={13} />
              <span>Cargar archivos</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredDocuments.map((doc) => {
              const catDef = getCategoryDef(doc.document_type);
              const previewable = canPreviewInline(doc);
              const proxiedUrl = proxyStorageUrl(doc.file_url);

              return (
                <div
                  key={doc.id}
                  className="p-3 hover:bg-gray-50/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-gray-50 border border-gray-100 shrink-0 mt-0.5">
                      {getFileIcon(doc.file_name, doc.file_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${catDef.badgeColor}`}>
                          {catDef.shortLabel}
                        </span>
                        {viewAllMonths && (
                          <span className="text-[10px] font-semibold text-ink-500 bg-gray-100 px-1.5 py-0.2 rounded">
                            {MONTH_NAMES_ES[doc.month - 1]} {doc.year}
                          </span>
                        )}
                        <h4 className="text-xs font-bold text-ink-900 truncate">
                          {doc.title}
                        </h4>
                      </div>

                      {doc.notes && (
                        <p className="text-[11px] text-ink-500 mt-0.5 italic line-clamp-1">
                          {doc.notes}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-400 mt-1 font-mono">
                        <span className="truncate max-w-[200px]">{doc.file_name}</span>
                        {doc.file_size && <span>· {formatFileSize(doc.file_size)}</span>}
                        <span>· {new Date(doc.created_at).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                    {previewable ? (
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-ink-700 text-xs font-medium flex items-center gap-1 transition"
                      >
                        <Eye size={12} />
                        <span>Ver</span>
                      </button>
                    ) : (
                      <a
                        href={proxiedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-ink-700 text-xs font-medium flex items-center gap-1 transition"
                      >
                        <ExternalLink size={12} />
                        <span>Abrir</span>
                      </a>
                    )}

                    <a
                      href={proxiedUrl}
                      download={doc.file_name}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-ink-600 transition"
                      title="Descargar"
                    >
                      <Download size={13} />
                    </a>

                    <button
                      type="button"
                      onClick={() => setDocToDelete(doc)}
                      className="p-1.5 rounded-lg border border-gray-200 hover:border-red-200 hover:bg-red-50 text-ink-400 hover:text-red-600 transition"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: SUBIR RESPALDOS (COMPACTO, ESPACIO OPTIMIZADO, SIN NOTAS) */}
      <StandardModal
        isOpen={isUploadOpen}
        onClose={() => !isUploading && setIsUploadOpen(false)}
        title="Cargar Respaldos del Mes"
        subtitle="Arrastra o selecciona tus archivos. Asigna a qué corresponde y su descripción."
        icon={<UploadCloud size={20} className="text-emerald-600" />}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleBatchUploadSubmit} className="space-y-3">
          {uploadError && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-semibold">
              <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
              <span>{uploadSuccess}</span>
            </div>
          )}

          {/* 1. Selector de Período Compacto */}
          <div className="flex items-center justify-between gap-2 p-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs">
            <span className="font-semibold text-ink-700">Mes al que corresponden los respaldos:</span>
            <select
              value={uploadPeriod}
              onChange={(e) => handleUploadPeriodChange(e.target.value)}
              className="text-xs font-bold rounded-lg border border-gray-300 py-1 px-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white text-ink-900"
            >
              {availableYears.map((y) => [
                <option key={`${y}-anual`} value={`${y}-anual`}>
                  🏢 Cierre Anual {y} (SuperCías / Form. 101)
                </option>,
                ...MONTH_NAMES_ES.map((name, idx) => {
                  const p = `${y}-${String(idx + 1).padStart(2, "0")}`;
                  return (
                    <option key={p} value={p}>
                      {name} {y}
                    </option>
                  );
                }),
              ])}
            </select>
          </div>

          {/* 2. Zona de Arrastrar y Soltar (Optimizado según si hay archivos o no) */}
          {uploadQueue.length === 0 ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  addFilesToQueue(e.dataTransfer.files);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-300 hover:border-emerald-500 hover:bg-emerald-50/20 bg-gray-50/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.xml,.zip,.rar,.7z,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    addFilesToQueue(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
              <div className="flex flex-col items-center justify-center">
                <UploadCloud size={24} className="text-emerald-600 mb-1" />
                <span className="text-xs font-bold text-ink-800">
                  Arrastra aquí tus archivos o haz clic para explorar
                </span>
                <span className="text-[11px] text-ink-400 mt-0.5">
                  PDF, XML, ZIP, imágenes o Excel (hasta 25 MB)
                </span>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  addFilesToQueue(e.dataTransfer.files);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`py-2 px-3 border border-dashed rounded-xl text-center cursor-pointer transition flex items-center justify-center gap-2 text-xs font-semibold ${
                isDragging
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : "border-gray-300 hover:border-emerald-500 hover:bg-emerald-50/20 text-ink-600 bg-gray-50/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.xml,.zip,.rar,.7z,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    addFilesToQueue(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
              <UploadCloud size={15} className="text-emerald-600" />
              <span>+ Arrastra o haz clic para añadir más archivos</span>
            </div>
          )}

          {/* 3. Lista de Archivos (Nombre de archivo 100% visible, espacio optimizado, sin notas) */}
          {uploadQueue.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-ink-800 px-1">
                <span>Archivos listos para subir ({uploadQueue.length}):</span>
                <span className="text-[11px] text-ink-500 font-normal">
                  Total: {formatFileSize(totalQueueSize)}
                </span>
              </div>

              <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-1">
                {uploadQueue.map((item, idx) => {
                  return (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-white border border-gray-200 hover:border-emerald-300 shadow-2xs transition space-y-2"
                    >
                      {/* Fila 1: Número, Nombre completo legible al 100% sin puntos suspensivos, Peso y Botón Eliminar */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-ink-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                            #{idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            {/* Nombre del archivo 100% visible completo */}
                            <p className="text-xs font-bold text-ink-900 break-words leading-snug">
                              {item.file.name}
                            </p>
                            <span className="text-[10px] text-ink-400 font-mono">
                              {formatFileSize(item.file.size)}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeQueueItem(item.id)}
                          className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition shrink-0"
                          title="Quitar este archivo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Fila 2: Corresponde a (50%) + Descripción (50%) con espacio amplio */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-gray-100 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-ink-500 mb-0.5">
                            Corresponde a:
                          </label>
                          <select
                            value={item.document_type === "retenciones_recibidas" ? "otro" : item.document_type}
                            onChange={(e) => updateQueueItemType(item.id, e.target.value as TaxDocType)}
                            className="w-full text-xs font-medium rounded-lg border border-gray-200 bg-gray-50/60 hover:bg-white py-1.5 px-2 text-ink-900 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          >
                            {TAX_DOC_CATEGORIES.filter((c) => c.id !== "retenciones_recibidas").map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-ink-500 mb-0.5">
                            Descripción / Título:
                          </label>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => updateQueueItemTitle(item.id, e.target.value)}
                            placeholder="Descripción / Título"
                            className="w-full text-xs rounded-lg border border-gray-200 bg-gray-50/60 hover:bg-white py-1.5 px-2 text-ink-900 focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder:text-gray-400"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Botones de acción del Modal */}
          <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-gray-100">
            <span className="text-xs text-ink-500">
              {uploadQueue.length > 0
                ? `${uploadQueue.length} archivo(s) para ${MONTH_NAMES_ES[Number(uploadPeriod.split("-")[1]) - 1]} ${uploadPeriod.split("-")[0]}`
                : "Selecciona archivos para continuar"}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => setIsUploadOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-ink-600 hover:bg-gray-50 text-xs font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isUploading || uploadQueue.length === 0}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-2xs transition disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Guardando {uploadQueue.length} archivo(s)...</span>
                  </>
                ) : (
                  <>
                    <Check size={13} />
                    <span>
                      {uploadQueue.length > 1
                        ? `Subir ${uploadQueue.length} Respaldos`
                        : uploadQueue.length === 1
                        ? "Guardar Respaldo"
                        : "Subir Documentos"}
                    </span>
                  </>
                )}
              </button>
            </div>
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
