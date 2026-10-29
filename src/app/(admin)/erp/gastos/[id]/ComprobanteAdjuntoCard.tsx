"use client";

import { useState } from "react";
import {
  Paperclip,
  ExternalLink,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  FileText,
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
    <>
      {/* Barra compacta optimizada para ahorrar espacio */}
      <div className="bg-white border border-lilac-200/90 rounded-2xl shadow-xs px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
              isPdf
                ? "bg-red-50 text-red-600 border border-red-200"
                : "bg-lilac-50 text-lilac-700 border border-lilac-200"
            }`}
          >
            {isPdf ? <FileText size={18} /> : <Paperclip size={18} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-ink-900 tracking-wide">
                Respaldo Digital / Comprobante
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase tracking-wider ${
                  isPdf
                    ? "bg-red-100 text-red-800 border border-red-200"
                    : "bg-lilac-100 text-lilac-800 border border-lilac-200"
                }`}
              >
                {isPdf ? "PDF" : "IMAGEN"}
              </span>
            </div>
            <p className="text-[11px] text-ink-500 font-mono truncate max-w-[200px] sm:max-w-md mt-0.5">
              {fileName}
            </p>
          </div>
        </div>

        {/* Acciones compactas */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-lilac-600 hover:bg-lilac-700 px-3.5 py-1.5 rounded-xl shadow-xs transition active:scale-[0.98]"
          >
            <Eye size={14} />
            <span>Ver comprobante</span>
          </button>
          <a
            href={proxiedUrl}
            download={fileName}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-700 hover:text-ink-900 bg-white hover:bg-lilac-50 border border-lilac-200 px-3 py-1.5 rounded-xl shadow-2xs transition"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Descargar</span>
          </a>
          <a
            href={proxiedUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center text-xs font-semibold text-ink-600 hover:text-ink-900 bg-white hover:bg-lilac-50 border border-lilac-200 w-8 h-8 rounded-xl shadow-2xs transition"
            title="Abrir en pestaña nueva"
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Modal Lightbox Popup */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/85 backdrop-blur-xs flex flex-col p-3 sm:p-6"
          onClick={() => setIsModalOpen(false)}
        >
          {/* Barra superior de herramientas del popup */}
          <div
            className="flex items-center justify-between bg-ink-900/95 text-white px-4 py-2.5 rounded-2xl mb-3 shadow-xl border border-ink-800 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Paperclip size={15} className="text-lilac-300 shrink-0" />
              <span className="text-xs font-semibold truncate max-w-[180px] sm:max-w-md">
                {fileName}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {!isPdf && (
                <>
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
                </>
              )}
              <a
                href={proxiedUrl}
                download={fileName}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-ink-800 hover:bg-ink-700 text-white rounded-lg transition"
                title="Descargar archivo"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Descargar</span>
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

          {/* Área visualizadora del popup */}
          <div
            className="flex-1 overflow-auto flex items-center justify-center p-2"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsModalOpen(false);
            }}
          >
            {isPdf ? (
              <div className="w-full h-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <iframe
                  src={proxiedUrl}
                  title="Visor PDF Comprobante"
                  className="w-full h-full min-h-[70vh] border-0"
                />
              </div>
            ) : (
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
            )}
          </div>
        </div>
      )}
    </>
  );
}
