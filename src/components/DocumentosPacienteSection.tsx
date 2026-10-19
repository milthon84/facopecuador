"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { 
  FileText, 
  Upload, 
  Trash2, 
  X, 
  PlusCircle, 
  Eye, 
  Download, 
  Calendar, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  FileCheck2,
  ExternalLink,
  FileCode,
  File as FileIcon
} from "lucide-react";
import { proxyStorageUrl } from "@/lib/storage-proxy";

export interface PatientDocument {
  id: string;
  patient_id: string;
  title: string;
  category: "consentimiento" | "identificacion" | "historia" | "examen" | "otro" | string;
  file_url: string;
  storage_path?: string;
  file_name: string;
  file_type?: string;
  file_size?: number;
  notes?: string | null;
  created_at: string;
}

interface DocumentosPacienteSectionProps {
  patientId: string;
  initialDocuments?: PatientDocument[];
  documents?: PatientDocument[];
  onDocumentsChange?: (documents: PatientDocument[]) => void;
  canModify?: boolean;
  compact?: boolean;
  mode?: "full" | "add_only" | "view_only";
}

const CATEGORIES: { id: string; label: string; color: string }[] = [
  { id: "consentimiento", label: "Consentimiento", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "identificacion", label: "Cédula / Ident.", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "historia", label: "Historia Externa", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: "examen", label: "Examen / Laboratorio", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "otro", label: "Otro Documento", color: "bg-slate-50 text-slate-700 border-slate-200" },
];

export default function DocumentosPacienteSection({
  patientId,
  initialDocuments = [],
  documents: controlledDocuments,
  onDocumentsChange,
  canModify = true,
  compact = false,
  mode = "full",
}: DocumentosPacienteSectionProps) {
  const [internalDocuments, setInternalDocuments] = useState<PatientDocument[]>(controlledDocuments ?? initialDocuments);
  const documents = controlledDocuments ?? internalDocuments;

  useEffect(() => {
    if (controlledDocuments) {
      setInternalDocuments(controlledDocuments);
    }
  }, [controlledDocuments]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("todos");

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("consentimiento");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Preview viewer state
  const [activeDoc, setActiveDoc] = useState<PatientDocument | null>(null);

  // Delete state
  const [docToDelete, setDocToDelete] = useState<PatientDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorMsg("");

      // Si es imagen, generar vista previa
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }

      // Si el título está vacío, autocompletar con el nombre del archivo sin extensión
      if (!title.trim()) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
        setTitle(nameWithoutExt);
      }
    }
  };

  const handleOpenModal = () => {
    setTitle("");
    setCategory("consentimiento");
    setNotes("");
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMsg("");
    setSuccessMsg("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isUploading) return;
    setIsModalOpen(false);
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!title.trim()) {
      setErrorMsg("Debes ingresar el título o asunto del documento.");
      return;
    }
    if (!selectedFile) {
      setErrorMsg("Debes seleccionar un archivo para subir.");
      return;
    }

    try {
      setIsUploading(true);
      setErrorMsg("");

      const formData = new FormData();
      formData.append("patientId", patientId);
      formData.append("title", title.trim());
      formData.append("category", category);
      if (notes.trim()) formData.append("notes", notes.trim());
      formData.append("documentFile", selectedFile);

      const response = await fetch("/api/admin/patient-documents", {
        method: "POST",
        body: formData,
      });

      const res = await response.json();

      if (!response.ok || !res.success) {
        setErrorMsg(res.error || "Ocurrió un error al subir el documento.");
      } else {
        setSuccessMsg("¡Documento guardado exitosamente!");
        if (res.document) {
          const updated = [res.document, ...documents];
          setInternalDocuments(updated);
          onDocumentsChange?.(updated);
        }
        setTimeout(() => {
          setIsModalOpen(false);
          setSuccessMsg("");
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar la solicitud.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!docToDelete) return;
    try {
      setIsDeleting(true);
      const response = await fetch(
        `/api/admin/patient-documents?documentId=${docToDelete.id}&patientId=${patientId}`,
        { method: "DELETE" }
      );
      const res = await response.json();

      if (response.ok && res.success) {
        const updated = documents.filter((d) => d.id !== docToDelete.id);
        setInternalDocuments(updated);
        onDocumentsChange?.(updated);
        setDocToDelete(null);
        if (activeDoc?.id === docToDelete.id) {
          setActiveDoc(null);
        }
      } else {
        alert(res.error || "No se pudo eliminar el documento.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al intentar eliminar el documento.");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || isNaN(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("es-EC", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const isPdf = (doc: PatientDocument) => {
    return doc.file_type?.includes("pdf") || doc.file_name?.toLowerCase().endsWith(".pdf") || doc.file_url?.toLowerCase().endsWith(".pdf");
  };

  const isImage = (doc: PatientDocument) => {
    return (
      doc.file_type?.startsWith("image/") ||
      /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.file_name || "") ||
      /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.file_url || "")
    );
  };

  const filteredDocuments = selectedCategoryFilter === "todos"
    ? documents
    : documents.filter((d) => (d.category || "otro").toLowerCase() === selectedCategoryFilter);

  // Render: Modal Form
  const renderModalForm = () => (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-lilac-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/10 rounded-lg">
              <FileCheck2 size={18} className="text-emerald-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Añadir Documento / Consentimiento</h3>
              <p className="text-white/70 text-xs">Sube documentos firmados, cédulas o exámenes</p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            disabled={isUploading}
            className="p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto text-slate-900">
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Categoría */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
              Tipo de Documento
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
            >
              <option value="consentimiento">📋 Consentimiento Informado</option>
              <option value="identificacion">🆔 Cédula / Identificación</option>
              <option value="historia">📑 Historia Clínica Externa</option>
              <option value="examen">🔬 Examen / Laboratorio / Radiografía</option>
              <option value="otro">📁 Otro Documento</option>
            </select>
          </div>

          {/* Título */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
              Título / Asunto <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Consentimiento informado de endodoncia"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
              required
            />
          </div>

          {/* Selector de Archivo */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
              Archivo (PDF, Imagen, Documento) <span className="text-rose-500">*</span>
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,image/*,.doc,.docx"
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-5 text-center cursor-pointer transition bg-slate-50/50 hover:bg-emerald-50/30 flex flex-col items-center gap-2"
              >
                <div className="p-2.5 bg-emerald-100/60 text-emerald-700 rounded-xl">
                  <Upload size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Haz clic para seleccionar archivo</p>
                  <p className="text-[11px] text-slate-500">Admite PDF, JPG, PNG, WEBP, DOCX (hasta 25 MB)</p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {previewUrl ? (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-emerald-300 shrink-0">
                      <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-600 text-white rounded-lg shrink-0">
                      <FileText size={20} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-emerald-800 font-mono">
                      {formatFileSize(selectedFile.size)} • {selectedFile.type || "Documento"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  title="Cambiar archivo"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Notas Opcionales */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
              Observaciones adicionales <span className="text-slate-400 font-normal lowercase">(opcional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles sobre el consentimiento o documento firmado..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={isUploading}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isUploading || !selectedFile || !title.trim()}
              className="px-5 py-2 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              <span>{isUploading ? "Guardando..." : "Subir Documento"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Render: Preview Viewer
  const renderPreview = () => {
    if (!activeDoc) return null;
    const proxiedUrl = proxyStorageUrl(activeDoc.file_url);

    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
        <div className="relative w-full max-w-4xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 pr-4">
              <FileText size={18} className="text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <h3 className="font-bold text-sm truncate">{activeDoc.title}</h3>
                <p className="text-white/60 text-[11px] truncate font-mono">
                  {activeDoc.file_name} • {formatFileSize(activeDoc.file_size)} • {formatDate(activeDoc.created_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={proxiedUrl}
                download={activeDoc.file_name}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Descargar</span>
              </a>
              <a
                href={proxiedUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition"
                title="Abrir en pestaña nueva"
              >
                <ExternalLink size={16} />
              </a>
              <button
                onClick={() => setActiveDoc(null)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Content Preview */}
          <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center p-2 relative">
            {isPdf(activeDoc) ? (
              <iframe
                src={`${proxiedUrl}#toolbar=1`}
                className="w-full h-full border-none rounded-lg bg-white"
                title={activeDoc.title}
              />
            ) : isImage(activeDoc) ? (
              <div className="relative max-w-full max-h-full flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proxiedUrl}
                  alt={activeDoc.title}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-md"
                />
              </div>
            ) : (
              <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200 max-w-sm">
                <FileIcon size={48} className="mx-auto mb-3 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-sm mb-1">{activeDoc.file_name}</h4>
                <p className="text-xs text-slate-500 mb-4">
                  Este archivo no se puede previsualizar directamente en el navegador.
                </p>
                <a
                  href={proxiedUrl}
                  download={activeDoc.file_name}
                  className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <Download size={14} /> Descargar Archivo
                </a>
              </div>
            )}
          </div>

          {/* Notes if any */}
          {activeDoc.notes && (
            <div className="px-5 py-2.5 bg-emerald-50/70 border-t border-emerald-100 text-xs text-emerald-900 shrink-0">
              <span className="font-bold uppercase text-[10px] text-emerald-800 mr-2">Notas:</span>
              {activeDoc.notes}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render: Confirm Delete
  const renderDeleteConfirm = () => {
    if (!docToDelete) return null;
    return (
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
        <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 text-center">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Trash2 size={22} />
          </div>
          <h3 className="font-bold text-slate-900 text-sm mb-1">¿Eliminar este documento?</h3>
          <p className="text-xs text-slate-600 mb-4">
            Se eliminará de forma permanente <strong>&ldquo;{docToDelete.title}&rdquo;</strong> del registro del paciente.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setDocToDelete(null)}
              disabled={isDeleting}
              className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm"
            >
              {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              <span>{isDeleting ? "Eliminando..." : "Sí, eliminar"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── MODO COMPACTO ──────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        {canModify && mode !== "view_only" && (
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-1.5 rounded-xl border border-emerald-200 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <FileText size={14} className="text-emerald-600" />
            <span>{documents.length === 0 ? "Documentos / Consentimientos" : `Documentos (${documents.length})`}</span>
            <PlusCircle size={13} className="text-emerald-600" />
          </button>
        )}
        {isModalOpen && renderModalForm()}
        {activeDoc && renderPreview()}
        {docToDelete && renderDeleteConfirm()}
      </div>
    );
  }

  // ── MODO ESTÁNDAR (Ficha del paciente) ──────────────────────────────────
  return (
    <div className="card p-4 bg-white border border-lilac-100 shadow-sm rounded-2xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-lilac-50 pb-2.5">
        <h2 className="text-xs font-bold text-ink-950 flex items-center gap-1.5">
          <FileText className="text-emerald-600" size={16} /> Consentimientos y Documentos ({documents.length})
        </h2>
        {canModify && (
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2.5 py-1 rounded-lg transition-colors border border-emerald-200"
          >
            <PlusCircle size={12} className="text-emerald-600" /> Agregar
          </button>
        )}
      </div>

      {/* Filter Tabs if there are documents */}
      {documents.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px]">
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter("todos")}
            className={`px-2 py-0.5 rounded-md font-bold transition ${
              selectedCategoryFilter === "todos"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todos ({documents.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = documents.filter((d) => (d.category || "otro").toLowerCase() === cat.id).length;
            if (count === 0) return null;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat.id)}
                className={`px-2 py-0.5 rounded-md font-bold transition ${
                  selectedCategoryFilter === cat.id
                    ? "bg-emerald-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Document List */}
      {documents.length === 0 ? (
        <div className="text-center py-4 px-2 border border-dashed border-lilac-100 rounded-xl bg-lilac-50/20 text-[11px] text-ink-500">
          <FileText size={20} className="mx-auto mb-1 text-lilac-400" />
          Sin consentimientos o documentos registrados.
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-3 text-[11px] text-slate-500 italic">
          No hay documentos en esta categoría.
        </div>
      ) : (
        <div className="space-y-2 pt-0.5">
          {filteredDocuments.map((doc) => {
            const catInfo = CATEGORIES.find((c) => c.id === (doc.category || "otro").toLowerCase()) || CATEGORIES[4];
            const pdfFile = isPdf(doc);
            const imageFile = isImage(doc);
            const proxiedUrl = proxyStorageUrl(doc.file_url);

            return (
              <div
                key={doc.id}
                className="group p-2.5 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 hover:border-emerald-300 rounded-xl transition flex items-center justify-between gap-3 shadow-2xs"
              >
                {/* Info clickeable para abrir vista previa */}
                <div
                  onClick={() => setActiveDoc(doc)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                >
                  {/* File Badge */}
                  <div
                    className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center shrink-0 font-bold text-[9px] shadow-2xs ${
                      pdfFile
                        ? "bg-rose-100 text-rose-700 border border-rose-200"
                        : imageFile
                        ? "bg-blue-100 text-blue-700 border border-blue-200"
                        : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    {pdfFile ? "PDF" : imageFile ? "IMG" : "DOC"}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition truncate">
                        {doc.title}
                      </p>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${catInfo.color}`}>
                        {catInfo.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono truncate">
                      {doc.file_name} • {formatDate(doc.created_at)}
                      {doc.file_size ? ` • ${formatFileSize(doc.file_size)}` : ""}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveDoc(doc)}
                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                    title="Ver documento"
                  >
                    <Eye size={14} />
                  </button>
                  <a
                    href={proxiedUrl}
                    download={doc.file_name}
                    className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                    title="Descargar"
                  >
                    <Download size={14} />
                  </a>
                  {canModify && (
                    <button
                      type="button"
                      onClick={() => setDocToDelete(doc)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {isModalOpen && renderModalForm()}
      {activeDoc && renderPreview()}
      {docToDelete && renderDeleteConfirm()}
    </div>
  );
}
