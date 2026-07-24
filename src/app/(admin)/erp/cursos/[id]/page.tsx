import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { 
  GraduationCap, Calendar, Users, DollarSign, ArrowLeft, 
  Settings, Award, BookOpen, Plus, Trash2, UserPlus, UserMinus, 
  CheckCircle2, Pencil 
} from "lucide-react";
import Link from "next/link";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { updateExpiredCourses } from "@/lib/courses";
import EditModuleModal from "@/components/EditModuleModal";
import CopyCourseButton from "@/components/CopyCourseButton";

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
  const imageFile = formData.get("imageFile") as File;

  if (!id || !name || !startDate || !endDate || isNaN(totalCost)) return;

  const supabase = createAdminClient();
  let imageUrl: string | undefined = undefined;

  if (imageFile && imageFile.size > 0) {
    try {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from("course-banners")
        .upload(fileName, buffer, {
          contentType: imageFile.type,
        });

      if (!uploadError) {
        const { data } = supabase.storage.from("course-banners").getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      } else {
        console.error("Error uploading banner:", uploadError.message);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const updatePayload: any = {
    name,
    description: description || null,
    total_cost: totalCost,
    start_date: startDate,
    end_date: endDate,
    max_students: maxStudents,
    status,
    updated_at: new Date().toISOString(),
  };

  if (imageUrl !== undefined) {
    updatePayload.image_url = imageUrl;
  }

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

  if (!courseId || !name || isNaN(number) || isNaN(cost)) return;

  const supabase = createAdminClient();
  await supabase.from("curso_modulos").insert({
    course_id: courseId,
    number,
    name,
    cost,
    description: description || null,
    start_date: date,
    end_date: date,
  });

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
  await assertPermission("/erp/cursos");
  const canEdit = await hasWritePermission("/erp/cursos");

  const { id } = await params;
  const searchParams = await searchParamsPromise;
  const activeTab = searchParams.tab ?? "modulos";

  const supabase = createAdminClient();

  // Auto-completar cursos expirados
  await updateExpiredCourses(supabase);

  // Cargar todos los datos requeridos en paralelo
  const [courseRes, modulesRes, assignedTeachersRes, allTeachersRes, studentsRes] = await Promise.all([
    supabase.from("cursos").select("*").eq("id", id).single(),
    supabase.from("curso_modulos").select("*").eq("course_id", id).order("number"),
    supabase.from("curso_profesores").select("role, profesores(*)").eq("course_id", id),
    supabase.from("profesores").select("id, full_name").order("full_name"),
    supabase.from("curso_inscripciones").select("status, created_at, alumnos(*)").eq("course_id", id).order("created_at", { ascending: false }),
  ]);

  const course = courseRes.data;
  if (!course) return redirect("/erp/cursos");

  const modules = modulesRes.data || [];
  const assignedTeachers = assignedTeachersRes.data || [];
  const allTeachers = allTeachersRes.data || [];
  const students = studentsRes.data || [];

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
    { id: "profesores", label: "Profesores", icon: <Award size={16} /> },
    { id: "alumnos", label: "Alumnos Matriculados", icon: <Users size={16} /> },
    { id: "info", label: "Información General", icon: <Settings size={16} /> },
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
              <Link
                href={`/erp/cursos/${id}?tab=info`}
                className="inline-flex items-center gap-1 bg-lilac-50 hover:bg-lilac-100 text-lilac-700 text-xs px-3 py-1.5 rounded-xl transition font-semibold border border-lilac-200"
              >
                <Pencil size={13} /> Editar Datos
              </Link>
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
                    {modules.map((m) => (
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
                          <div className="flex items-center gap-4 text-[11px] text-ink-500 pl-7">
                            {m.start_date && (
                              <span className="flex items-center gap-1 font-medium text-lilac-700 bg-lilac-50/60 px-2 py-0.5 rounded-lg border border-lilac-100/50">
                                <Calendar size={12} className="text-lilac-600" /> Fecha: {formatDateES(m.start_date)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-lilac-700 bg-lilac-50 px-2.5 py-1 rounded-xl">
                            ${Number(m.cost).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                          </span>
                          {canEdit && (
                            <div className="flex items-center gap-1">
                              <EditModuleModal module={m} />
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
                    ))}
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

        {activeTab === "profesores" && (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Listado de Docentes Asignados */}
            <div className="md:col-span-2 space-y-4">
              <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-lilac-50 bg-lilac-50/10 flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink-800">Profesores asignados al curso</span>
                  <span className="text-xs text-ink-400 bg-lilac-50 px-2.5 py-0.5 rounded-full font-bold">
                    {assignedTeachers.length} profesores
                  </span>
                </div>

                {assignedTeachers.length === 0 ? (
                  <div className="p-8 text-center text-sm text-ink-500 italic">No hay profesores asignados a este curso.</div>
                ) : (
                  <div className="divide-y divide-lilac-50">
                    {assignedTeachers.map((at: any) => {
                      const prof = at.profesores;
                      if (!prof) return null;
                      return (
                        <div key={prof.id} className="p-5 flex justify-between items-center gap-4 hover:bg-lilac-50/10 transition-colors">
                          <div className="space-y-1">
                            <h3 className="font-bold text-ink-950 text-sm">{prof.full_name}</h3>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                at.role === "principal" ? "bg-lilac-100 text-lilac-700 border-lilac-200" :
                                at.role === "auxiliar" ? "bg-blue-50 text-blue-700 border-blue-100" :
                                "bg-amber-50 text-amber-700 border-amber-100"
                              }`}>
                                {at.role === "principal" ? "Profesor Principal" :
                                 at.role === "auxiliar" ? "Auxiliar" : "Invitado Especial"}
                              </span>
                              {prof.specialty && (
                                <span className="text-[10px] text-ink-500 font-medium">({prof.specialty})</span>
                              )}
                            </div>
                          </div>

                          {canEdit && (
                            <form action={removeTeacher}>
                              <input type="hidden" name="courseId" value={id} />
                              <input type="hidden" name="teacherId" value={prof.id} />
                              <button
                                type="submit"
                                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition flex items-center gap-1 text-xs font-semibold"
                                title="Desasignar"
                              >
                                <UserMinus size={14} /> Desasignar
                              </button>
                            </form>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Asignar Docente */}
            <div className="md:col-span-1">
              {canEdit ? (
                <div className="card p-5 bg-white border border-lilac-100 shadow-sm">
                  <h2 className="text-sm font-bold text-ink-950 mb-4 flex items-center gap-1.5 pb-2 border-b border-lilac-50">
                    <UserPlus size={15} className="text-lilac-600" /> Asignar Profesor
                  </h2>
                  {unassignedTeachers.length === 0 ? (
                    <p className="text-xs text-ink-500 italic text-center py-4">Todos los profesores ya están asignados.</p>
                  ) : (
                    <form action={assignTeacher} className="space-y-4">
                      <input type="hidden" name="courseId" value={id} />
                      <div>
                        <label className="label text-ink-800">Seleccionar profesor *</label>
                        <select name="teacherId" required className="input text-xs">
                          <option value="">Selecciona un profesor...</option>
                          {unassignedTeachers.map((t) => (
                            <option key={t.id} value={t.id}>{t.full_name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label text-ink-800">Rol en el curso</label>
                        <select name="role" className="input text-xs">
                          <option value="principal">Profesor Principal</option>
                          <option value="auxiliar">Profesor Auxiliar</option>
                          <option value="invitado">Profesor Invitado</option>
                        </select>
                      </div>
                      <button type="submit" className="w-full btn-primary text-xs py-2.5 mt-2 shadow-sm">
                        Asignar al Curso
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="card p-5 bg-lilac-50/50 border border-lilac-100 text-center text-xs text-ink-500 italic">
                  No tienes permisos para asignar profesores.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "alumnos" && (
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-lilac-50 bg-lilac-50/10 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-800">Alumnos matriculados</span>
              <span className="text-xs text-ink-400 bg-lilac-50 px-2.5 py-0.5 rounded-full font-bold">
                {students.length} alumnos
              </span>
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

        {activeTab === "info" && (
          <div className="card p-6 bg-white border border-lilac-100 shadow-sm max-w-2xl">
            <h2 className="text-sm font-bold text-ink-950 mb-4 flex items-center gap-1.5 pb-2 border-b border-lilac-50">
              <Pencil size={15} className="text-gold-600" /> Editar Datos del Curso
            </h2>
            {canEdit ? (
              <form action={saveGeneralInfo} className="space-y-4">
                <input type="hidden" name="id" value={id} />
                <div>
                  <label className="label text-ink-800">Nombre del Curso *</label>
                  <input
                    name="name"
                    defaultValue={course.name}
                    required
                    placeholder="Ej: Diplomado en Implantología Oral Avanzada"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label text-ink-800">Descripción / Detalles</label>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={course.description || ""}
                    placeholder="Escribe detalles del curso, temarios generales, etc."
                    className="input resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label text-ink-800">Costo total ($) *</label>
                    <input
                      name="totalCost"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      defaultValue={course.total_cost}
                      placeholder="Ej: 1200.00"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label text-ink-800">Límite de alumnos</label>
                    <input
                      name="maxStudents"
                      type="number"
                      min="1"
                      defaultValue={course.max_students || ""}
                      placeholder="Ej: 20 (opcional)"
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label text-ink-800">Fecha de Inicio *</label>
                    <input
                      name="startDate"
                      type="date"
                      defaultValue={course.start_date}
                      required
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label text-ink-800">Fecha de Finalización *</label>
                    <input
                      name="endDate"
                      type="date"
                      defaultValue={course.end_date}
                      required
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="label text-ink-800">Estado del Curso</label>
                  <select name="status" defaultValue={course.status} className="input">
                    <option value="draft">Borrador (No visible en la web)</option>
                    <option value="active">Abierto (Abierto para inscripciones)</option>
                    <option value="in_progress">En Ejecución (Curso en desarrollo)</option>
                    <option value="completed">Finalizado (Terminado)</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-lilac-50">
                  <label className="label text-ink-800 font-semibold mb-2">Boceto o Portada del Curso (Imagen)</label>
                  {course.image_url && (
                    <div className="mb-3">
                      <div className="text-[10px] text-ink-500 font-bold mb-1">Imagen Actual:</div>
                      <img 
                        src={course.image_url} 
                        alt="Boceto actual" 
                        className="w-32 h-20 object-cover rounded-xl border border-lilac-200 shadow-sm"
                      />
                    </div>
                  )}
                  <input
                    name="imageFile"
                    type="file"
                    accept="image/*"
                    className="w-full text-xs text-ink-600 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-lilac-50 file:text-lilac-700 hover:file:bg-lilac-100 bg-white border border-lilac-200 rounded-xl p-1 focus:outline-none"
                  />
                  <p className="text-[10px] text-ink-400 mt-1">Sube una nueva imagen para cambiar o establecer el boceto de portada del curso.</p>
                </div>

                <button type="submit" className="w-full btn-primary text-sm py-3 mt-4 shadow-sm">
                  Guardar Datos Generales
                </button>
              </form>
            ) : (
              <div className="text-sm text-ink-500 italic text-center py-4">
                No tienes permisos de modificación para este curso.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
