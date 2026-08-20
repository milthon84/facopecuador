"use client";

import { useState } from "react";
import { Receipt, FileX, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerNoFiscalModuleAction } from "@/app/(admin)/erp/cursos/actions";

interface Props {
  studentName: string;
  studentDoc: string;
  studentEmail: string;
  studentPhone: string;
  moduleInscriptionId: string;
  moduleName: string;
  moduleCost: number;
  courseId?: string;
  returnUrl?: string;
}

export default function PagoModuloModal({
  studentName,
  studentDoc,
  studentEmail,
  studentPhone,
  moduleInscriptionId,
  moduleName,
  moduleCost,
  courseId,
  returnUrl,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingNoFiscal, setLoadingNoFiscal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const encodedName = encodeURIComponent(studentName);
  const encodedDoc = encodeURIComponent(studentDoc);
  const encodedEmail = encodeURIComponent(studentEmail);
  const encodedPhone = encodeURIComponent(studentPhone);
  const encodedDesc = encodeURIComponent(`Pago Módulo: ${moduleName}`);
  const encodedPrice = encodeURIComponent(moduleCost.toString());
  const encodedReturn = returnUrl ? encodeURIComponent(returnUrl) : "";

  const invoiceLink = `/erp/facturacion/nueva?client_name=${encodedName}&client_document=${encodedDoc}&client_email=${encodedEmail}&client_phone=${encodedPhone}&module_enrollment_ids=${moduleInscriptionId}&item_description=${encodedDesc}&item_price=${encodedPrice}${encodedReturn ? `&return_url=${encodedReturn}` : ""}`;

  const handleNoFiscalModule = async () => {
    if (!confirm(`¿Confirmas registrar el módulo "${moduleName}" para ${studentName} sin emitir comprobante fiscal / factura electrónica?`)) {
      return;
    }
    setLoadingNoFiscal(true);
    setErrorMsg(null);
    try {
      await registerNoFiscalModuleAction(moduleInscriptionId, courseId);
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al registrar el módulo sin comprobante.");
    } finally {
      setLoadingNoFiscal(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 bg-ink-900 hover:bg-ink-850 text-gold-400 hover:text-gold-300 border border-gold-500/40 hover:border-gold-400/70 text-[10px] font-bold py-1 px-3 rounded-xl shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
      >
        <Receipt size={12} className="text-gold-400" />
        <span>Facturar Módulo</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-lilac-200 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-lilac-100 bg-lilac-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-lilac-600 text-white flex items-center justify-center shadow-sm font-bold">
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-ink-950 text-sm">Cobro / Facturación de Módulo</h3>
                  <p className="text-xs text-ink-500 line-clamp-1">{studentName} &middot; {moduleName}</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-ink-400 hover:text-ink-700 hover:bg-lilac-100/50 rounded-xl transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-ink-600">
                Selecciona la modalidad de registro o facturación para este módulo:
              </p>

              {errorMsg && (
                <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-xl">
                  {errorMsg}
                </div>
              )}

              <div className="grid gap-3">
                {/* OPCIÓN 1: FACTURA ELECTRÓNICA CON COMPROBANTE FISCAL SRI */}
                <Link
                  href={invoiceLink}
                  onClick={() => setOpen(false)}
                  className="group p-4 bg-gradient-to-r from-lilac-50/80 to-purple-50/60 border border-lilac-200 hover:border-lilac-400 rounded-2xl shadow-2xs hover:shadow-md transition-all flex items-start gap-3 text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-lilac-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 group-hover:scale-105 transition-transform">
                    <Receipt size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-ink-950 text-xs group-hover:text-lilac-700 transition-colors">
                        Emitir Factura Electrónica (SRI)
                      </span>
                      <span className="text-xs font-bold text-lilac-700 bg-white px-2.5 py-0.5 rounded-lg border border-lilac-200 shadow-2xs">
                        ${Number(moduleCost).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-500 mt-1 leading-relaxed">
                      Genera la factura electrónica oficial con autorización del SRI para este módulo.
                    </p>
                  </div>
                </Link>

                {/* OPCIÓN 2: REGISTRO SIN COMPROBANTE FISCAL */}
                <button
                  type="button"
                  onClick={handleNoFiscalModule}
                  disabled={loadingNoFiscal}
                  className="group p-4 bg-amber-50/50 border border-amber-200 hover:border-amber-400 rounded-2xl shadow-2xs hover:shadow-md transition-all flex items-start gap-3 text-left w-full cursor-pointer disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 shadow-xs mt-0.5 group-hover:scale-105 transition-transform">
                    {loadingNoFiscal ? <Loader2 size={18} className="animate-spin" /> : <FileX size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-ink-950 text-xs group-hover:text-amber-900 transition-colors">
                        Módulo sin Comprobante Fiscal
                      </span>
                      <span className="text-[10px] font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                        Sin Factura
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-500 mt-1 leading-relaxed">
                      Registra el módulo como pagado / exonerado directamente sin emitir factura electrónica ni comprobante electrónico SRI (Beca / Exonerado / Cobro Externo).
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-lilac-50/30 border-t border-lilac-100 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-secondary text-xs py-1.5 px-4 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
