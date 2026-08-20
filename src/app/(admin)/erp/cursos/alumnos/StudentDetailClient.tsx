"use client";

import { useState, useRef } from "react";
import { 
  GraduationCap, Calendar, FileText, CheckCircle2, XCircle, AlertCircle, 
  Pencil, ArrowLeft, Users, DollarSign, ExternalLink, Camera, User, X, CreditCard, Receipt
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EnrollmentStatusSelector from "@/components/EnrollmentStatusSelector";
import PagoInscripcionModal from "@/components/PagoInscripcionModal";
import PagoModuloModal from "@/components/PagoModuloModal";

interface StudentDetailProps {
  student: any;
  enrollments: any[];
  attendance: any[];
  invoices: any[];
  availableCourses: any[];
  canEdit: boolean;
  editMode: boolean;
  updateStudentAction: (formData: FormData) => Promise<void>;
  enrollStudentAction: (formData: FormData) => Promise<void>;
  updateEnrollmentStatusAction: (formData: FormData) => Promise<void>;
}

const formatDateES = (d: string) => {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

export default function StudentDetailClient({
  student,
  enrollments,
  attendance,
  invoices,
  availableCourses,
  canEdit,
  editMode,
  updateStudentAction,
  enrollStudentAction,
  updateEnrollmentStatusAction,
}: StudentDetailProps) {
  const [activeTab, setActiveTab] = useState<"cursos" | "asistencia" | "facturas">("cursos");
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(editMode);
  const [loading, setLoading] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewPhotoUrl(URL.createObjectURL(file));
    }
  }

  // Asistencia calculada
  const presentCount = attendance.filter((a) => a.status === "present").length;
  const absentCount = attendance.filter((a) => a.status === "absent").length;
  const justifiedCount = attendance.filter((a) => a.status === "justified").length;

  // Total facturado
  const totalBilled = invoices
    .filter((inv) => inv.sri_status !== "cancelled")
    .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

  async function handleUpdateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await updateStudentAction(formData);
      setIsEditingModalOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-6">
      {/* Botón Volver */}
      <Link href="/erp/cursos/alumnos" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-600 hover:text-ink-900 transition-colors bg-white px-3.5 py-1.5 rounded-xl border border-lilac-100 shadow-2xs w-fit">
        <ArrowLeft size={14} />
        <span>Volver al Directorio de Alumnos</span>
      </Link>

      {/* Ficha Principal del Alumno & Tarjetas KPI */}
      <div className="grid md:grid-cols-3 gap-6 items-start">
        {/* Columna Izquierda: Ficha del Alumno */}
        <div className="md:col-span-1">
          <div className="card p-5 bg-white border border-lilac-100 shadow-sm rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-lilac-50 pb-2">
              <span className="text-xs font-bold text-ink-400 uppercase tracking-wider">Ficha de Alumno</span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsEditingModalOpen(true)}
                  className="text-xs text-lilac-600 hover:text-lilac-800 font-bold flex items-center gap-1 cursor-pointer bg-lilac-50 border border-lilac-200 px-2.5 py-1 rounded-xl transition"
                >
                  <Pencil size={12} />
                  <span>Editar Perfil</span>
                </button>
              )}
            </div>

            <div className="flex items-start gap-3">
              {/* Foto con lápiz overlay interactivo */}
              <div
                onClick={() => canEdit && setIsEditingModalOpen(true)}
                className={`relative group shrink-0 ${canEdit ? "cursor-pointer" : ""}`}
                title={canEdit ? "Haz clic para cambiar foto de perfil" : ""}
              >
                {student.photo_url ? (
                  <img
                    src={student.photo_url}
                    alt={student.full_name}
                    className="w-16 h-16 rounded-2xl object-cover border border-lilac-200 shadow-2xs transition group-hover:brightness-95"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-lilac-50 border border-lilac-200 flex items-center justify-center text-lilac-600 font-bold shrink-0 transition group-hover:bg-lilac-100">
                    <User size={28} />
                  </div>
                )}

                {canEdit && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-white border border-lilac-200 text-ink-700 shadow-xs flex items-center justify-center group-hover:bg-lilac-600 group-hover:text-white group-hover:border-lilac-600 transition-all">
                    <Pencil size={11} />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <h1 className="text-base font-bold text-ink-950 leading-snug">
                  {student.full_name}
                </h1>
              </div>
            </div>

            <div className="pt-3 border-t border-lilac-50 space-y-2 text-xs text-ink-700">
              <div className="flex justify-between items-center">
                <span className="text-ink-400 font-medium">Cédula / RUC:</span>
                <span className="font-mono font-bold text-ink-900">{student.document_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-ink-400 font-medium">Teléfono:</span>
                <span className="font-semibold text-ink-900">{student.phone}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-ink-400 font-medium">Correo:</span>
                <span className="font-semibold text-lilac-900 underline">{student.email}</span>
              </div>
            </div>

            {student.notes && (
              <div className="pt-2 border-t border-lilac-50">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Notas internas:</span>
                <p className="text-xs text-ink-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100 leading-relaxed">{student.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: KPI Cards & Matricular Rápido */}
        <div className="md:col-span-2 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 bg-lilac-50/50 border border-lilac-100 rounded-2xl flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-white border border-lilac-200 flex items-center justify-center text-lilac-600 shrink-0">
                <GraduationCap size={20} />
              </div>
              <div>
                <div className="text-xs text-ink-500 font-medium">Cursos Inscritos</div>
                <div className="text-xl font-bold text-ink-900 leading-tight">{enrollments.length}</div>
              </div>
            </div>

            <div className="card p-4 bg-green-50/40 border border-green-100 rounded-2xl flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-white border border-green-200 flex items-center justify-center text-green-600 shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div className="text-xs text-ink-500 font-medium">Asistencias</div>
                <div className="text-xl font-bold text-ink-900 leading-tight">{presentCount} <span className="text-xs font-normal text-ink-400">/ {attendance.length}</span></div>
              </div>
            </div>

            <div className="card p-4 bg-blue-50/40 border border-blue-100 rounded-2xl flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <FileText size={20} />
              </div>
              <div>
                <div className="text-xs text-ink-500 font-medium">Total Facturado</div>
                <div className="text-xl font-bold text-ink-900 leading-tight">${totalBilled.toLocaleString("es-EC", { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          {/* Matricular en nuevo curso */}
          {canEdit && availableCourses.length > 0 && (
            <div className="bg-white border border-lilac-100 p-4 rounded-2xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <GraduationCap size={18} className="text-lilac-600" />
                <span className="text-xs font-bold text-ink-900">Matricular Alumno en Nuevo Curso</span>
              </div>
              <form action={enrollStudentAction} className="flex items-center gap-2 flex-1 sm:flex-initial">
                <input type="hidden" name="studentId" value={student.id} />
                <select name="courseId" required className="input text-xs py-1.5 flex-1 sm:w-64">
                  <option value="">Selecciona un curso activo...</option>
                  {availableCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (${Number(c.total_cost).toLocaleString("es-EC", { minimumFractionDigits: 2 })})
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn-primary text-xs py-1.5 px-4 shadow-2xs shrink-0 cursor-pointer">
                  Matricular
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL UNIFICADO CON PESTAÑAS */}
      <div className="bg-white border border-lilac-100 rounded-3xl shadow-sm overflow-hidden">
        {/* Encabezado de Pestañas Integrado */}
        <div className="flex border-b border-lilac-100 bg-lilac-50/20 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("cursos")}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-xs rounded-t-2xl transition cursor-pointer ${
              activeTab === "cursos"
                ? "bg-white text-lilac-800 border-t-2 border-l border-r border-lilac-200 shadow-2xs -mb-px"
                : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
            }`}
          >
            <GraduationCap size={16} />
            <span>Cursos e Inscripciones ({enrollments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("asistencia")}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-xs rounded-t-2xl transition cursor-pointer ${
              activeTab === "asistencia"
                ? "bg-white text-lilac-800 border-t-2 border-l border-r border-lilac-200 shadow-2xs -mb-px"
                : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
            }`}
          >
            <Calendar size={16} />
            <span>Asistencia a Clases ({attendance.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("facturas")}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-xs rounded-t-2xl transition cursor-pointer ${
              activeTab === "facturas"
                ? "bg-white text-lilac-800 border-t-2 border-l border-r border-lilac-200 shadow-2xs -mb-px"
                : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
            }`}
          >
            <FileText size={16} />
            <span>Facturas Generadas ({invoices.length})</span>
          </button>
        </div>

        {/* Cuerpo de la Pestaña Activa */}
        <div className="p-6">
          {/* TAB 1: CURSOS */}
          {activeTab === "cursos" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {enrollments.length === 0 ? (
                <div className="p-10 text-center text-sm text-ink-500 italic bg-lilac-50/20 border border-lilac-100/60 rounded-2xl">
                  El alumno no está matriculado en ningún curso todavía.
                </div>
              ) : (
                enrollments.map((enroll: any) => {
                  const curso = enroll.cursos;
                  if (!curso) return null;

                  const sortedModules = [...(enroll.curso_modulo_inscripciones || [])].sort(
                    (a: any, b: any) => (a.curso_modulos?.number || 0) - (b.curso_modulos?.number || 0)
                  );

                  const isPaidFromModules = sortedModules.some((m: any) => m.billing_status === "invoiced");
                  const isPaidFromInvoice = (invoices || []).some((inv: any) => 
                    inv.sri_status !== "cancelled" && 
                    new Date(inv.created_at) >= new Date(new Date(enroll.created_at).getTime() - 120000)
                  );
                  const isPaidOrMatriculado = isPaidFromModules || isPaidFromInvoice || enroll.status === "completed";

                  return (
                    <div key={enroll.id} className="bg-white border border-lilac-100 rounded-2xl shadow-2xs overflow-hidden">
                      <div className="px-5 py-4 border-b border-lilac-50 bg-lilac-50/10 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <h3 className="font-bold text-ink-950 text-base">{curso.name}</h3>
                          <p className="text-xs text-ink-500">Inscrito el {formatDateES(enroll.created_at)}</p>
                        </div>

                        <div className="flex items-center gap-3">
                          {canEdit && (
                            <EnrollmentStatusSelector
                              enrollmentId={enroll.id}
                              studentId={student.id}
                              initialStatus={enroll.status}
                              isMatriculado={isPaidOrMatriculado}
                              action={updateEnrollmentStatusAction}
                            />
                          )}
                          <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            isPaidOrMatriculado || enroll.status === "completed"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : enroll.status === "dropped"
                              ? "bg-red-50 text-red-700 border-red-100"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {isPaidOrMatriculado || enroll.status === "completed" ? "Matriculado" :
                             enroll.status === "dropped" ? "Retirado" : "Inscrito"}
                          </span>

                          {!isPaidOrMatriculado && enroll.status !== "dropped" && canEdit && (
                            <PagoInscripcionModal
                              studentName={student.full_name}
                              studentDoc={student.document_number}
                              studentEmail={student.email}
                              studentPhone={student.phone}
                              courseId={curso.id}
                              courseName={curso.name}
                              courseTotalCost={Number(curso.total_cost)}
                              enrollmentId={enroll.id}
                              firstModuleCost={sortedModules[0]?.curso_modulos?.cost ? Number(sortedModules[0].curso_modulos.cost) : undefined}
                              firstModuleName={sortedModules[0]?.curso_modulos?.name}
                              returnUrl={`/erp/cursos/alumnos?id=${student.id}`}
                            />
                          )}
                        </div>
                      </div>

                      <div className="p-5 space-y-3">
                        <span className="text-xs font-semibold text-ink-600 block">Módulos del Curso y Estado de Pago:</span>

                        {sortedModules.length === 0 ? (
                          <p className="text-xs text-ink-400 italic">No hay módulos configurados para este curso.</p>
                        ) : (
                          <div className="grid sm:grid-cols-2 gap-3">
                            {sortedModules.map((mi: any) => {
                              const mod = mi.curso_modulos;
                              if (!mod) return null;

                              const prefName = encodeURIComponent(student.full_name);
                              const prefDoc = encodeURIComponent(student.document_number);
                              const prefEmail = encodeURIComponent(student.email);
                              const prefPhone = encodeURIComponent(student.phone);
                              const prefDesc = encodeURIComponent(`Pago Curso: ${curso.name} - Módulo ${mod.number}: ${mod.name}`);
                              const prefPrice = encodeURIComponent(mod.cost.toString());

                              const invoiceLink = `/erp/facturacion/nueva?client_name=${prefName}&client_document=${prefDoc}&client_email=${prefEmail}&client_phone=${prefPhone}&module_enrollment_ids=${mi.id}&item_description=${prefDesc}&item_price=${prefPrice}`;

                              return (
                                <div key={mi.id} className="p-3.5 bg-lilac-50/20 border border-lilac-100 rounded-xl flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-xs font-bold text-ink-950">
                                      Módulo {mod.number}: {mod.name}
                                    </div>
                                    <div className="text-[11px] text-ink-500 font-semibold mt-0.5">
                                      Costo: ${Number(mod.cost).toFixed(2)}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {(() => {
                                      const items = mi.invoices?.invoice_items || [];
                                      const isInscriptionInvoice = Array.isArray(items) && items.some((item: any) =>
                                        item.description?.toLowerCase().includes("inscripción") || item.description?.toLowerCase().includes("inscripcion")
                                      );
                                      const isFullCourse = enroll.payment_type === "full_course";
                                      const isModuleInvoiced = (isFullCourse || mi.billing_status === "invoiced") && !isInscriptionInvoice && mi.invoices?.sri_status !== "cancelled";

                                      if (isModuleInvoiced) {
                                        return (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-xl">
                                            <CheckCircle2 size={11} /> {isFullCourse ? "Pagado (Curso Completo)" : `Facturado (${mi.invoices?.invoice_number ? `#${mi.invoices.invoice_number}` : "OK"})`}
                                          </span>
                                        );
                                      } else if (mi.billing_status === "free") {
                                        return (
                                          <span className="text-[10px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-xl">
                                            Pagado SF
                                          </span>
                                        );
                                      } else {
                                        return (
                                          <>
                                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl">
                                              Pendiente
                                            </span>
                                            {canEdit && (
                                              <PagoModuloModal
                                                studentName={student.full_name}
                                                studentDoc={student.document_number}
                                                studentEmail={student.email}
                                                studentPhone={student.phone}
                                                moduleInscriptionId={mi.id}
                                                moduleName={`Módulo ${mod.number}: ${mod.name}`}
                                                moduleCost={Number(mod.cost)}
                                                courseId={curso.id}
                                                returnUrl={`/erp/cursos/alumnos?id=${student.id}`}
                                              />
                                            )}
                                          </>
                                        );
                                      }
                                    })()}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: ASISTENCIA */}
          {activeTab === "asistencia" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between bg-lilac-50/30 p-3.5 border border-lilac-100 rounded-2xl">
                <span className="text-xs font-bold text-ink-900">Resumen de Asistencias a Clases</span>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="text-green-700 bg-green-50 px-2.5 py-1 rounded-lg border border-green-200 flex items-center gap-1 text-[11px]">
                    <CheckCircle2 size={12} /> {presentCount} Presentes
                  </span>
                  <span className="text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200 flex items-center gap-1 text-[11px]">
                    <XCircle size={12} /> {absentCount} Ausentes
                  </span>
                  <span className="text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1 text-[11px]">
                    <AlertCircle size={12} /> {justifiedCount} Justificados
                  </span>
                </div>
              </div>

              {attendance.length === 0 ? (
                <div className="p-10 text-center text-sm text-ink-500 italic bg-lilac-50/20 border border-lilac-100/60 rounded-2xl">
                  No hay registros de asistencia a clases para este alumno.
                </div>
              ) : (
                <div className="border border-lilac-100 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-xs">
                    <thead className="bg-lilac-50/50 text-[10px] font-bold text-ink-500 uppercase tracking-wider border-b border-lilac-100">
                      <tr>
                        <th className="text-left px-5 py-3">Curso & Módulo</th>
                        <th className="text-left px-5 py-3">Clase / Tema</th>
                        <th className="text-left px-5 py-3">Fecha y Hora</th>
                        <th className="text-left px-5 py-3">Aula</th>
                        <th className="text-right px-5 py-3">Estado Asistencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-lilac-50">
                      {attendance.map((att: any) => {
                        const clase = att.curso_clases;
                        const mod = clase?.curso_modulos;
                        const curso = mod?.cursos;

                        return (
                          <tr key={att.id} className="hover:bg-lilac-50/10">
                            <td className="px-5 py-3">
                              <div className="font-bold text-ink-950">{curso?.name || "Curso"}</div>
                              <div className="text-[10px] text-lilac-700 font-semibold">
                                Módulo {mod?.number}: {mod?.name}
                              </div>
                            </td>
                            <td className="px-5 py-3 font-semibold text-ink-900">
                              {clase?.title || "Sesión de Clase"}
                            </td>
                            <td className="px-5 py-3 text-ink-700">
                              <div className="font-medium">{clase?.date ? formatDateES(clase.date) : "-"}</div>
                              {clase?.start_time && (
                                <div className="text-[10px] text-ink-400 font-semibold">
                                  {clase.start_time} - {clase.end_time}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-3 text-ink-600 font-medium">
                              {clase?.classroom || "-"}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-xl border ${
                                att.status === "present" ? "bg-green-50 text-green-700 border-green-200" :
                                att.status === "absent" ? "bg-red-50 text-red-700 border-red-200" :
                                "bg-amber-50 text-amber-700 border-amber-200"
                              }`}>
                                {att.status === "present" ? <CheckCircle2 size={12} /> :
                                 att.status === "absent" ? <XCircle size={12} /> :
                                 <AlertCircle size={12} />}
                                <span>
                                  {att.status === "present" ? "Presente" :
                                   att.status === "absent" ? "Ausente" : "Justificado"}
                                </span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FACTURAS */}
          {activeTab === "facturas" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between bg-lilac-50/30 p-3.5 border border-lilac-100 rounded-2xl">
                <span className="text-xs font-bold text-ink-900">Comprobantes de Facturación Emitidos</span>
                <span className="text-xs font-bold text-lilac-800">
                  Total acumulado: ${totalBilled.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {invoices.length === 0 ? (
                <div className="p-10 text-center text-sm text-ink-500 italic bg-lilac-50/20 border border-lilac-100/60 rounded-2xl">
                  No hay facturas registradas a nombre de este alumno.
                </div>
              ) : (
                <div className="border border-lilac-100 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-xs">
                    <thead className="bg-lilac-50/50 text-[10px] font-bold text-ink-500 uppercase tracking-wider border-b border-lilac-100">
                      <tr>
                        <th className="text-left px-5 py-3">N° Factura</th>
                        <th className="text-left px-5 py-3">Fecha Emisión</th>
                        <th className="text-left px-5 py-3">Forma de Pago</th>
                        <th className="text-left px-5 py-3">Monto Total</th>
                        <th className="text-left px-5 py-3">Estado SRI</th>
                        <th className="text-right px-5 py-3">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-lilac-50">
                      {invoices.map((inv: any) => {
                        const isAuthorized = inv.sri_status === "authorized";
                        const isCancelled = inv.sri_status === "cancelled";

                        return (
                          <tr key={inv.id} className="hover:bg-lilac-50/10">
                            <td className="px-5 py-3 font-mono font-bold text-ink-950">
                              {inv.invoice_number}
                            </td>
                            <td className="px-5 py-3 text-ink-700">
                              {inv.issue_date ? formatDateES(inv.issue_date) : "-"}
                            </td>
                            <td className="px-5 py-3 text-ink-700 capitalize font-medium">
                              {inv.payment_method || "Efectivo"}
                            </td>
                            <td className="px-5 py-3 font-bold text-ink-950 text-sm">
                              ${Number(inv.total).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                isAuthorized ? "bg-green-50 text-green-700 border-green-200" :
                                isCancelled ? "bg-red-50 text-red-700 border-red-200" :
                                "bg-amber-50 text-amber-700 border-amber-200"
                              }`}>
                                {isAuthorized ? "Autorizado" : isCancelled ? "Anulada" : "Pendiente"}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <Link
                                href={`/erp/facturacion/facturas?search=${inv.invoice_number}`}
                                className="inline-flex items-center gap-1 text-lilac-700 hover:text-lilac-900 font-bold text-xs"
                              >
                                <span>Ver Factura</span>
                                <ExternalLink size={12} />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL POPUP PARA EDITAR ALUMNO */}
      {isEditingModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-lilac-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-lilac-100 flex items-center justify-between bg-lilac-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center font-bold">
                  <Pencil size={16} />
                </div>
                <h3 className="font-bold text-ink-950 text-base">Editar Perfil del Alumno</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditingModalOpen(false);
                  setPreviewPhotoUrl(null);
                }}
                className="text-ink-400 hover:text-ink-700 p-1.5 rounded-lg transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleUpdateSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              <input type="hidden" name="id" value={student.id} />
              <input type="hidden" name="existingPhotoUrl" value={student.photo_url || ""} />

              {/* Avatar Interactivo de Edición de Foto */}
              <div className="flex flex-col items-center justify-center py-2 space-y-1.5">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-lilac-200 shadow-md bg-lilac-50 flex items-center justify-center">
                    {previewPhotoUrl || student.photo_url ? (
                      <img
                        src={previewPhotoUrl || student.photo_url}
                        alt={student.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-lilac-100 flex items-center justify-center text-lilac-600 font-bold text-2xl">
                        {student.full_name?.charAt(0).toUpperCase() || <User size={36} />}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white flex items-center justify-center shadow-md border-2 border-white transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    title="Cambiar foto de perfil"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
                <p className="text-[11px] text-ink-500 font-medium">Haz clic en el lápiz para seleccionar una nueva foto</p>
                <input
                  ref={fileInputRef}
                  name="photoFile"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">Nombre completo *</label>
                <input name="fullName" defaultValue={student.full_name} required className="input text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">Identificación (Cédula/RUC) *</label>
                  <input name="documentNumber" defaultValue={student.document_number} required className="input text-xs font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">Teléfono *</label>
                  <input name="phone" defaultValue={student.phone} required className="input text-xs" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">Correo electrónico *</label>
                <input name="email" type="email" defaultValue={student.email} required className="input text-xs" />
              </div>



              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">Notas internas</label>
                <textarea name="notes" rows={2} defaultValue={student.notes || ""} className="input text-xs resize-none" />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-lilac-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingModalOpen(false)}
                  className="btn-secondary text-xs px-4 py-2 cursor-pointer"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary text-xs px-5 py-2 shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
