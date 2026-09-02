"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X, AlertTriangle, CheckCircle2, AlertCircle, Copy, Loader2, ExternalLink } from "lucide-react";

interface Props {
  invoiceId: string;
  invoiceNumber: string | null;
  sriStatus: string;
  clientDocument: string;
  issueDate?: string | null; // "YYYY-MM-DD" o ISO string
  sriAccessKey: string;
}

export default function AnularFacturaButton({
  invoiceId,
  invoiceNumber,
  sriStatus,
  clientDocument,
  issueDate,
  sriAccessKey,
}: Props) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Determinar condiciones SRI
  const isSriValid = sriStatus === "authorized" || sriStatus === "submitted";
  const isConsumidorFinal = clientDocument === "9999999999999";

  // Calcular fecha límite (día 9 del mes siguiente)
  const getDeadlineInfo = () => {
    const rawDate = issueDate || new Date().toISOString().split("T")[0];
    const cleanDate = rawDate.includes("T") ? rawDate.split("T")[0] : rawDate;
    const parts = cleanDate.split("-").map(Number);
    
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1])) {
      return { passed: false, dateStr: "Día 9 del mes siguiente" };
    }
    
    const year = parts[0];
    const month = parts[1]; // 1-indexed (ej: 9 para septiembre)
    const limitDate = new Date(year, month, 9, 23, 59, 59, 999);
    const now = new Date();
    
    const months = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];
    const monthName = months[(month % 12)];
    const dateStr = `9 de ${monthName} de ${year}`;
    
    return {
      passed: now > limitDate,
      dateStr
    };
  };

  const deadline = getDeadlineInfo();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sriAccessKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error al copiar:", err);
    }
  };

  const handleAnnul = async (force: boolean = false) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/factura/anular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId, force }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (data.error === "deadline_passed") {
          setErrorMsg("deadline_passed");
        } else {
          throw new Error(data.error || "Error al anular la factura.");
        }
        return;
      }
      
      setSuccess(true);
      setTimeout(() => {
        setShowModal(false);
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setErrorMsg(null);
          setSuccess(false);
          setShowModal(true);
        }}
        className="flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 px-3.5 py-2 rounded-xl transition-all duration-250 shrink-0 shadow-sm"
      >
        <Trash2 size={14} /> Anular Factura
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="bg-white border border-lilac-100 rounded-3xl p-6 max-w-lg w-full mx-4 shadow-2xl relative animate-in zoom-in-95 duration-200">
            {/* Botón cerrar */}
            <button
              onClick={() => {
                if (!loading && !success) setShowModal(false);
              }}
              disabled={loading || success}
              className="absolute top-4 right-4 text-ink-400 hover:text-ink-900 transition-colors disabled:opacity-50"
            >
              <X size={18} />
            </button>

            {/* Encabezado */}
            <div className="flex items-center gap-3 mb-5 border-b border-lilac-50 pb-3">
              <div className="h-10 w-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink-900">
                  Anular Factura {invoiceNumber || "Borrador"}
                </h3>
                <p className="text-[11px] text-ink-500 font-mono">
                  ID: {invoiceId}
                </p>
              </div>
            </div>

            {/* Pantalla de Éxito */}
            {success ? (
              <div className="py-6 flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center text-green-600 mb-4 animate-bounce">
                  <CheckCircle2 size={36} />
                </div>
                <h4 className="text-lg font-bold text-ink-900 mb-1">¡Factura Anulada!</h4>
                <p className="text-xs text-ink-600">
                  La factura ha sido anulada con éxito localmente. Actualizando...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* ── CASO A: Consumidor Final Autorizado (BLOQUEO) ── */}
                {isSriValid && isConsumidorFinal && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 text-red-700">
                    <XCircleIcon className="shrink-0 text-red-600 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <p className="font-bold">Acción Bloqueada por SRI</p>
                      <p className="leading-relaxed">
                        El SRI prohíbe taxativamente la anulación o modificación de comprobantes electrónicos emitidos a <strong>Consumidor Final</strong> (RUC/Cédula 9999999999999) una vez autorizados.
                      </p>
                      <p className="leading-relaxed pt-1.5 opacity-90">
                        No es posible anular esta factura en el sistema.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── CASO B: Autorizada/Enviada dentro de plazo ── */}
                {isSriValid && !isConsumidorFinal && !deadline.passed && errorMsg !== "deadline_passed" && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-amber-800">
                      <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <p className="font-bold">Advertencia de Anulación con el SRI</p>
                        <p className="leading-relaxed">
                          Esta factura está autorizada por el SRI. Recuerde que <strong>debe ingresar manualmente al portal SRI en Línea</strong> para solicitar su anulación antes del día 9 del mes siguiente:
                        </p>
                        <p className="font-semibold pt-1">
                          Fecha límite en SRI: {deadline.dateStr}
                        </p>
                      </div>
                    </div>

                    {/* Clave de Acceso para el portal */}
                    <div className="bg-lilac-50/50 border border-lilac-100 rounded-2xl p-3.5 space-y-2">
                      <span className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block">
                        Clave de Acceso para SRI (49 dígitos)
                      </span>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono bg-white border border-lilac-200 rounded-xl px-3 py-2 break-all flex-1 text-ink-800 font-bold">
                          {sriAccessKey}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopy}
                          className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 ${
                            copied
                              ? "bg-green-600 text-white border-green-600"
                              : "bg-lilac-600 text-white border-lilac-600 hover:bg-lilac-700 shadow-sm"
                          }`}
                          title="Copiar clave de acceso"
                        >
                          {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                          {copied ? "¡Copiado!" : "Copiar Clave"}
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-ink-600 leading-relaxed pl-1 space-y-1 bg-slate-50 border border-slate-100 p-3.5 rounded-2xl">
                      <p className="font-bold text-ink-800">Efectos de la anulación local en el ERP:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>Se eliminarán los cobros en Caja General y Bancos vinculados a esta factura.</li>
                        <li>Se anulará el asiento contable en el Libro Diario (Libro Diario pasará a "void").</li>
                        <li>Se liberarán los módulos de cursos inscritos para poder volver a facturarse.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* ── CASO C: Autorizada fuera de plazo (ADVERTENCIA EXIGENCIA NOTA CRÉDITO) ── */}
                {isSriValid && !isConsumidorFinal && (deadline.passed || errorMsg === "deadline_passed") && (
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 text-red-800">
                      <AlertCircle size={18} className="shrink-0 text-red-600 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <p className="font-bold">Plazo Legal del SRI Vencido</p>
                        <p className="leading-relaxed">
                          El plazo del SRI para anular esta factura en línea venció el <strong>{deadline.dateStr}</strong>.
                        </p>
                        <p className="leading-relaxed pt-1 font-semibold text-red-700">
                          De acuerdo con la normativa tributaria, para anular el efecto fiscal de esta factura fuera de plazo se debe emitir una Nota de Crédito.
                        </p>
                        <p className="leading-relaxed pt-1.5 text-ink-700">
                          ¿Desea anularla localmente de todas formas para ajustar su contabilidad y flujo de caja en este sistema? (Esta acción no tendrá efecto en el SRI).
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── CASO D: Borradores/No autorizados ── */}
                {!isSriValid && (
                  <div className="bg-lilac-50 border border-lilac-200 rounded-2xl p-4 flex gap-3 text-lilac-800 text-xs">
                    <AlertCircle size={18} className="shrink-0 text-lilac-600 mt-0.5" />
                    <div>
                      <p className="font-bold">Factura sin Validez Fiscal</p>
                      <p className="leading-relaxed mt-0.5">
                        Esta factura no ha sido autorizada por el SRI (se encuentra en estado borrador, error o rechazo). No requiere anulación en el SRI.
                      </p>
                      <p className="leading-relaxed mt-1">
                        Al anular, se liberarán los ítems y registros contables/financieros en el ERP de inmediato.
                      </p>
                    </div>
                  </div>
                )}

                {/* Errores del API */}
                {errorMsg && errorMsg !== "deadline_passed" && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-3.5 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={15} />
                    {errorMsg}
                  </div>
                )}

                {/* Acciones */}
                <div className="flex gap-3 justify-end pt-3 border-t border-lilac-50 mt-4">
                  <button
                    onClick={() => setShowModal(false)}
                    disabled={loading}
                    className="btn-secondary px-5 py-2.5 rounded-xl text-xs font-semibold text-ink-700 bg-white border border-lilac-200 hover:bg-lilac-50 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>

                  {/* Renderizar botón adecuado según las condiciones */}
                  {!(isSriValid && isConsumidorFinal) && (
                    <button
                      onClick={() => {
                        const isForced = isSriValid && deadline.passed;
                        handleAnnul(isForced);
                      }}
                      disabled={loading}
                      className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition shadow-md shadow-red-200 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={13} className="animate-spin" /> Procesando...
                        </>
                      ) : isSriValid && deadline.passed ? (
                        "Forzar Anulación Local"
                      ) : (
                        "Confirmar Anulación"
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function XCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}
