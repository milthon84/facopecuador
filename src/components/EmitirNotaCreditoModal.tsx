"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Printer,
  Copy,
  Receipt,
  FileCheck2,
} from "lucide-react";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  iva_code?: string;
  total: number;
}

interface Props {
  invoiceId: string;
  invoiceNumber: string | null;
  clientName: string;
  clientDocument: string;
  issueDate?: string | null;
  total: number;
  subtotal15: number;
  subtotal0: number;
  ivaAmount: number;
  items: InvoiceItem[];
  existingCreditNote?: {
    id: string;
    credit_note_number: string;
    sri_status: string;
    sri_authorization_number?: string;
  } | null;
}

const COMMON_MOTIVOS = [
  "Anulación total de la factura",
  "Devolución de servicio o producto",
  "Error en datos de facturación",
  "Descuento concedido posterior a la emisión",
  "Rescisión de contrato o tratamiento",
];

export default function EmitirNotaCreditoModal({
  invoiceId,
  invoiceNumber,
  clientName,
  clientDocument,
  issueDate,
  total,
  subtotal15,
  subtotal0,
  ivaAmount,
  items,
  existingCreditNote,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [motivo, setMotivo] = useState("Anulación total de la factura");
  const [isFullCancellation, setIsFullCancellation] = useState(true);

  // Ítems seleccionados para parcial
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>(
    () => Object.fromEntries(items.map((it) => [it.id, true]))
  );

  // Resultado
  const [result, setResult] = useState<{
    success: boolean;
    credit_note_id?: string;
    credit_note_number?: string;
    sri_status?: string;
    sri_authorization_number?: string;
    clave_acceso?: string;
    message?: string;
    error?: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  // Cálculo de montos según ítems seleccionados
  const activeItems = isFullCancellation
    ? items
    : items.filter((it) => selectedItems[it.id]);

  let calcSubtotal15 = 0;
  let calcSubtotal0 = 0;

  activeItems.forEach((it) => {
    const q = Number(it.quantity || 1);
    const pu = Number(it.unit_price || 0);
    const desc = Number(it.discount || 0);
    const st = q * pu - desc;
    if (it.iva_code === "4") {
      calcSubtotal15 += st;
    } else {
      calcSubtotal0 += st;
    }
  });

  const calcIva = calcSubtotal15 * 0.15;
  const calcTotal = calcSubtotal15 + calcSubtotal0 + calcIva;

  const handleCopyClave = async (clave: string) => {
    try {
      await navigator.clipboard.writeText(clave);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEmitir = async () => {
    if (!motivo.trim()) {
      alert("Por favor ingresa un motivo para la Nota de Crédito.");
      return;
    }

    if (activeItems.length === 0) {
      alert("Debes seleccionar al menos un ítem para reversar.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/nota-credito", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: invoiceId,
          motivo: motivo.trim(),
          items: isFullCancellation ? undefined : activeItems,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({
          success: false,
          error: data.error || "Ocurrió un error al emitir la Nota de Crédito.",
        });
        return;
      }

      setResult({
        success: true,
        credit_note_id: data.credit_note_id,
        credit_note_number: data.credit_note_number,
        sri_status: data.sri_status,
        sri_authorization_number: data.sri_authorization_number,
        clave_acceso: data.clave_acceso,
        message: data.message,
      });

      router.refresh();
    } catch (err: any) {
      setResult({
        success: false,
        error: err.message || "Error de conexión con el servidor.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón trigger en cabecera */}
      {existingCreditNote ? (
        <a
          href={`/api/nota-credito/${existingCreditNote.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 px-3.5 py-2 rounded-xl transition shadow-sm"
          title={`Nota de Crédito ${existingCreditNote.credit_note_number} emitida`}
        >
          <Receipt size={14} />
          <span>NC {existingCreditNote.credit_note_number}</span>
          <Printer size={12} className="ml-1 opacity-70" />
        </a>
      ) : (
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setIsOpen(true);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 px-3.5 py-2 rounded-xl transition shadow-sm hover:scale-[1.02] active:scale-[0.98]"
          title="Emitir Nota de Crédito en el SRI para esta factura"
        >
          <Receipt size={14} />
          <span>Emitir Nota de Crédito</span>
        </button>
      )}

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white border border-lilac-200 rounded-3xl p-6 max-w-xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Botón cerrar */}
            <button
              type="button"
              onClick={() => {
                if (!loading) {
                  setIsOpen(false);
                  if (result?.success) router.refresh();
                }
              }}
              disabled={loading}
              className="absolute top-4 right-4 text-ink-400 hover:text-ink-900 transition-colors disabled:opacity-50"
            >
              <X size={18} />
            </button>

            {/* Cabecera del modal */}
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-lilac-100">
              <div className="h-10 w-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                <Receipt size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink-900">
                  Emitir Nota de Crédito SRI (Tipo 04)
                </h3>
                <p className="text-xs text-ink-500">
                  Modifica o anula la Factura{" "}
                  <strong className="text-ink-800">{invoiceNumber || "Sin número"}</strong>
                </p>
              </div>
            </div>

            {/* PANTALLA DE ÉXITO */}
            {result?.success ? (
              <div className="py-4 space-y-4 text-center">
                <div className="h-16 w-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 animate-bounce">
                  <CheckCircle2 size={38} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-ink-900">
                    ¡Nota de Crédito Emitida con Éxito!
                  </h4>
                  <p className="text-xs text-ink-600 mt-1 max-w-md mx-auto">
                    {result.message}
                  </p>
                </div>

                {/* Tarjeta de detalles */}
                <div className="bg-lilac-50/50 border border-lilac-100 rounded-2xl p-4 text-left space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-ink-500 font-medium">N° de Comprobante:</span>
                    <span className="font-bold font-mono text-ink-900">
                      {result.credit_note_number}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-500 font-medium">Estado en SRI:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                        result.sri_status === "authorized"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {result.sri_status?.toUpperCase()}
                    </span>
                  </div>

                  {result.clave_acceso && (
                    <div className="pt-2 border-t border-lilac-100">
                      <span className="text-[10px] text-ink-400 uppercase tracking-wide block mb-1">
                        Clave de Acceso (49 dígitos)
                      </span>
                      <div className="flex items-center gap-2">
                        <code className="text-[11px] font-mono bg-white border border-lilac-200 rounded-lg p-2 break-all flex-1 text-ink-800 select-all">
                          {result.clave_acceso}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyClave(result.clave_acceso!)}
                          className="px-2.5 py-2 bg-lilac-600 text-white rounded-lg text-xs font-semibold hover:bg-lilac-700 transition"
                          title="Copiar clave"
                        >
                          {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-center pt-2">
                  <a
                    href={`/api/nota-credito/${result.credit_note_id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl font-bold"
                  >
                    <Printer size={14} />
                    <span>Ver / Imprimir RIDE PDF</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      router.refresh();
                    }}
                    className="btn-secondary text-xs px-4 py-2 rounded-xl font-semibold"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              /* FORMULARIO DE EMISIÓN */
              <div className="space-y-4">
                {/* Resumen Factura Sustento */}
                <div className="bg-lilac-50/40 border border-lilac-100 rounded-2xl p-3.5 text-xs grid grid-cols-2 gap-2 text-ink-700">
                  <div>
                    <span className="text-ink-400 block text-[10px] uppercase font-bold">Cliente</span>
                    <span className="font-semibold">{clientName}</span>
                    <span className="text-ink-500 block text-[11px]">{clientDocument}</span>
                  </div>
                  <div>
                    <span className="text-ink-400 block text-[10px] uppercase font-bold">Factura Original</span>
                    <span className="font-mono font-bold">{invoiceNumber}</span>
                    <span className="text-ink-500 block text-[11px]">
                      Total: ${Number(total).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Motivo */}
                <div>
                  <label className="block text-xs font-bold text-ink-800 mb-1.5">
                    Motivo de la emisión <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ej. Anulación total de factura por acuerdo mutuo"
                    className="w-full text-xs rounded-xl border border-lilac-200 px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-400"
                    maxLength={300}
                  />

                  {/* Sugerencias rápidas */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {COMMON_MOTIVOS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMotivo(m)}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border transition ${
                          motivo === m
                            ? "bg-lilac-600 text-white border-lilac-600 font-bold"
                            : "bg-white text-ink-600 border-lilac-200 hover:bg-lilac-50"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alcance de la anulación */}
                <div>
                  <label className="block text-xs font-bold text-ink-800 mb-1.5">
                    Alcance de la Nota de Crédito
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setIsFullCancellation(true)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        isFullCancellation
                          ? "bg-rose-50 border-rose-300 text-rose-900 font-bold ring-1 ring-rose-300"
                          : "bg-white border-lilac-200 text-ink-600 hover:bg-lilac-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <FileCheck2 size={14} className={isFullCancellation ? "text-rose-600" : "text-ink-400"} />
                        <span>Anulación Total</span>
                      </div>
                      <p className="text-[10px] font-normal text-ink-500 mt-0.5">
                        Reversa el 100% de los valores facturados
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsFullCancellation(false)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        !isFullCancellation
                          ? "bg-rose-50 border-rose-300 text-rose-900 font-bold ring-1 ring-rose-300"
                          : "bg-white border-lilac-200 text-ink-600 hover:bg-lilac-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Receipt size={14} className={!isFullCancellation ? "text-rose-600" : "text-ink-400"} />
                        <span>Modificación Parcial</span>
                      </div>
                      <p className="text-[10px] font-normal text-ink-500 mt-0.5">
                        Seleccionar ítems específicos a devolver
                      </p>
                    </button>
                  </div>
                </div>

                {/* Lista de ítems si es parcial */}
                {!isFullCancellation && (
                  <div className="border border-lilac-100 rounded-2xl p-3 bg-slate-50/50 space-y-2 text-xs">
                    <span className="font-bold text-[11px] text-ink-700 block">
                      Selecciona los ítems a reversar:
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {items.map((it) => (
                        <label
                          key={it.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-white border border-lilac-100 hover:bg-lilac-50/50 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedItems[it.id])}
                              onChange={(e) =>
                                setSelectedItems((prev) => ({
                                  ...prev,
                                  [it.id]: e.target.checked,
                                }))
                              }
                              className="rounded text-rose-600 focus:ring-rose-400"
                            />
                            <span className="text-ink-800 font-medium">{it.description}</span>
                          </div>
                          <span className="font-mono text-ink-900 font-bold">
                            ${Number(it.total).toFixed(2)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resumen Financiero a Reversar */}
                <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-3.5 space-y-1.5 text-xs">
                  <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wide block">
                    Resumen de valores a acreditar en SRI
                  </span>
                  <div className="flex justify-between text-ink-600">
                    <span>Subtotal 15%:</span>
                    <span className="font-mono">${calcSubtotal15.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-ink-600">
                    <span>Subtotal 0%:</span>
                    <span className="font-mono">${calcSubtotal0.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-ink-600">
                    <span>IVA 15%:</span>
                    <span className="font-mono">${calcIva.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-rose-950 border-t border-rose-200 pt-1.5 mt-1">
                    <span>VALOR MODIFICACIÓN TOTAL:</span>
                    <span className="font-mono">${calcTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Error si falló */}
                {result?.error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-3 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{result.error}</span>
                  </div>
                )}

                {/* Botones de acción */}
                <div className="flex gap-2 justify-end pt-2 border-t border-lilac-100">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    disabled={loading}
                    className="btn-secondary text-xs px-4 py-2.5 rounded-xl font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleEmitir}
                    disabled={loading || calcTotal <= 0}
                    className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-md shadow-rose-200 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Firmando y enviando al SRI...</span>
                      </>
                    ) : (
                      <>
                        <Receipt size={14} />
                        <span>Emitir y Enviar al SRI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
