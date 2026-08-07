"use client";

import { useState } from "react";
import { CreditCard, CheckCircle2, DollarSign, X, Layers, Award } from "lucide-react";
import Link from "next/link";

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
  firstModuleName,
  returnUrl = `/erp/cursos/${courseId}`,
}: Props) {
  const [open, setOpen] = useState(false);

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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-amber-50/90 text-amber-800 border border-amber-300/80 hover:bg-amber-100 hover:border-amber-400 hover:text-amber-900 transition-all shadow-2xs cursor-pointer active:scale-95"
      >
        <CreditCard size={12} className="text-amber-600" />
        <span>Pendiente Pago</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-lilac-200 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-lilac-100 bg-lilac-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm font-bold">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-ink-950 text-sm">Opciones de Facturación</h3>
                  <p className="text-xs text-ink-500 line-clamp-1">{studentName} &middot; {courseName}</p>
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
                Selecciona la modalidad de pago para emitir el comprobante electrónico del alumno:
              </p>

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
