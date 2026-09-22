import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { 
  GraduationCap, Calendar, Users, DollarSign, ArrowLeft, 
  Settings, Award, BookOpen, Plus, Trash2, UserPlus, UserMinus, 
  CheckCircle2, Pencil, UserCheck, CreditCard, Info 
} from "lucide-react";
import Link from "next/link";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { updateExpiredCourses } from "@/lib/courses";
import EditModuleModal from "@/components/EditModuleModal";
import CopyCourseButton from "@/components/CopyCourseButton";
import AttendanceListModal from "@/components/AttendanceListModal";
import EditCourseModal from "@/components/EditCourseModal";
import EnrollStudentModal from "@/components/EnrollStudentModal";
import PagoInscripcionModal from "@/components/PagoInscripcionModal";
import TeacherMultiSelect from "@/components/TeacherMultiSelect";
import CreateModuleModal from "@/components/CreateModuleModal";

import CourseStatusSelector from "@/components/CourseStatusSelector";

export const dynamic = "force-dynamic";

// --- Server Actions ---

async function saveGeneralInfo(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  await assertWritePermission("/erp/cursos");

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const totalCost = Number(formData.get("totalCost"));
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const maxStudents = formData.get("maxStudents") ? Number(formData.get("maxStudents")) : null;
  const status = formData.get("status") as string;
  const imageUrl = (formData.get("imageUrl") as string)?.trim();

  if (!id || !name || isNaN(totalCost) || !startDate || !endDate) return;

  const updatePayload: any = {
    name,
    description: description || null,
    total_cost: totalCost,
    start_date: startDate,
    end_date: endDate,
    max_students: maxStudents,
    image_url: imageUrl || null,
    updated_at: new Date().toISOString(),
  };

  if (status) {
    updatePayload.status = status;
  }

  const supabase = createAdminClient();
  await supabase
    .from("cursos")
    .update(updatePayload)
    .eq("id", id);

  revalidatePath(`/erp/cursos/${id}`);
}

async function deleteModule(formData: FormData) {
  "use server";
  const courseId = formData.get("courseId") as string;
  const moduleId = formData.get("moduleId") as string;
  await assertWritePermission("/erp/cursos");

  const supabase = createAdminClient();
  await supabase.from("curso_modulos").delete().eq("id", moduleId);

  revalidatePath(`/erp/cursos/${courseId}`);
}

async function assignTeacher(formData: FormData) {
  "use server";
  const courseId = formData.get("courseId") as string;
  await assertWritePermission("/erp/cursos");

  const teacherId = formData.get("teacherId") as string;
  const role = formData.get("role") as string;

  if (!courseId || !teacherId) return;

  const supabase = createAdminClient();
  await supabase.from("curso_profesores").insert({
    course_id: courseId,
    teacher_id: teacherId,
    role: role || "principal",
  });

  revalidatePath(`/erp/cursos/${courseId}`);
}

async function removeTeacher(formData: FormData) {
  "use server";
  const courseId = formData.get("courseId") as string;
  const teacherId = formData.get("teacherId") as string;
  await assertWritePermission("/erp/cursos");

  const supabase = createAdminClient();
  await supabase
    .from("curso_profesores")
    .delete()
    .eq("course_id", courseId)
    .eq("teacher_id", teacherId);

  revalidatePath(`/erp/cursos/${courseId}`);
}

export default async function CursoDetallePage({
  params,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParamsPromise;
  await assertPermission("/erp/cursos");
  const canEdit = await hasWritePermission("/erp/cursos");
  const supabase = createAdminClient();

  // Auto-completar cursos expirados en segundo plano sin bloquear la carga inicial
  updateExpiredCourses(supabase).catch(() => {});

  // Cargar todos los datos requeridos en paralelo optimizados por id de curso
  const [courseRes, modulesRes, assignedTeachersRes, allTeachersRes, studentsRes, allStudentsRes] = await Promise.all([
    supabase.from("cursos").select("*").eq("id", id).single(),
    supabase.from("curso_modulos").select("*, modulo_profesores(module_id, teacher_id, profesores(id, full_name, specialty))").eq("course_id", id).order("number"),
    supabase.from("curso_profesores").select("role, profesores(*)").eq("course_id", id),
    supabase.from("profesores").select("id, full_name, specialty").order("full_name"),
    supabase.from("curso_inscripciones").select("id, status, created_at, alumnos(*), curso_modulo_inscripciones(id, billing_status)").eq("course_id", id).order("created_at", { ascending: false }),
    supabase.from("alumnos").select("id, full_name, document_number, phone, email").order("full_name"),
  ]);

  const course = courseRes.data;
  if (!course) return redirect("/erp/cursos");

  const students = studentsRes.data || [];
  const studentDocs = students.map((e: any) => e.alumnos?.document_number?.trim()).filter(Boolean);

  // Cargar facturas de forma filtrada únicamente para las cédulas de los alumnos inscritos
  let courseInvoices: any[] = [];
  if (studentDocs.length > 0) {
    const { data: invData } = await supabase
      .from("invoices")
      .select("client_document, created_at, sri_status, invoice_number")
      .neq("sri_status", "cancelled")
      .in("client_document", studentDocs)
      .order("created_at", { ascending: false });
    courseInvoices = invData || [];
  }

  // Si el curso está en borrador, la pestaña por defecto es 'modulos'; si está abierto/en ejecución, es 'alumnos'
  const defaultTab = course.status === "draft" ? "modulos" : "alumnos";
  const activeTab = tab ?? defaultTab;

  const modules = modulesRes.data || [];
  const assignedTeachers = assignedTeachersRes.data || [];
  const allTeachers = allTeachersRes.data || [];
  const allStudents = allStudentsRes.data || [];

  const enrolledStudentIds = students.map((e: any) => e.alumnos?.id).filter(Boolean);

  // Filtrar profesores no asignados para el select
  const assignedTeacherIds = new Set(assignedTeachers.map((at: any) => at.profesores?.id));
  const unassignedTeachers = allTeachers.filter(t => !assignedTeacherIds.has(t.id));

  // Formatear fechas
  const formatDateES = (d: string) => {
    return new Date(d + "T12:00:00").toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  const tabs = [
    { id: "modulos", label: `Módulos (${modules.length})`, icon: <BookOpen size={16} /> },
    { id: "alumnos", label: `Alumnos Matriculados (${students.length})`, icon: <Users size={16} /> },
  ];

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <Link href="/erp/cursos" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-600 hover:text-lilac-700 mb-4 transition-colors">
        <ArrowLeft size={15} /> Volver al Catálogo de Cursos
      </Link>

      {/* Info Banner Mejorado */}
      <div className="bg-white border border-lilac-100 rounded-3xl p-6 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4.5">
          {course.image_url ? (
            <img 
              src={course.image_url} 
              alt={course.name} 
              className="w-18 h-18 sm:w-20 sm:h-20 object-cover rounded-2xl border border-lilac-200 shadow-xs shrink-0" 
            />
          ) : (
            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-lilac-50 border border-lilac-200 text-lilac-700 flex items-center justify-center shrink-0 shadow-2xs">
              <GraduationCap size={32} />
            </div>
          )}
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-ink-950 tracking-tight">{course.name}</h1>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Calendar size={14} className="text-lilac-600 shrink-0" />
                Del {formatDateES(course.start_date)} al {formatDateES(course.end_date)}
              </span>

              <span className="flex items-center gap-1.5 font-medium">
                <Users size={14} className="text-lilac-600 shrink-0" />
                {students.length} {course.max_students ? `/ ${course.max_students}` : ""} matriculados
              </span>

              <div className="flex items-center gap-1 font-bold text-lilac-800 text-sm sm:text-base">
                <DollarSign size={15} className="text-lilac-600 shrink-0" />
                <span>{Number(course.total_cost).toLocaleString("es-EC", { minimumFractionDigits: 2 })}</span>
                <span className="text-[10px] font-normal text-ink-400">USD</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-lilac-100">
          <CourseStatusSelector
            courseId={id}
            currentStatus={course.status}
            canEdit={canEdit}
          />

          {canEdit && (
            <div className="flex items-center gap-2">
              <EditCourseModal course={course} />
              <CopyCourseButton courseId={id} courseName={course.name} />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-lilac-100 mb-6 gap-1 overflow-x-auto pb-px">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/erp/cursos/${id}?tab=${t.id}`}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap -mb-px ${
              activeTab === t.id
                ? "border-lilac-600 text-lilac-700 bg-lilac-50/50 shadow-2xs"
                : "border-transparent text-ink-600 hover:text-ink-900 hover:bg-lilac-50/20"
            }`}
          >
            {t.icon}
            {t.label}
          </Link>
        ))}
      </div>

      {/* Tab Contents */}
      <div>
        {activeTab === "modulos" && (
          <div className="space-y-6">
            {/* Encabezado superior de módulos con botón Nuevo Módulo */}
            <div className="bg-white border border-lilac-100 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-ink-950">Módulos del Programa</h2>
                  <span className="text-xs text-lilac-700 bg-lilac-50 border border-lilac-200/80 px-2.5 py-0.5 rounded-full font-bold">
                    {modules.length} {modules.length === 1 ? "módulo" : "módulos"}
                  </span>
                </div>
                <p className="text-xs text-ink-500 mt-1">
                  Estructura académica, cronograma de sesiones y docentes asignados a cada módulo.
                </p>
              </div>

              {canEdit && (
                <CreateModuleModal
                  courseId={id}
                  allTeachers={allTeachers}
                  buttonText="Nuevo Módulo"
                />
              )}
            </div>

            {/* Listado de Módulos */}
            {modules.length === 0 ? (
              <div className="bg-white border border-dashed border-lilac-200 rounded-3xl p-12 text-center shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-lilac-50 text-lilac-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <BookOpen size={28} />
                </div>
                <h3 className="text-base font-bold text-ink-900 mb-1">No hay módulos configurados</h3>
                <p className="text-xs text-ink-500 max-w-md mx-auto mb-6">
                  Organiza el plan de estudios agregando los módulos con sus respectivas fechas de clases, costos y docentes asignados.
                </p>
                {canEdit && (
                  <CreateModuleModal
                    courseId={id}
                    allTeachers={allTeachers}
                    buttonText="Añadir Primer Módulo"
                    variant="empty_state"
                  />
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modules.map((m: any) => {
                  const mTeachers = m.modulo_profesores || [];
                  const mTeacherIds = mTeachers.map((mt: any) => mt.teacher_id);
                  const moduleNum = String(m.number || 1).padStart(2, "0");

                  return (
                    <div
                      key={m.id}
                      className="bg-white border border-lilac-100 hover:border-lilac-300 rounded-2xl p-4 sm:p-4.5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between gap-3 group relative"
                    >
                      {/* Cabecera de Tarjeta: Número con Globo/Tooltip + Título y Costo */}
                      <div className="flex items-start gap-3">
                        {/* Indicador de Número de Módulo con Globo / Tooltip */}
                        <div className="relative group/badge shrink-0">
                          <div
                            className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center shadow-2xs transition-all select-none ${
                              m.description
                                ? "bg-lilac-50 border border-lilac-200 text-lilac-800 group-hover:bg-lilac-600 group-hover:text-white cursor-help"
                                : "bg-lilac-50/70 border border-lilac-200 text-lilac-700 cursor-default"
                            }`}
                            title={m.description ? undefined : "Sin descripción"}
                          >
                            <span className="text-[9px] font-bold uppercase tracking-wider leading-none">Mód</span>
                            <span className="text-sm font-black leading-tight">{moduleNum}</span>
                          </div>

                          {/* Indicador sutil de que tiene descripción */}
                          {m.description && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-lilac-500 rounded-full ring-2 ring-white" />
                          )}

                          {/* Globo Flotante con Descripción */}
                          {m.description && (
                            <div className="absolute left-0 top-full mt-2 hidden group-hover/badge:block z-50 w-72 sm:w-80 p-3.5 bg-ink-950 text-white rounded-2xl shadow-2xl border border-white/10 pointer-events-none transition-all">
                              <div className="absolute -top-1.5 left-4 w-3 h-3 bg-ink-950 border-t border-l border-white/10 rotate-45" />
                              <div className="flex items-center gap-1.5 font-bold text-lilac-300 text-[10px] uppercase tracking-wider mb-1">
                                <Info size={12} className="text-lilac-400 shrink-0" />
                                <span>Descripción del Módulo {m.number}</span>
                              </div>
                              <p className="text-ink-200 text-xs leading-relaxed font-normal">
                                {m.description}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Título y Costo */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-1.5">
                            <h3 className="font-bold text-ink-950 text-sm leading-snug line-clamp-2" title={m.name}>
                              {m.name}
                            </h3>
                            <span className="inline-flex items-center text-xs font-bold text-lilac-800 bg-lilac-50 border border-lilac-200 px-2 py-0.5 rounded-lg shrink-0">
                              ${Number(m.cost).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          {/* Meta: Fechas y Docentes */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
                            {m.start_date ? (
                              <span className="inline-flex items-center gap-1 font-medium text-ink-700 bg-lilac-50/60 px-2 py-0.5 rounded-lg border border-lilac-100/60 text-[11px]">
                                <Calendar size={12} className="text-lilac-600 shrink-0" />
                                <span>Clase: <strong>{formatDateES(m.start_date)}</strong></span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-ink-400 text-[11px] italic">
                                <Calendar size={11} className="text-ink-300 shrink-0" /> Fecha por definir
                              </span>
                            )}

                            <div className="flex flex-wrap items-center gap-1">
                              <span className="font-semibold text-ink-600 flex items-center gap-1 text-[11px]">
                                <UserCheck size={12} className="text-lilac-600 shrink-0" /> Docentes:
                              </span>
                              {mTeachers.length === 0 ? (
                                <span className="text-ink-400 text-[11px] italic">Sin asignar</span>
                              ) : (
                                mTeachers.map((mt: any) => (
                                  <span
                                    key={mt.teacher_id}
                                    className="bg-lilac-50 text-lilac-900 border border-lilac-200/80 px-2 py-0.5 rounded-md font-bold text-[10px] inline-flex items-center"
                                  >
                                    {mt.profesores?.full_name}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pie de Tarjeta: Asistencia & Pagos a la izquierda, Editar/Eliminar a la derecha */}
                      <div className="pt-2.5 border-t border-lilac-100/60 flex items-center justify-between gap-2 mt-auto">
                        <AttendanceListModal
                          moduleId={m.id}
                          moduleName={m.name}
                          moduleNumber={m.number}
                        />

                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <EditModuleModal
                              module={m}
                              allTeachers={allTeachers}
                              assignedTeacherIds={mTeacherIds}
                            />
                            <ConfirmDeleteButton
                              action={deleteModule}
                              idName="moduleId"
                              idValue={m.id}
                              extraFields={{ courseId: id }}
                              confirmMessage="¿Estás seguro de que deseas eliminar este módulo del programa?"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "alumnos" && (
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-lilac-50 bg-lilac-50/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-ink-800">Alumnos matriculados</span>
                <span className="text-xs text-ink-400 bg-lilac-50 px-2.5 py-0.5 rounded-full font-bold">
                  {students.length} alumnos
                </span>
              </div>

              {canEdit && (
                <EnrollStudentModal
                  courseId={id}
                  courseName={course.name}
                  allStudents={allStudents}
                  enrolledStudentIds={enrolledStudentIds}
                />
              )}
            </div>

            {students.length === 0 ? (
              <div className="p-10 text-center text-sm text-ink-500 italic">
                Aún no hay alumnos matriculados en este curso.
                <div className="mt-2 text-xs font-normal">Puedes matricular alumnos en la sección de <Link href="/erp/cursos/alumnos" className="text-lilac-700 hover:underline">Alumnos</Link>.</div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-lilac-50/50 text-[10px] font-bold text-ink-500 uppercase tracking-wider border-b border-lilac-100">
                  <tr>
                    <th className="text-left px-5 py-3">Nombre</th>
                    <th className="text-left px-5 py-3">Documento</th>
                    <th className="text-left px-5 py-3">Email / Teléfono</th>
                    <th className="text-right px-5 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lilac-50">
                  {students.map((e: any) => {
                    const student = e.alumnos;
                    if (!student) return null;

                    const modInscriptions = e.curso_modulo_inscripciones || [];
                    const isNoFiscal = e.payment_type === "no_fiscal" || modInscriptions.some((m: any) => m.billing_status === "free");
                    const isPaidFromModules = modInscriptions.some((m: any) => m.billing_status === "invoiced") || e.payment_type === "full_course";
                    const matchedInvoice = courseInvoices.find((inv: any) => 
                      inv.client_document && 
                      student.document_number && 
                      inv.client_document.trim() === student.document_number.trim() && 
                      inv.invoice_items?.some((item: any) => item.description?.toLowerCase().includes(course.name.toLowerCase()))
                    );
                    const isPaidFromInvoice = !!matchedInvoice;
                    const paidInvoiceNumber = matchedInvoice?.invoice_number ||
                      modInscriptions.find((m: any) => m.billing_status === "invoiced")?.invoices?.invoice_number || null;
                    const isPaidOrMatriculado = isPaidFromModules || isPaidFromInvoice || isNoFiscal || e.status === "completed";

                    return (
                      <tr key={student.id} className="hover:bg-lilac-50/10">
                        <td className="px-5 py-3.5">
                          <Link href={`/erp/cursos/alumnos?id=${student.id}`} className="font-bold text-ink-900 hover:text-lilac-700">
                            {student.full_name}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-ink-700 text-xs">
                          {student.document_number}
                        </td>
                        <td className="px-5 py-3.5 text-xs space-y-0.5">
                          <div className="text-ink-800">{student.email}</div>
                          <div className="text-ink-500">{student.phone}</div>
                        </td>
                        <td className="px-5 py-3.5 text-right flex items-center justify-end gap-2">
                          {isNoFiscal ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-indigo-300 bg-indigo-50/90 text-indigo-900 shadow-2xs w-fit whitespace-nowrap">
                              <CheckCircle2 size={13} className="text-indigo-600" />
                              <span>Matriculado (Sin Factura)</span>
                            </div>
                          ) : isPaidOrMatriculado || e.status === "completed" ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-green-200 bg-green-50 text-green-700 shadow-sm w-fit whitespace-nowrap">
                              <CheckCircle2 size={13} className="text-green-600" />
                              <span>Matriculado{paidInvoiceNumber ? ` — № ${paidInvoiceNumber}` : ""}</span>
                            </div>
                          ) : e.status === "dropped" ? (
                            <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-100">
                              Retirado
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                              Inscrito
                            </span>
                          )}

                          {!isPaidOrMatriculado && e.status !== "dropped" && canEdit && (
                            <PagoInscripcionModal
                              studentName={student.full_name}
                              studentDoc={student.document_number}
                              studentEmail={student.email}
                              studentPhone={student.phone}
                              courseId={course.id}
                              courseName={course.name}
                              courseTotalCost={Number(course.total_cost)}
                              enrollmentId={e.id}
                              firstModuleCost={modules[0]?.cost ? Number(modules[0].cost) : undefined}
                              firstModuleName={modules[0]?.name}
                              returnUrl={`/erp/cursos/${course.id}?tab=alumnos`}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
