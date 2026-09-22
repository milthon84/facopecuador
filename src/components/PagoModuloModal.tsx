"use client";

import { useState } from "react";
import { Receipt, FileX, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerNoFiscalModuleAction } from "@/app/(admin)/erp/cursos/actions";
import StandardModal from "@/components/StandardModal";

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
  const [confirmNoFiscal, setConfirmNoFiscal] = useState(false);
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

  const handleClose = () => {
    if (loadingNoFiscal) return;
    setOpen(false);
    setConfirmNoFiscal(false);
    setErrorMsg(null);
  };

  const handleNoFiscalModule = async () => {
    setLoadingNoFiscal(true);
    setErrorMsg(null);
    try {
      await registerNoFiscalModuleAction(moduleInscriptionId, courseId);
      setOpen(false);
      setConfirmNoFiscal(false);
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
        type="button"
        onClick={() => {
          setConfirmNoFiscal(false);
          setErrorMsg(null);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 bg-ink-900 hover:bg-ink-850 text-gold-400 hover:text-gold-300 border border-gold-500/40 hover:border-gold-400/70 text-[10px] font-bold py-1 px-3 rounded-xl shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
      >
        <Receipt size={12} className="text-gold-400" />
        <span>Facturar Módulo</span>
      </button>

      <StandardModal
        isOpen={open}
        onClose={handleClose}
        title="Cobro / Facturación de Módulo"
        subtitle={`${studentName} · ${moduleName}`}
        icon={<Receipt size={20} className="text-lilac-600" />}
        loading={loadingNoFiscal}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-600">
            Selecciona la modalidad de registro o facturación para este módulo:
          </p>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-xl">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {confirmNoFiscal ? (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <FileX size={16} className="text-amber-700 shrink-0" />
                <span>¿Confirmar registro sin comprobante fiscal?</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                ¿Confirmas registrar el módulo <strong>"{moduleName}"</strong> para <strong>{studentName}</strong> sin emitir comprobante fiscal ni factura electrónica SRI?
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200/60">
                <button
                  type="button"
                  onClick={() => setConfirmNoFiscal(false)}
                  disabled={loadingNoFiscal}
                  className="px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-amber-100 rounded-xl transition cursor-pointer"
                >
                  Volver atrás
                </button>
                <button
                  type="button"
                  onClick={handleNoFiscalModule}
                  disabled={loadingNoFiscal}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {loadingNoFiscal ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Registrando...</span>
                    </>
                  ) : (
                    <span>Confirmar Registro Sin Factura</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {/* OPCIÓN 1: FACTURA ELECTRÓNICA */}
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
                onClick={() => setConfirmNoFiscal(true)}
                className="group p-4 bg-amber-50/50 border border-amber-200 hover:border-amber-400 rounded-2xl shadow-2xs hover:shadow-md transition-all flex items-start gap-3 text-left w-full cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 shadow-xs mt-0.5 group-hover:scale-105 transition-transform">
                  <FileX size={18} />
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
          )}

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={loadingNoFiscal}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-700 bg-ink-100 hover:bg-ink-200 transition cursor-pointer disabled:opacity-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      </StandardModal>
    </>
  );
}
