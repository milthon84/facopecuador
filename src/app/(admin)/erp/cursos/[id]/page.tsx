import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { 
  GraduationCap, Calendar, Users, DollarSign, ArrowLeft, 
  Settings, Award, BookOpen, Plus, Trash2, UserPlus, UserMinus, 
  CheckCircle2, Pencil, UserCheck 
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
import TeacherMultiSelect from "@/components/TeacherMultiSelect";

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

async function addModule(formData: FormData) {
  "use server";
  const courseId = formData.get("courseId") as string;
  await assertWritePermission("/erp/cursos");

  const name = (formData.get("name") as string)?.trim();
  const number = Number(formData.get("number"));
  const cost = Number(formData.get("cost"));
  const description = (formData.get("description") as string)?.trim();
  const date = (formData.get("date") as string) || null;
  const teacherIds = formData.getAll("teacherIds") as string[];

  if (!courseId || !name || isNaN(number) || isNaN(cost)) return;

  const supabase = createAdminClient();
  const { data: insertedMod, error } = await supabase
    .from("curso_modulos")
    .insert({
      course_id: courseId,
      number,
      name,
      cost,
      description: description || null,
      start_date: date,
      end_date: date,
    })
    .select("id")
    .single();

  if (!error && insertedMod && teacherIds.length > 0) {
    try {
      const modTeachers = teacherIds.map((tId) => ({
        module_id: insertedMod.id,
        teacher_id: tId,
      }));
      await supabase.from("modulo_profesores").insert(modTeachers);
    } catch (e: any) {
      console.error("[addModule] Error al guardar profesores:", e.message);
    }
  }

  revalidatePath(`/erp/cursos/${courseId}`);
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
  const activeTab = tab ?? "modulos";

  const supabase = createAdminClient();

  // Auto-completar cursos expirados
  await updateExpiredCourses(supabase);

  // Cargar todos los datos requeridos en paralelo
  const [courseRes, modulesRes, assignedTeachersRes, allTeachersRes, studentsRes, moduleTeachersRes, allStudentsRes] = await Promise.all([
    supabase.from("cursos").select("*").eq("id", id).single(),
    supabase.from("curso_modulos").select("*").eq("course_id", id).order("number"),
    supabase.from("curso_profesores").select("role, profesores(*)").eq("course_id", id),
    supabase.from("profesores").select("id, full_name, specialty").order("full_name"),
    supabase.from("curso_inscripciones").select("status, created_at, alumnos(*)").eq("course_id", id).order("created_at", { ascending: false }),
    supabase.from("modulo_profesores").select("module_id, teacher_id, profesores(id, full_name, specialty)"),
    supabase.from("alumnos").select("id, full_name, document_number, phone, email").order("full_name")
  ]);

  const course = courseRes.data;
  if (!course) return redirect("/erp/cursos");

  const modules = modulesRes.data || [];
  const assignedTeachers = assignedTeachersRes.data || [];
  const allTeachers = allTeachersRes.data || [];
  const students = studentsRes.data || [];
  const moduleTeachers = moduleTeachersRes.data || [];
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
    { id: "modulos", label: "Módulos", icon: <BookOpen size={16} /> },
    { id: "alumnos", label: "Alumnos Matriculados", icon: <Users size={16} /> },
  ];

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <Link href="/erp/cursos" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-4 transition-colors">
        <ArrowLeft size={16} /> Volver a Cursos
      </Link>

      {/* Info Banner */}
      <div className="card p-6 bg-white border border-lilac-100 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {course.image_url && (
            <img 
              src={course.image_url} 
              alt={course.name} 
              className="w-16 h-16 object-cover rounded-2xl border border-lilac-150 shadow-sm shrink-0" 
            />
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-ink-900">{course.name}</h1>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
              course.status === "active" ? "bg-green-50 text-green-700 border-green-200" :
              course.status === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" :
              course.status === "draft" ? "bg-gray-50 text-gray-600 border-gray-200" :
              course.status === "completed" ? "bg-lilac-50 text-lilac-700 border-lilac-200" :
              "bg-red-50 text-red-700 border-red-200"
            }`}>
              {course.status === "active" ? "Abierto" :
               course.status === "in_progress" ? "En Ejecución" :
               course.status === "draft" ? "Borrador" :
               course.status === "completed" ? "Finalizado" : "Cancelado"}
            </span>
          </div>
          <p className="text-xs text-ink-500">
            Del {formatDateES(course.start_date)} al {formatDateES(course.end_date)}
          </p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1 font-bold text-lilac-800 text-lg md:text-xl">
            <DollarSign size={18} className="text-lilac-600" />
            <span>{Number(course.total_cost).toLocaleString("es-EC", { minimumFractionDigits: 2 })}</span>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 border-l border-lilac-100 pl-3">
              <CopyCourseButton courseId={id} courseName={course.name} />
              <EditCourseModal course={course} />
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
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap -mb-px ${
              activeTab === t.id
                ? "border-lilac-600 text-lilac-700 bg-lilac-50/40"
                : "border-transparent text-ink-600 hover:text-ink-900 hover:bg-lilac-50/10"
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
          <div className="grid md:grid-cols-3 gap-6">
            {/* Listado de Módulos */}
            <div className="md:col-span-2 space-y-4">
              <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-lilac-50 bg-lilac-50/10 flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink-800">Módulos del programa</span>
                  <span className="text-xs text-ink-400 bg-lilac-50 px-2.5 py-0.5 rounded-full font-bold">
                    {modules.length} {modules.length === 1 ? "módulo" : "módulos"}
                  </span>
                </div>

                {modules.length === 0 ? (
                  <div className="p-8 text-center text-sm text-ink-500 italic">No hay módulos configurados para este curso.</div>
                ) : (
                  <div className="divide-y divide-lilac-50">
                    {modules.map((m) => {
                      const mTeachers = moduleTeachers.filter((mt: any) => mt.module_id === m.id);
                      const mTeacherIds = mTeachers.map((mt: any) => mt.teacher_id);

                      return (
                        <div key={m.id} className="p-5 flex justify-between items-start gap-4 hover:bg-lilac-50/10 transition-colors">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold bg-lilac-600 text-white w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                                {m.number}
                              </span>
                              <h3 className="font-bold text-ink-950 text-sm">{m.name}</h3>
                            </div>
                            {m.description && (
                              <p className="text-xs text-ink-600 leading-relaxed pl-7">{m.description}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-500 pl-7">
                              {m.start_date && (
                                <span className="flex items-center gap-1 font-medium text-lilac-700 bg-lilac-50/60 px-2 py-0.5 rounded-lg border border-lilac-100/50">
                                  <Calendar size={12} className="text-lilac-600" /> Fecha: {formatDateES(m.start_date)}
                                </span>
                              )}

                              <div className="flex flex-wrap items-center gap-1">
                                <span className="font-semibold text-ink-700 flex items-center gap-1">
                                  <UserCheck size={12} className="text-lilac-600" /> Docente(s):
                                </span>
                                {mTeachers.length === 0 ? (
                                  <span className="text-ink-400 italic">Sin asignar</span>
                                ) : (
                                  mTeachers.map((mt: any) => (
                                    <span key={mt.teacher_id} className="bg-lilac-50 text-lilac-900 border border-lilac-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                      {mt.profesores?.full_name}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <AttendanceListModal
                              moduleId={m.id}
                              moduleName={m.name}
                              moduleNumber={m.number}
                            />

                            <span className="text-xs font-bold text-lilac-700 bg-lilac-50 px-2.5 py-1 rounded-xl">
                              ${Number(m.cost).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                            </span>
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
                                  confirmMessage="¿Estás seguro de que deseas eliminar este módulo?"
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
            </div>

            {/* Crear Módulo */}
            <div className="md:col-span-1">
              {canEdit ? (
                <div className="card p-5 bg-white border border-lilac-100 shadow-sm">
                  <h2 className="text-sm font-bold text-ink-950 mb-4 flex items-center gap-1.5 pb-2 border-b border-lilac-50">
                    <Plus size={15} className="text-lilac-600" /> Añadir Módulo
                  </h2>
                  <form action={addModule} className="space-y-4">
                    <input type="hidden" name="courseId" value={id} />
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <label className="label text-ink-800">Número *</label>
                        <input
                          name="number"
                          type="number"
                          required
                          min="1"
                          defaultValue={modules.length + 1}
                          className="input"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="label text-ink-800">Costo ($) *</label>
                        <input
                          name="cost"
                          type="number"
                          step="0.01"
                          required
                          min="0"
                          placeholder="Ej: 200.00"
                          className="input"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label text-ink-800">Nombre del módulo *</label>
                      <input
                        name="name"
                        required
                        placeholder="Ej: Módulo I: Diagnóstico inicial"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label text-ink-800">Descripción</label>
                      <textarea
                        name="description"
                        rows={2}
                        placeholder="Breve descripción..."
                        className="input resize-none"
                      />
                    </div>
                    <div>
                      <label className="label text-ink-800 text-[11px] font-semibold">Fecha del módulo (Día de clases)</label>
                      <input name="date" type="date" className="input text-xs" />
                    </div>

                    {allTeachers.length > 0 && (
                      <div>
                        <label className="label text-ink-800 font-bold mb-1 block">Seleccionar Profesor(es)</label>
                        <TeacherMultiSelect
                          teachers={allTeachers}
                          placeholder="Seleccionar profesor(es)..."
                        />
                      </div>
                    )}

                    <button type="submit" className="w-full btn-primary text-xs py-2.5 mt-2 shadow-sm">
                      Agregar Módulo
                    </button>
                  </form>
                </div>
              ) : (
                <div className="card p-5 bg-lilac-50/50 border border-lilac-100 text-center text-xs text-ink-500 italic">
                  No tienes permisos para agregar módulos.
                </div>
              )}
            </div>
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
                    return (
                      <tr key={student.id} className="hover:bg-lilac-50/10">
                        <td className="px-5 py-3.5">
                          <Link href={`/erp/cursos/alumnos?id=${student.id}`} className="font-bold text-ink-900 hover:text-lilac-700">
                            {student.full_name}
                          </Link>
                          {student.professional_title && (
                            <div className="text-[10px] text-ink-500 font-medium">{student.professional_title}</div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-ink-700 text-xs">
                          {student.document_number}
                        </td>
                        <td className="px-5 py-3.5 text-xs space-y-0.5">
                          <div className="text-ink-800">{student.email}</div>
                          <div className="text-ink-500">{student.phone}</div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            e.status === "enrolled" ? "bg-green-50 text-green-700 border-green-200" :
                            e.status === "completed" ? "bg-lilac-50 text-lilac-700 border-lilac-200" :
                            "bg-red-50 text-red-700 border-red-100"
                          }`}>
                            {e.status === "enrolled" ? "Matriculado" :
                             e.status === "completed" ? "Finalizado" : "Retirado"}
                          </span>
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
