"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  FileText, Image as ImageIcon, Upload, Trash2, 
  Download, ExternalLink, Loader2, AlertCircle, CheckCircle2 
} from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { updateCourseMediaAction } from "@/app/(admin)/erp/cursos/actions";
import { proxyStorageUrl } from "@/lib/storage-proxy";

interface Props {
  courseId: string;
  courseName: string;
  imageUrl?: string | null;
  brochureUrl?: string | null;
  canEdit: boolean;
}

export default function CourseMediaManager({
  courseId,
  courseName,
  imageUrl,
  brochureUrl,
  canEdit,
}: Props) {
  const router = useRouter();
  const [openModal, setOpenModal] = useState(false);
  const [modalType, setModalType] = useState<"image" | "brochure">("brochure");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function openMediaModal(type: "image" | "brochure") {
    setModalType(type);
    setFile(null);
    setErrorMsg(null);
    setOpenModal(true);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setErrorMsg("Por favor selecciona un archivo.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("courseId", courseId);

    if (modalType === "image") {
      formData.append("imageFile", file);
    } else {
      formData.append("brochureFile", file);
    }

    try {
      await updateCourseMediaAction(formData);
      setOpenModal(false);
      setFile(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al subir el archivo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(type: "image" | "brochure") {
    const confirmText = type === "image" 
      ? "¿Deseas eliminar la imagen de portada/propaganda del curso?" 
      : "¿Deseas eliminar el brochure digital del curso?";
    
    if (!window.confirm(confirmText)) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("courseId", courseId);
    if (type === "image") {
      formData.append("removeImage", "true");
    } else {
      formData.append("removeBrochure", "true");
    }

    try {
      await updateCourseMediaAction(formData);
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Error al eliminar el archivo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-lilac-100 rounded-2xl p-4 shadow-2xs mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-lilac-50 pb-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-ink-900 flex items-center gap-1.5">
            <FileText size={16} className="text-lilac-600" />
            Material Multimedia y Brochure
          </h3>
          <p className="text-xs text-ink-500">
            Imágenes de propaganda y brochure temario descargable para la web y el asistente de WhatsApp.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sección 1: Portada / Propaganda */}
        <div className="bg-lilac-50/40 border border-lilac-100 rounded-xl p-3 flex items-start gap-3">
          <div className="w-16 h-16 rounded-lg bg-white border border-lilac-200 overflow-hidden flex items-center justify-center shrink-0">
            {imageUrl ? (
              <img 
                src={proxyStorageUrl(imageUrl)} 
                alt="Propaganda" 
                className="w-full h-full object-cover" 
              />
            ) : (
              <ImageIcon size={24} className="text-lilac-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-ink-800 block truncate">
              Portada / Propaganda
            </span>
            <span className="text-[11px] text-ink-500 block mb-2">
              {imageUrl ? "Imagen asignada" : "Sin imagen asignada"}
            </span>
            <div className="flex items-center gap-2">
              {imageUrl && (
                <a
                  href={proxyStorageUrl(imageUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-lilac-700 hover:text-lilac-800 bg-white border border-lilac-200 px-2 py-1 rounded-lg"
                >
                  <ExternalLink size={12} /> Ver
                </a>
              )}
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => openMediaModal("image")}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-lilac-700 hover:text-lilac-900 bg-white border border-lilac-200 px-2 py-1 rounded-lg hover:bg-lilac-50"
                  >
                    <Upload size={12} /> {imageUrl ? "Cambiar" : "Subir"}
                  </button>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => handleRemove("image")}
                      disabled={loading}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 bg-white border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50"
                      title="Eliminar imagen"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sección 2: Brochure / Temario Digital */}
        <div className="bg-lilac-50/40 border border-lilac-100 rounded-xl p-3 flex items-start gap-3">
          <div className="w-16 h-16 rounded-lg bg-white border border-lilac-200 overflow-hidden flex items-center justify-center shrink-0">
            <FileText size={28} className={brochureUrl ? "text-lilac-600" : "text-lilac-300"} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-ink-800 block truncate">
                Brochure del Curso (PDF)
              </span>
              {brochureUrl && (
                <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                  Disponible
                </span>
              )}
            </div>
            <span className="text-[11px] text-ink-500 block mb-2 truncate">
              {brochureUrl ? "Descargable en web y WhatsApp" : "Aún no has adjuntado el temario PDF"}
            </span>
            <div className="flex items-center gap-2">
              {brochureUrl && (
                <a
                  href={proxyStorageUrl(brochureUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-lilac-700 hover:text-lilac-800 bg-white border border-lilac-200 px-2 py-1 rounded-lg shadow-2xs hover:bg-lilac-50"
                >
                  <Download size={12} /> Ver / Descargar
                </a>
              )}
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => openMediaModal("brochure")}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-lilac-700 hover:text-lilac-900 bg-white border border-lilac-200 px-2 py-1 rounded-lg hover:bg-lilac-50"
                  >
                    <Upload size={12} /> {brochureUrl ? "Reemplazar" : "Subir Brochure"}
                  </button>
                  {brochureUrl && (
                    <button
                      type="button"
                      onClick={() => handleRemove("brochure")}
                      disabled={loading}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 bg-white border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50"
                      title="Eliminar brochure"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Subida */}
      <StandardModal
        isOpen={openModal}
        onClose={() => !loading && setOpenModal(false)}
        title={modalType === "image" ? "Subir Portada / Propaganda" : "Subir Brochure del Curso"}
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <p className="text-xs text-ink-600">
            {modalType === "image"
              ? "Selecciona una imagen publicitaria (JPG, PNG, WebP). Se optimizará automáticamente para la web."
              : "Selecciona el folleto o temario digital en formato PDF (o imagen) para compartir con los interesados."}
          </p>

          <div>
            <label className="label text-ink-800 font-semibold">
              {modalType === "image" ? "Archivo de Imagen *" : "Archivo de Brochure (PDF / Imagen) *"}
            </label>
            <input
              type="file"
              required
              accept={modalType === "image" ? "image/*" : ".pdf,image/*"}
              disabled={loading}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-ink-600 file:mr-4 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-lilac-50 file:text-lilac-700 hover:file:bg-lilac-100 bg-white border border-lilac-200 rounded-xl p-1 focus:outline-none"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              <AlertCircle size={15} className="shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-lilac-100">
            <button
              type="button"
              disabled={loading}
              onClick={() => setOpenModal(false)}
              className="btn-secondary text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !file}
              className="btn-primary text-xs inline-flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Subiendo...
                </>
              ) : (
                <>
                  <Upload size={14} /> Guardar Archivo
                </>
              )}
            </button>
          </div>
        </form>
      </StandardModal>
    </div>
  );
}
