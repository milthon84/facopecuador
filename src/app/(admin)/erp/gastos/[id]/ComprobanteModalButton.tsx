"use client";

import { useState } from "react";
import { Eye, FileText, Paperclip, Download, ExternalLink, X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { proxyStorageUrl } from "@/lib/storage-proxy";

interface Props {
  receiptUrl?: string | null;
  paymentReceiptUrl?: string | null;
}

export default function ComprobanteModalButton({ receiptUrl, paymentReceiptUrl }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"gasto" | "pago">(receiptUrl ? "gasto" : "pago");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!receiptUrl && !paymentReceiptUrl) return null;

  const currentUrl = activeTab === "gasto" ? receiptUrl : paymentReceiptUrl;
  const proxiedUrl = currentUrl ? proxyStorageUrl(currentUrl) : "";
  const isPdf = Boolean(
    currentUrl &&
      (currentUrl.toLowerCase().includes(".pdf") || currentUrl.toLowerCase().includes("application/pdf"))
  );
  const fileName = currentUrl?.split("/").pop()?.split("?")[0] || "comprobante";

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  const count = (receiptUrl ? 1 : 0) + (paymentReceiptUrl ? 1 : 0);

  return (
    <>
      {/* Botón con el ojo para abrir el popup de comprobantes */}
      <button
        type="button"
        onClick={() => {
          if (!currentUrl && receiptUrl) setActiveTab("gasto");
          else if (!currentUrl && paymentReceiptUrl) setActiveTab("pago");
          setIsOpen(true);
        }}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-teal-300 hover:bg-teal-50 text-teal-900 text-xs font-bold transition shadow-xs hover:border-teal-400 active:scale-[0.98]"
        title="Ver Comprobantes Digitales (PDF o Fotos)"
      >
        <Eye size={15} className="text-teal-600" />
        <span>Ver Comprobantes</span>
        <span className="text-[10px] bg-teal-100 text-teal-800 border border-teal-200 px-1.5 py-0.2 rounded-full font-bold font-mono">
          {count}
        </span>
      </button>

      {/* Modal Popup para ver los comprobantes en tamaño completo */}
      {isOpen && currentUrl && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fadeIn"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl border border-lilac-200 overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <div className="px-4 py-3 bg-white border-b border-lilac-200 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                {receiptUrl && paymentReceiptUrl ? (
                  <div className="flex rounded-xl bg-lilac-50 p-1 border border-lilac-200">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("gasto");
                        handleReset();
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        activeTab === "gasto"
                          ? "bg-lilac-600 text-white shadow-2xs"
                          : "text-ink-600 hover:text-ink-900"
                      }`}
                    >
                      📄 Factura / Compra
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("pago");
                        handleReset();
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        activeTab === "pago"
                          ? "bg-lilac-600 text-white shadow-2xs"
                          : "text-ink-600 hover:text-ink-900"
                      }`}
                    >
                      💳 Pago / Transferencia
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center">
                      {isPdf ? <FileText size={16} /> : <Paperclip size={16} />}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-ink-900">
                        {activeTab === "gasto" ? "Factura / Comprobante de Compra" : "Comprobante de Pago / Transferencia"}
                      </h3>
                      <p className="text-[10px] text-ink-500 font-mono truncate max-w-xs">{fileName}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Controles y botones de descarga / cerrar */}
              <div className="flex items-center gap-2">
                {!isPdf && (
                  <div className="hidden sm:flex items-center gap-1 border border-lilac-200 rounded-xl p-1 bg-white">
                    <button
                      type="button"
                      onClick={handleZoomOut}
                      className="p-1 rounded text-ink-600 hover:text-ink-900 hover:bg-lilac-50"
                      title="Alejar"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <span className="text-[10px] font-mono px-1 font-bold text-ink-700">{Math.round(zoomLevel * 100)}%</span>
                    <button
                      type="button"
                      onClick={handleZoomIn}
                      className="p-1 rounded text-ink-600 hover:text-ink-900 hover:bg-lilac-50"
                      title="Acercar"
                    >
                      <ZoomIn size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={handleRotate}
                      className="p-1 rounded text-ink-600 hover:text-ink-900 hover:bg-lilac-50"
                      title="Girar 90°"
                    >
                      <RotateCw size={14} />
                    </button>
                  </div>
                )}

                <a
                  href={proxiedUrl}
                  download={fileName}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-lilac-200 bg-white hover:bg-lilac-50 text-ink-700 text-xs font-semibold shadow-2xs transition"
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">Descargar</span>
                </a>

                <a
                  href={proxiedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-xl border border-lilac-200 bg-white hover:bg-lilac-50 text-ink-700 flex items-center justify-center shadow-2xs transition"
                  title="Abrir en pestaña nueva"
                >
                  <ExternalLink size={14} />
                </a>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white border border-lilac-200 text-ink-400 hover:text-ink-800 hover:bg-lilac-50 flex items-center justify-center transition shadow-2xs"
                  title="Cerrar ventana"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Visor del Documento */}
            <div className="flex-1 bg-ink-950/90 relative overflow-hidden flex items-center justify-center">
              {isPdf ? (
                <iframe
                  src={proxiedUrl}
                  className="w-full h-full border-none bg-white"
                  title="Comprobante PDF"
                />
              ) : (
                <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                  <img
                    src={proxiedUrl}
                    alt={fileName}
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transition: "transform 0.15s ease-out",
                    }}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg select-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
