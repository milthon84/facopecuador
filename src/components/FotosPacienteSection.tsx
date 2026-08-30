"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Camera, 
  Upload, 
  Trash2, 
  X, 
  PlusCircle, 
  Image as ImageIcon, 
  Eye, 
  Calendar, 
  Loader2,
  AlertCircle,
  CheckCircle2
} from "lucide-react";

export interface PatientPhoto {
  id: string;
  patient_id: string;
  title: string;
  image_url: string;
  storage_path?: string;
  created_at: string;
}

interface FotosPacienteSectionProps {
  patientId: string;
  initialPhotos?: PatientPhoto[];
  photos?: PatientPhoto[];
  onPhotosChange?: (photos: PatientPhoto[]) => void;
  canModify?: boolean;
  compact?: boolean;
  mode?: "full" | "add_only" | "view_only";
}

export default function FotosPacienteSection({
  patientId,
  initialPhotos = [],
  photos: controlledPhotos,
  onPhotosChange,
  canModify = true,
  compact = false,
  mode = "full",
}: FotosPacienteSectionProps) {
  const [internalPhotos, setInternalPhotos] = useState<PatientPhoto[]>(controlledPhotos ?? initialPhotos);
  const photos = controlledPhotos ?? internalPhotos;

  useEffect(() => {
    if (controlledPhotos) {
      setInternalPhotos(controlledPhotos);
    }
  }, [controlledPhotos]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Upload Form State (Solo Asunto e Imagen)
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Lightbox modal state
  const [activePhoto, setActivePhoto] = useState<PatientPhoto | null>(null);

  // Delete modal state
  const [photoToDelete, setPhotoToDelete] = useState<PatientPhoto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setErrorMsg("Por favor, selecciona un archivo de imagen válido (JPG, PNG, WEBP, etc.).");
        return;
      }
      setSelectedFile(file);
      setErrorMsg("");
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenModal = () => {
    setTitle("");
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
      setErrorMsg("Debes ingresar el asunto de la foto.");
      return;
    }
    if (!selectedFile) {
      setErrorMsg("Debes seleccionar una imagen para subir.");
      return;
    }

    try {
      setIsUploading(true);
      setErrorMsg("");

      const formData = new FormData();
      formData.append("patientId", patientId);
      formData.append("title", title.trim());
      formData.append("imageFile", selectedFile);

      const response = await fetch("/api/admin/patient-photos", {
        method: "POST",
        body: formData,
      });

      const res = await response.json();

      if (!response.ok || !res.success) {
        setErrorMsg(res.error || "Ocurrió un error al subir la foto.");
      } else {
        setSuccessMsg("¡Foto guardada exitosamente!");
        if (res.photo) {
          const updated = [res.photo, ...photos];
          setInternalPhotos(updated);
          onPhotosChange?.(updated);
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
    if (!photoToDelete) return;
    try {
      setIsDeleting(true);
      const response = await fetch(
        `/api/admin/patient-photos?photoId=${photoToDelete.id}&patientId=${patientId}`,
        { method: "DELETE" }
      );
      const res = await response.json();

      if (response.ok && res.success) {
        const updated = photos.filter((p) => p.id !== photoToDelete.id);
        setInternalPhotos(updated);
        onPhotosChange?.(updated);
        setPhotoToDelete(null);
        if (activePhoto?.id === photoToDelete.id) {
          setActivePhoto(null);
        }
      } else {
        alert(res.error || "No se pudo eliminar la foto.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al intentar eliminar la foto.");
    } finally {
      setIsDeleting(false);
    }
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

  // ── MODO COMPACTO (Ahorra espacio en la vista de procedimiento) ─────────
  if (compact) {
    const showThumbnails = mode !== "add_only" && photos.length > 0;
    const showAddButton = canModify && mode !== "view_only";

    return (
      <div className="flex items-center gap-2 shrink-0">
        {/* Tiras de miniaturas muy pequeñas si hay fotos creadas y el modo lo permite */}
        {showThumbnails && (
          <div className="flex items-center gap-1.5">
            {photos.map((photo) => (
              <div 
                key={photo.id}
                onClick={() => setActivePhoto(photo)}
                className="relative group w-8 h-8 rounded-lg overflow-hidden border border-lilac-200 cursor-pointer shrink-0 shadow-xs hover:border-gold-500 transition-colors"
                title={photo.title}
              >
                <img src={photo.image_url} alt={photo.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                  <Eye size={11} />
                </div>
              </div>
            ))}
          </div>
        )}

        {showAddButton && (
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center gap-1.5 bg-gold-50 hover:bg-gold-100 text-gold-800 font-bold text-xs px-3 py-1.5 rounded-xl border border-gold-200 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <Camera size={14} className="text-gold-600" />
            <span>{mode === "add_only" ? "+ Añadir Foto(s)" : (photos.length === 0 ? "Fotos / Imágenes" : `Fotos (${photos.length})`)}</span>
            {mode !== "add_only" && <PlusCircle size={13} className="text-gold-600" />}
          </button>
        )}

        {/* Blocking Overlay de Procesamiento en Fotos */}
        {(isUploading || isDeleting) && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs transition-all duration-300">
            <div className="bg-white border border-lilac-100 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center animate-in fade-in duration-200">
              <div className="relative mb-5">
                <div className="h-16 w-16 rounded-full border-4 border-lilac-50 border-t-gold animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-lilac-600">
                  <Camera size={24} className="animate-pulse" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-ink-900 mb-1.5">
                {isDeleting ? "Eliminando Imagen..." : "Procesando Fotografías..."}
              </h3>
              <p className="text-xs text-ink-600 leading-relaxed">
                Estamos actualizando la información del paciente. La pantalla permanecerá bloqueada hasta completar la actualización.
              </p>
            </div>
          </div>
        )}

        {/* Modal: Subir Nueva Foto */}
        {isModalOpen && renderModalForm()}
        {/* Modal: Lightbox */}
        {activePhoto && renderLightbox()}
        {/* Modal: Confirmar Eliminación */}
        {photoToDelete && renderDeleteConfirm()}
      </div>
    );
  }

  // ── MODO ESTÁNDAR (Ficha principal del paciente) ───────────────────────
  return (
    <div className="card p-4 bg-white border border-lilac-100 shadow-sm rounded-2xl space-y-2.5">
      {/* Card Title Header */}
      <div className="flex items-center justify-between border-b border-lilac-50 pb-2">
        <h2 className="text-xs font-bold text-ink-950 flex items-center gap-1.5">
          <Camera className="text-lilac-600" size={15} /> Fotos / Imágenes ({photos.length})
        </h2>
        {canModify && (
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center gap-1 bg-gold-50 hover:bg-gold-100 text-gold-700 font-bold text-[10px] px-2 py-0.5 rounded-lg transition-colors border border-gold-200"
          >
            <PlusCircle size={12} /> Agregar
          </button>
        )}
      </div>

      {/* Body: Compact Photos Grid (3 columnas cuadradas) */}
      {photos.length === 0 ? (
        <div className="text-center py-4 px-2 border border-dashed border-lilac-100 rounded-xl bg-lilac-50/20 text-[11px] text-ink-500">
          <ImageIcon size={18} className="mx-auto mb-1 text-lilac-400" />
          Sin fotos registradas.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 pt-0.5">
          {photos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => setActivePhoto(photo)}
              className="group relative bg-ink-950 rounded-xl border border-lilac-100 overflow-hidden aspect-square cursor-pointer shadow-2xs hover:border-gold-500 transition-all"
              title={photo.title}
            >
              <img
                src={photo.image_url}
                alt={photo.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />

              {/* Superposición elegante en Hover con título y eliminar */}
              <div className="absolute inset-0 bg-ink-950/75 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 flex flex-col justify-between text-white">
                <div className="flex items-center justify-between gap-1">
                  <Eye size={12} className="text-gold-400 shrink-0" />
                  {canModify && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoToDelete(photo);
                      }}
                      title="Eliminar foto"
                      className="text-white hover:text-red-400 p-0.5 rounded-md transition-colors shrink-0"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                <span className="text-[9px] font-semibold line-clamp-2 leading-tight text-white/95">
                  {photo.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && renderModalForm()}
      {activePhoto && renderLightbox()}
      {photoToDelete && renderDeleteConfirm()}
    </div>
  );

  // ── MODALES COMPARTIDOS ──────────────────────────────────────────────────
  function renderModalForm() {
    return (
      <div className="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          {/* Modal Header */}
          <div className="px-5 py-3.5 border-b border-lilac-100 flex items-center justify-between bg-lilac-50/30">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-gold-100 text-gold-700">
                <Camera size={16} />
              </div>
              <h3 className="font-bold text-sm text-ink-900">Ingresar Foto o Imagen</h3>
            </div>
            <button
              onClick={handleCloseModal}
              disabled={isUploading}
              className="text-ink-400 hover:text-ink-700 p-1 rounded-xl hover:bg-lilac-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-5 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Asunto de la foto */}
            <div>
              <label className="block text-xs font-bold text-ink-900 mb-1">
                Asunto de la foto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Radiografía panorámica inicial..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-lilac-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition-all text-ink-900"
              />
            </div>

            {/* Selector de Archivo de Imagen */}
            <div>
              <label className="block text-xs font-bold text-ink-900 mb-1">
                Imagen o Fotografía <span className="text-red-500">*</span>
              </label>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {!previewUrl ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-lilac-200 hover:border-gold-500 bg-lilac-50/20 hover:bg-gold-50/20 rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 group"
                >
                  <div className="w-9 h-9 rounded-full bg-lilac-100 group-hover:bg-gold-100 text-lilac-600 group-hover:text-gold-700 flex items-center justify-center transition-colors">
                    <Upload size={18} />
                  </div>
                  <span className="text-xs font-semibold text-ink-700 group-hover:text-gold-900">
                    Seleccionar imagen
                  </span>
                  <span className="text-[10px] text-ink-400">
                    JPG, PNG, WEBP (Máx. 10MB)
                  </span>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-lilac-200 bg-ink-950 aspect-4/3 group">
                  <img
                    src={previewUrl}
                    alt="Vista previa"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                    className="absolute top-2 right-2 bg-ink-900/80 hover:bg-red-600 text-white p-1 rounded-full transition-colors backdrop-blur-xs"
                    title="Cambiar imagen"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Botones de acción */}
            <div className="pt-2 border-t border-lilac-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isUploading}
                className="px-3.5 py-2 text-xs font-semibold text-ink-600 hover:text-ink-900 hover:bg-lilac-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isUploading}
                className="inline-flex items-center gap-1.5 bg-gold-600 hover:bg-gold-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Subiendo...
                  </>
                ) : (
                  <>
                    <Upload size={13} /> Guardar Foto
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderLightbox() {
    if (!activePhoto) return null;
    return (
      <div 
        className="fixed inset-0 z-50 bg-ink-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={() => setActivePhoto(null)}
      >
        <div 
          className="relative max-w-3xl w-full bg-ink-900 rounded-3xl overflow-hidden border border-ink-800 shadow-2xl flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-ink-800 flex items-center justify-between bg-ink-950/50 text-white">
            <div>
              <h3 className="font-bold text-sm text-gold-400">{activePhoto.title}</h3>
              <p className="text-[11px] text-ink-400 flex items-center gap-1 mt-0.5">
                <Calendar size={11} /> {formatDate(activePhoto.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canModify && (
                <button
                  onClick={() => {
                    setPhotoToDelete(activePhoto);
                  }}
                  title="Eliminar foto"
                  className="text-ink-400 hover:text-red-400 p-1.5 rounded-xl bg-ink-800/50 hover:bg-red-900/50 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                onClick={() => setActivePhoto(null)}
                className="text-ink-400 hover:text-white p-1.5 rounded-xl bg-ink-800/50 hover:bg-ink-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Image display */}
          <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-black/40 min-h-[250px]">
            <img
              src={activePhoto.image_url}
              alt={activePhoto.title}
              className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl shadow-lg"
            />
          </div>
        </div>
      </div>
    );
  }

  function renderDeleteConfirm() {
    if (!photoToDelete) return null;
    return (
      <div className="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3 shadow-2xl text-center">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <Trash2 size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-ink-900">¿Eliminar foto?</h3>
            <p className="text-xs text-ink-500 mt-1">
              ¿Estás seguro de eliminar &quot;{photoToDelete.title}&quot;?
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPhotoToDelete(null)}
              disabled={isDeleting}
              className="px-3.5 py-1.5 text-xs font-semibold text-ink-600 hover:bg-lilac-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all shadow-sm"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
