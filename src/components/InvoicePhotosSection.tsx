"use client";

import { useState, useRef } from "react";
import { 
  Upload, 
  Trash2, 
  X, 
  PlusCircle, 
  Eye, 
  Calendar, 
  Loader2,
  AlertCircle,
  ExternalLink,
  FileImage,
  Lock,
  Sparkles,
  Paperclip
} from "lucide-react";

export interface InvoicePhoto {
  id: string;
  invoice_id: string;
  title: string;
  image_url: string;
  storage_path?: string;
  created_at: string;
}

interface InvoicePhotosSectionProps {
  invoiceId: string;
  initialPhotos?: InvoicePhoto[];
  canModify?: boolean;
  isLocked?: boolean;
  variant?: "card" | "sidebar" | "inline";
}

export default function InvoicePhotosSection({
  invoiceId,
  initialPhotos = [],
  canModify = true,
  isLocked = false,
  variant = "inline"
}: InvoicePhotosSectionProps) {
  const [photos, setPhotos] = useState<InvoicePhoto[]>(initialPhotos);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Lightbox Modal State
  const [activePhoto, setActivePhoto] = useState<InvoicePhoto | null>(null);

  // Delete State
  const [photoToDelete, setPhotoToDelete] = useState<InvoicePhoto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowModifications = canModify;
  const canDeletePhoto = canModify && !isLocked;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setErrorMsg("Por favor selecciona un archivo de imagen válido (JPG, PNG, WEBP).");
        return;
      }
      setSelectedFile(file);
      setErrorMsg("");
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleOpenModal = () => {
    setTitle("");
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg("Debes seleccionar una imagen para subir.");
      return;
    }

    try {
      setIsUploading(true);
      setErrorMsg("");

      const formData = new FormData();
      formData.append("invoiceId", invoiceId);
      formData.append("title", title.trim() || "Comprobante / Imagen de Factura");
      formData.append("imageFile", selectedFile);

      const response = await fetch("/api/admin/invoice-photos", {
        method: "POST",
        body: formData,
      });

      const res = await response.json();

      if (!response.ok || !res.success) {
        setErrorMsg(res.error || "Error al subir la imagen.");
      } else {
        if (res.photo) {
          setPhotos([res.photo, ...photos]);
        }
        setIsModalOpen(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar la imagen.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!photoToDelete || !canDeletePhoto) return;
    try {
      setIsDeleting(true);
      const response = await fetch(
        `/api/admin/invoice-photos?photoId=${photoToDelete.id}&invoiceId=${invoiceId}`,
        { method: "DELETE" }
      );
      const res = await response.json();

      if (response.ok && res.success) {
        setPhotos(photos.filter((p) => p.id !== photoToDelete.id));
        setPhotoToDelete(null);
        if (activePhoto?.id === photoToDelete.id) {
          setActivePhoto(null);
        }
      } else {
        alert(res.error || "No se pudo eliminar la imagen.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al intentar eliminar la imagen.");
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

  const hasPhotos = photos.length > 0;

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {hasPhotos ? (
          photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActivePhoto(photo)}
              className="group inline-flex items-center gap-2 bg-white hover:bg-gold-50 border border-lilac-200 hover:border-gold-400 p-1.5 rounded-xl transition-all shadow-2xs cursor-pointer text-left"
              title={`Ver ${photo.title}`}
            >
              <img
                src={photo.image_url}
                alt={photo.title}
                className="w-8 h-8 rounded-lg object-cover border border-lilac-200 group-hover:scale-105 transition-transform"
              />
              <div className="flex flex-col text-left pr-1">
                <span className="text-[11px] font-extrabold text-ink-900 flex items-center gap-1 leading-tight">
                  <Eye size={11} className="text-gold-600" />
                  <span>Ver Comprobante</span>
                </span>
                <span className="text-[9px] font-medium text-ink-500 line-clamp-1 max-w-[110px]">
                  {photo.title}
                </span>
              </div>
            </button>
          ))
        ) : null}

        {allowModifications && (
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center justify-center gap-1 text-xs font-bold text-gold-800 bg-gold-50 hover:bg-gold-100 border border-gold-200 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs hover:scale-105"
            title="Adjuntar comprobante o voucher"
          >
            <Paperclip size={13} className="text-gold-600" />
            <span>+</span>
          </button>
        )}

        {!hasPhotos && !allowModifications && (
          <span className="text-xs text-ink-400 italic">Sin comprobante adjunto</span>
        )}

        {/* Modal Lightbox de Visualización Amplia */}
        {activePhoto && (
          <div 
            className="fixed inset-0 z-50 bg-ink-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setActivePhoto(null)}
          >
            <div 
              className="relative max-w-4xl w-full bg-ink-900 rounded-3xl overflow-hidden border border-ink-800 shadow-2xl flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Lightbox Header */}
              <div className="px-6 py-4 border-b border-ink-800 flex items-center justify-between bg-ink-950/60 text-white">
                <div>
                  <h3 className="font-bold text-sm text-gold-400">{activePhoto.title}</h3>
                  <p className="text-xs text-ink-400 flex items-center gap-1 mt-0.5">
                    <Calendar size={12} /> {formatDate(activePhoto.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={activePhoto.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink-800 hover:bg-ink-700 text-white text-xs font-semibold rounded-xl border border-ink-700 transition-colors"
                    title="Abrir imagen en pestaña nueva"
                  >
                    <ExternalLink size={13} /> Abrir original
                  </a>
                  {canDeletePhoto && !activePhoto.id.startsWith("pay-") && (
                    <button
                      type="button"
                      onClick={() => setPhotoToDelete(activePhoto)}
                      className="p-1.5 text-ink-400 hover:text-red-400 rounded-xl bg-ink-800/50 hover:bg-red-950/50 transition-colors"
                      title="Eliminar imagen"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActivePhoto(null)}
                    className="p-1.5 text-ink-400 hover:text-white rounded-xl bg-ink-800/50 hover:bg-ink-800 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Lightbox Body */}
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40">
                <img
                  src={activePhoto.image_url}
                  alt={activePhoto.title}
                  className="max-h-[75vh] w-auto object-contain rounded-xl shadow-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal de Subir Nueva Foto */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-lilac-100 space-y-4">
              <div className="flex items-center justify-between border-b border-lilac-50 pb-3">
                <h3 className="font-bold text-ink-900 text-sm flex items-center gap-2">
                  <Paperclip size={16} className="text-gold-600" />
                  Adjuntar Comprobante o Imagen
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-ink-400 hover:text-ink-700 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-ink-700 mb-1">
                    Descripción / Título (Opcional)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Voucher de transferencia, Recibo de caja..."
                    className="w-full bg-lilac-50/50 border border-lilac-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-700 mb-1">
                    Seleccionar Archivo de Imagen
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-lilac-200 hover:border-gold-400 bg-lilac-50/30 rounded-2xl p-5 text-center cursor-pointer transition-colors"
                  >
                    {previewUrl ? (
                      <div className="space-y-2">
                        <img
                          src={previewUrl}
                          alt="Vista previa"
                          className="max-h-36 mx-auto rounded-xl object-contain shadow-sm border border-lilac-100"
                        />
                        <p className="text-[11px] text-gold-700 font-bold">Cambiar imagen</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload size={24} className="mx-auto text-lilac-400" />
                        <p className="text-xs font-bold text-ink-800">Haz clic para buscar imagen</p>
                        <p className="text-[10px] text-ink-400">JPG, PNG, WEBP (Máx. 5MB)</p>
                      </div>
                    )}
                  </div>
                </div>

                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-lilac-50">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-ink-600 hover:bg-lilac-50 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="btn-primary text-xs font-bold px-4 py-2 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <span>Guardar Imagen</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Confirmación de Eliminación */}
        {photoToDelete && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-lilac-100 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="font-bold text-ink-900 text-sm">¿Eliminar comprobante?</h3>
                <p className="text-xs text-ink-500 mt-1">
                  Esta acción no se puede deshacer. Se eliminará la imagen de los registros.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPhotoToDelete(null)}
                  className="px-4 py-2 text-xs font-bold text-ink-600 hover:bg-lilac-50 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {isDeleting ? <Loader2 size={13} className="animate-spin" /> : "Eliminar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden p-3.5 space-y-2.5 h-fit">
      {/* Header Compacto */}
      <div className="flex items-center justify-between border-b border-lilac-50 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-lilac-100 text-lilac-700">
            <FileImage size={14} />
          </div>
          <h2 className="text-xs font-bold text-ink-900 flex items-center gap-1.5">
            <span>Comprobantes e Imágenes</span>
            {hasPhotos && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-lilac-100 text-lilac-800 font-extrabold">
                {photos.length}
              </span>
            )}
          </h2>
        </div>

        {allowModifications && (
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center gap-1 bg-gold-50 hover:bg-gold-100 text-gold-800 font-bold text-[10px] px-2 py-1 rounded-lg border border-gold-200 transition-all cursor-pointer"
          >
            <PlusCircle size={12} className="text-gold-600" />
            <span>+ Adjuntar</span>
          </button>
        )}
      </div>

      {/* Grid de miniaturas ultra-compacto */}
      {hasPhotos ? (
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

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-ink-950/80 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 flex flex-col justify-between text-white">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[8px] font-bold text-gold-300 flex items-center gap-0.5">
                    <Eye size={9} /> Ampliar
                  </span>
                  {canDeletePhoto && !photo.id.startsWith("pay-") && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoToDelete(photo);
                      }}
                      title="Eliminar imagen"
                      className="text-white hover:text-red-400 p-0.5 rounded transition-colors"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
                <span className="text-[9px] font-semibold line-clamp-1 leading-tight text-white/95">
                  {photo.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-2.5 px-3 bg-lilac-50/30 rounded-xl border border-dashed border-lilac-200 flex items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileImage size={14} className="text-lilac-400 shrink-0" />
            <span className="text-[11px] font-medium text-ink-600 truncate">Sin comprobante o imagen adjunta</span>
          </div>
          {allowModifications && (
            <button
              type="button"
              onClick={handleOpenModal}
              className="text-[10px] font-bold text-gold-800 bg-gold-50 hover:bg-gold-100 border border-gold-200 px-2 py-0.5 rounded-lg transition-all shrink-0 cursor-pointer"
            >
              + Adjuntar
            </button>
          )}
        </div>
      )}

      {/* Modal Lightbox de Visualización Amplia */}
      {activePhoto && (
        <div 
          className="fixed inset-0 z-50 bg-ink-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setActivePhoto(null)}
        >
          <div 
            className="relative max-w-4xl w-full bg-ink-900 rounded-3xl overflow-hidden border border-ink-800 shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div className="px-6 py-4 border-b border-ink-800 flex items-center justify-between bg-ink-950/60 text-white">
              <div>
                <h3 className="font-bold text-sm text-gold-400">{activePhoto.title}</h3>
                <p className="text-xs text-ink-400 flex items-center gap-1 mt-0.5">
                  <Calendar size={12} /> {formatDate(activePhoto.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={activePhoto.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink-800 hover:bg-ink-700 text-white text-xs font-semibold rounded-xl border border-ink-700 transition-colors"
                  title="Abrir imagen en pestaña nueva"
                >
                  <ExternalLink size={13} /> Abrir original
                </a>
                {allowModifications && !activePhoto.id.startsWith("pay-") && (
                  <button
                    type="button"
                    onClick={() => setPhotoToDelete(activePhoto)}
                    className="p-1.5 text-ink-400 hover:text-red-400 rounded-xl bg-ink-800/50 hover:bg-red-950/50 transition-colors"
                    title="Eliminar imagen"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActivePhoto(null)}
                  className="p-1.5 text-ink-400 hover:text-white rounded-xl bg-ink-800/50 hover:bg-ink-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Lightbox Body */}
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-black/50 min-h-[300px]">
              <img
                src={activePhoto.image_url}
                alt={activePhoto.title}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl shadow-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Subir Imagen */}
      {isModalOpen && allowModifications && (
        <div className="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-3.5 border-b border-lilac-100 flex items-center justify-between bg-lilac-50/30">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-lilac-100 text-lilac-700">
                  <FileImage size={16} />
                </div>
                <h3 className="font-bold text-sm text-ink-900">Adjuntar Comprobante o Foto</h3>
              </div>
              <button
                type="button"
                onClick={() => !isUploading && setIsModalOpen(false)}
                className="text-ink-400 hover:text-ink-700 p-1 rounded-xl hover:bg-lilac-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-ink-900 mb-1">
                  Asunto / Descripción del Comprobante
                </label>
                <input
                  type="text"
                  placeholder="Ej: Voucher de tarjeta, comprobante de transferencia..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-lilac-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lilac-500/20 focus:border-lilac-500 transition-all text-ink-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-900 mb-1">
                  Imagen del Comprobante <span className="text-red-500">*</span>
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
                  <div className="relative rounded-2xl overflow-hidden border border-lilac-200 bg-ink-950 aspect-4/3">
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
                      className="absolute top-2 right-2 bg-ink-900/80 hover:bg-red-600 text-white p-1 rounded-full transition-colors"
                      title="Cambiar imagen"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-lilac-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isUploading}
                  className="px-3.5 py-2 text-xs font-semibold text-ink-600 hover:text-ink-900 hover:bg-lilac-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  className="inline-flex items-center gap-1.5 bg-gold-600 hover:bg-gold-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Subiendo...
                    </>
                  ) : (
                    <>
                      <Upload size={13} /> Guardar Imagen
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {photoToDelete && allowModifications && (
        <div className="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3 shadow-2xl text-center">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-ink-900">¿Eliminar comprobante?</h3>
              <p className="text-xs text-ink-500 mt-1">
                ¿Estás seguro de eliminar &quot;{photoToDelete.title}&quot; de la factura?
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
      )}
    </div>
  );
}
