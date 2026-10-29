"use client";

import { useState } from "react";
import {
  Paperclip,
  ExternalLink,
  Download,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  FileText,
  AlertCircle,
  Eye,
} from "lucide-react";
import { proxyStorageUrl } from "@/lib/storage-proxy";

interface Props {
  receiptUrl: string;
}

export default function ComprobanteAdjuntoCard({ receiptUrl }: Props) {
  const proxiedUrl = proxyStorageUrl(receiptUrl);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const isPdf = Boolean(
    receiptUrl.toLowerCase().includes(".pdf") ||
    receiptUrl.toLowerCase().includes("application/pdf")
  );

  const fileName = receiptUrl.split("/").pop()?.split("?")[0] || "comprobante";

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  return (
    <div className="bg-white border border-lilac-200/80 rounded-2xl shadow-xs overflow-hidden">
      {/* Cabecera del Respaldo */}
      <div className="flex items-center justify-between px-4 py-3 bg-lilac-50/40 border-b border-lilac-100 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-lilac-100 text-lilac-700 flex items-center justify-center shrink-0">
            <Paperclip size={15} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wide">
              Respaldo Digital / Comprobante Adjunto
            </h3>
            <p className="text-[11px] text-ink-500 font-mono truncate max-w-[240px] sm:max-w-md">
              {fileName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={proxiedUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-lilac-700 hover:text-lilac-900 bg-white hover:bg-lilac-50 border border-lilac-200 px-2.5 py-1.5 rounded-xl shadow-2xs transition"
          >
            <ExternalLink size={13} />
            <span>Abrir original</span>
          </a>
          <a
            href={proxiedUrl}
            download={fileName}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-700 hover:text-ink-900 bg-white hover:bg-lilac-50 border border-lilac-200 px-2.5 py-1.5 rounded-xl shadow-2xs transition"
          >
            <Download size={13} />
            <span>Descargar</span>
          </a>
        </div>
      </div>

      {/* Cuerpo del visor */}
      <div className="p-4">
        {isPdf ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gradient-to-r from-red-50/80 to-rose-50/50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex flex-col items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                <FileText size={20} />
                <span className="text-[9px] uppercase tracking-wider mt-0.5">PDF</span>
              </div>
              <div>
                <p className="text-xs font-bold text-ink-900">Documento PDF / Factura Electrónica</p>
                <p className="text-[11px] text-ink-500 mt-0.5">Comprobante tributario o respaldo adjunto</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href={proxiedUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-2 rounded-xl font-bold shadow-xs transition"
              >
                <Eye size={14} /> Ver PDF
              </a>
            </div>
          </div>
        ) : imgError ? (
          <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-ink-800">
                No se pudo previsualizar la imagen directamente
              </p>
              <p className="text-[11px] text-ink-500 mt-0.5 max-w-sm mx-auto">
                El comprobante existe en el registro pero no pudo renderizarse en el navegador. Puedes abrirlo o descargarlo.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <a
                href={proxiedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-lilac-600 hover:bg-lilac-700 text-white px-3.5 py-1.5 rounded-xl transition shadow-2xs"
              >
                <ExternalLink size={13} /> Abrir en nueva pestaña
              </a>
              {receiptUrl !== proxiedUrl && (
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white hover:bg-gray-100 text-ink-700 border border-gray-300 px-3 py-1.5 rounded-xl transition"
                >
                  Probar enlace directo
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div
              onClick={() => setIsModalOpen(true)}
              className="relative rounded-xl overflow-hidden border border-lilac-200 bg-slate-50/80 hover:bg-slate-100/80 transition cursor-zoom-in group flex items-center justify-center min-h-[160px] max-h-[360px]"
            >
              {!isLoaded && !imgError && (
                <div className="py-12 flex flex-col items-center justify-center text-ink-400 gap-2">
                  <div className="w-6 h-6 border-2 border-lilac-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium">Cargando comprobante...</span>
                </div>
              )}
              <img
                src={proxiedUrl}
                alt="Comprobante de gasto adjunto"
                onLoad={() => setIsLoaded(true)}
                onError={() => setImgError(true)}
                className={`max-h-[360px] w-auto max-w-full object-contain mx-auto transition-opacity duration-200 ${
                  isLoaded ? "opacity-100" : "opacity-0"
                }`}
              />

              {isLoaded && (
                <div className="absolute inset-0 bg-ink-950/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
                  <span className="bg-white/95 backdrop-blur-xs text-ink-900 text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 transform translate-y-1 group-hover:translate-y-0 transition-transform">
                    <Maximize2 size={13} className="text-lilac-600" /> Clic para ampliar a tamaño completo
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Lightbox de Pantalla Completa con Zoom y Rotación */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/85 backdrop-blur-xs flex flex-col p-3 sm:p-6"
          onClick={() => setIsModalOpen(false)}
        >
          {/* Barra de herramientas superior del modal */}
          <div
            className="flex items-center justify-between bg-ink-900/90 text-white px-4 py-2.5 rounded-2xl mb-3 shadow-xl border border-ink-800 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Paperclip size={15} className="text-lilac-300" />
              <span className="text-xs font-semibold truncate max-w-[200px] sm:max-w-md">
                {fileName}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-ink-800 rounded-lg text-ink-200 hover:text-white transition"
                title="Acercar (+)"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-ink-800 rounded-lg text-ink-200 hover:text-white transition"
                title="Alejar (-)"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={handleRotate}
                className="p-1.5 hover:bg-ink-800 rounded-lg text-ink-200 hover:text-white transition"
                title="Girar 90°"
              >
                <RotateCw size={16} />
              </button>
              {(zoomLevel !== 1 || rotation !== 0) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11px] px-2 py-1 bg-ink-800 hover:bg-ink-700 text-ink-200 rounded-md transition"
                >
                  Restablecer
                </button>
              )}
              <a
                href={proxiedUrl}
                download={fileName}
                className="p-1.5 hover:bg-ink-800 rounded-lg text-ink-200 hover:text-white transition"
                title="Descargar comprobante"
              >
                <Download size={16} />
              </a>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-red-600/80 rounded-lg text-ink-300 hover:text-white transition ml-1"
                title="Cerrar (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Área visualizadora con scroll y pan */}
          <div
            className="flex-1 overflow-auto flex items-center justify-center p-2"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsModalOpen(false);
            }}
          >
            <img
              src={proxiedUrl}
              alt="Comprobante en tamaño completo"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                transition: "transform 0.15s ease-out",
              }}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
