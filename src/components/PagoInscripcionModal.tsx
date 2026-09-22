"use client";

import { useState } from "react";
import { CreditCard, Award, Layers, FileX, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerNoFiscalEnrollmentAction } from "@/app/(admin)/erp/cursos/actions";
import StandardModal from "@/components/StandardModal";

interface Props {
  studentName: string;
  studentDoc: string;
  studentEmail: string;
  studentPhone: string;
  courseId: string;
  courseName: string;
  courseTotalCost: number;
  enrollmentId: string;
  firstModuleCost?: number;
  firstModuleName?: string;
  returnUrl?: string;
}

export default function PagoInscripcionModal({
  studentName,
  studentDoc,
  studentEmail,
  studentPhone,
  courseId,
  courseName,
  courseTotalCost,
  enrollmentId,
  firstModuleCost,
  returnUrl = `/erp/cursos/${courseId}`,
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
  const encodedReturn = encodeURIComponent(returnUrl);

  const fullPaymentPrice = courseTotalCost.toString();
  const partialPaymentPrice = (firstModuleCost || courseTotalCost).toString();

  const fullPaymentDesc = encodeURIComponent(`Pago Completo del Curso: ${courseName}`);
  const partialPaymentDesc = encodeURIComponent(`Pago Inscripción Curso: ${courseName}`);

  const fullPaymentLink = `/erp/facturacion/nueva?client_name=${encodedName}&client_document=${encodedDoc}&client_email=${encodedEmail}&client_phone=${encodedPhone}&course_enrollment_id=${enrollmentId}&full_course_payment=true&item_description=${fullPaymentDesc}&item_price=${fullPaymentPrice}&return_url=${encodedReturn}`;

  const partialPaymentLink = `/erp/facturacion/nueva?client_name=${encodedName}&client_document=${encodedDoc}&client_email=${encodedEmail}&client_phone=${encodedPhone}&course_enrollment_id=${enrollmentId}&item_description=${partialPaymentDesc}&item_price=${partialPaymentPrice}&return_url=${encodedReturn}`;

  const handleClose = () => {
    if (loadingNoFiscal) return;
    setOpen(false);
    setConfirmNoFiscal(false);
    setErrorMsg(null);
  };

  const executeNoFiscalRegister = async () => {
    setLoadingNoFiscal(true);
    setErrorMsg(null);
    try {
      await registerNoFiscalEnrollmentAction(enrollmentId, courseId);
      setOpen(false);
      setConfirmNoFiscal(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al registrar la inscripción sin comprobante.");
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
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-amber-50/90 text-amber-800 border border-amber-300/80 hover:bg-amber-100 hover:border-amber-400 hover:text-amber-900 transition-all shadow-2xs cursor-pointer active:scale-95"
      >
        <CreditCard size={12} className="text-amber-600" />
        <span>Pendiente Pago</span>
      </button>

      <StandardModal
        isOpen={open}
        onClose={handleClose}
        title="Opciones de Facturación / Registro"
        subtitle={`${studentName} · ${courseName}`}
        icon={<CreditCard size={20} className="text-amber-600" />}
        loading={loadingNoFiscal}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-600">
            Selecciona la modalidad de registro o cobro para el alumno:
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
                Se registrará a <strong>{studentName}</strong> directamente en el curso sin generar factura electrónica SRI. Útil para becas, exoneraciones o pagos realizados por canales externos.
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
                  onClick={executeNoFiscalRegister}
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
              {/* OPCIÓN 1: PAGO COMPLETO */}
              <Link
                href={fullPaymentLink}
                onClick={() => setOpen(false)}
                className="group p-4 bg-gradient-to-r from-lilac-50/80 to-purple-50/60 border border-lilac-200 hover:border-lilac-400 rounded-2xl shadow-2xs hover:shadow-md transition-all flex items-start gap-3 text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-lilac-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 group-hover:scale-105 transition-transform">
                  <Award size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-ink-950 text-xs group-hover:text-lilac-700 transition-colors">
                      Pago Completo del Curso
                    </span>
                    <span className="text-xs font-bold text-lilac-700 bg-white px-2.5 py-0.5 rounded-lg border border-lilac-200 shadow-2xs">
                      ${Number(courseTotalCost).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-500 mt-1 leading-relaxed">
                    Se facturará la totalidad del curso. Todos los módulos quedarán automáticamente pagados y no requerirán cobros durante el semestre.
                  </p>
                </div>
              </Link>

              {/* OPCIÓN 2: PAGO DE INSCRIPCIÓN */}
              <Link
                href={partialPaymentLink}
                onClick={() => setOpen(false)}
                className="group p-4 bg-white border border-gray-200 hover:border-gray-300 rounded-2xl shadow-2xs hover:shadow-md transition-all flex items-start gap-3 text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center shrink-0 shadow-xs mt-0.5 group-hover:scale-105 transition-transform">
                  <Layers size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-ink-950 text-xs group-hover:text-gray-900 transition-colors">
                      Pago de Inscripción
                    </span>
                    <span className="text-xs font-bold text-gray-800 bg-gray-50 px-2.5 py-0.5 rounded-lg border border-gray-200">
                      ${Number(firstModuleCost || courseTotalCost).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-500 mt-1 leading-relaxed">
                    Se facturará únicamente la cuota de inscripción al curso. Los módulos se facturarán progresivamente durante las clases.
                  </p>
                </div>
              </Link>

              {/* OPCIÓN 3: REGISTRO SIN COMPROBANTE FISCAL */}
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
                      Inscripción / Registro sin Comprobante Fiscal
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-lg border border-amber-300">
                      Sin Factura
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-500 mt-1 leading-relaxed">
                    Registra la inscripción del alumno en el curso directamente sin emitir factura ni comprobante electrónico SRI (Beca / Exonerado / Cobro Externo).
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
