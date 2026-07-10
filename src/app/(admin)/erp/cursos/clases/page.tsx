import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { 
  Presentation, Calendar, Clock, Plus, Trash2, ArrowLeft, 
  CheckCircle2, UserCheck, BookOpen, GraduationCap, CheckSquare, 
  MapPin, User 
} from "lucide-react";
import Link from "next/link";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";

export const dynamic = "force-dynamic";

// --- Server Actions ---

async function addClass(formData: FormData) {
  "use server";
  const courseId = formData.get("courseId") as string;
  const moduleId = formData.get("moduleId") as string;
  await assertWritePermission("/erp/cursos/clases");

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const date = formData.get("date") as string;
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const teacherId = formData.get("teacherId") as string || null;
  const classroom = (formData.get("classroom") as string)?.trim();

  if (!moduleId || !title || !date || !startTime || !endTime) return;

  const supabase = createAdminClient();
  await supabase.from("curso_clases").insert({
    module_id: moduleId,
    title,
    description: description || null,
    date,
    start_time: startTime,
    end_time: endTime,
    teacher_id: teacherId,
    classroom: classroom || null,
  });

  revalidatePath(`/erp/cursos/clases?course_id=${courseId}&module_id=${moduleId}`);
}

async function deleteClass(formData: FormData) {
  "use server";
  const courseId = formData.get("courseId") as string;
  const moduleId = formData.get("moduleId") as string;
  const classId = formData.get("classId") as string;
  await assertWritePermission("/erp/cursos/clases");

  const supabase = createAdminClient();
  await supabase.from("curso_clases").delete().eq("id", classId);

  revalidatePath(`/erp/cursos/clases?course_id=${courseId}&module_id=${moduleId}`);
}

async function saveAttendance(formData: FormData) {
  "use server";
  const courseId = formData.get("courseId") as string;
  const moduleId = formData.get("moduleId") as string;
  const classId = formData.get("classId") as string;
  await assertWritePermission("/erp/cursos/clases");

  const keys = Array.from(formData.keys());
  const attendanceData = keys
    .filter((k) => k.startsWith("status_"))
    .map((k) => {
      const studentId = k.replace("status_", "");
      const status = formData.get(k) as string;
      const notes = formData.get(`notes_${studentId}`) as string;
      return {
        class_id: classId,
        student_id: studentId,
        status,
        notes: notes || null,
      };
    });

  if (attendanceData.length === 0) return;

  const supabase = createAdminClient();
  // Upsert
  const { error } = await supabase
    .from("curso_asistencia")
    .upsert(attendanceData, { onConflict: "class_id,student_id" });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/erp/cursos/clases?course_id=${courseId}&module_id=${moduleId}&class_id=${classId}`);
  redirect(`/erp/cursos/clases?course_id=${courseId}&module_id=${moduleId}`);
}

export default async function ClasesPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ course_id?: string; module_id?: string; class_id?: string }>;
}) {
  await assertPermission("/erp/cursos/clases");
  const canEdit = await hasWritePermission("/erp/cursos/clases");

  const searchParams = await searchParamsPromise;
  const courseId = searchParams.course_id;
  const moduleId = searchParams.module_id;
  const classId = searchParams.class_id;

  const supabase = createAdminClient();

  // 1. Si no hay curso seleccionado, mostrar listado de cursos para elegir
  if (!courseId) {
    const { data: cursos } = await supabase
      .from("cursos")
      .select("*, curso_modulos(id)")
      .order("start_date", { ascending: false });

    return (
      <div className="max-w-4xl mx-auto pb-10">
        <div className="flex items-center gap-2 mb-6">
          <Presentation size={24} className="text-lilac-600" />
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Clases y Asistencia</h1>
            <p className="text-sm text-ink-600">Selecciona un curso activo para planificar clases y tomar asistencia.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {!cursos || cursos.length === 0 ? (
            <div className="sm:col-span-2 text-center text-sm text-ink-500 italic py-10 bg-white border border-lilac-100 rounded-2xl">
              No hay cursos registrados en el sistema.
            </div>
          ) : (
            cursos.map((c) => (
              <Link
                key={c.id}
                href={`/erp/cursos/clases?course_id=${c.id}`}
                className="card p-5 bg-white border border-lilac-100 shadow-sm hover:shadow-md transition hover:border-lilac-300 flex items-start gap-4"
              >
                <div className="w-10 h-10 bg-lilac-50 rounded-xl flex items-center justify-center text-lilac-600 shrink-0">
                  <GraduationCap size={20} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-ink-950 text-sm leading-snug line-clamp-1">{c.name}</h3>
                  <p className="text-xs text-ink-500">
                    Del {new Date(c.start_date + "T12:00:00").toLocaleDateString("es-EC")} al {new Date(c.end_date + "T12:00:00").toLocaleDateString("es-EC")}
                  </p>
                  <span className="inline-block text-[10px] bg-lilac-50 text-lilac-700 px-2 py-0.5 rounded-full font-bold">
                    {c.curso_modulos?.length || 0} módulos
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    );
  }

  // 2. Si hay curso, cargar datos del curso y sus módulos
  const [courseRes, modulesRes] = await Promise.all([
    supabase.from("cursos").select("*").eq("id", courseId).single(),
    supabase.from("curso_modulos").select("*").eq("course_id", courseId).order("number"),
  ]);

  const course = courseRes.data;
  if (!course) return redirect("/erp/cursos/clases");

  const modules = modulesRes.data || [];
  const selectedModule = modules.find(m => m.id === moduleId) ?? modules[0];

  // Si no hay módulos en el curso, indicar que debe crearlos primero
  if (modules.length === 0) {
    return (
      <div className="max-w-3xl mx-auto pb-10 text-center space-y-4">
        <div className="w-16 h-16 bg-lilac-50 text-lilac-600 rounded-full flex items-center justify-center mx-auto">
          <BookOpen size={32} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-ink-900">Curso sin Módulos</h2>
          <p className="text-sm text-ink-600 max-w-md mx-auto mt-1">
            Para poder programar clases y tomar asistencia, primero debes configurar los módulos del curso.
          </p>
        </div>
        <Link href={`/erp/cursos/${courseId}?tab=modulos`} className="btn-primary text-xs py-2.5 px-4 shadow-sm inline-block">
          Configurar Módulos Ahora
        </Link>
      </div>
    );
  }

  // Cargar las clases del módulo seleccionado y los profesores
  const [classesRes, teachersRes] = await Promise.all([
    supabase
      .from("curso_clases")
      .select("*, profesores(id, full_name)")
      .eq("module_id", selectedModule.id)
      .order("date")
      .order("start_time"),
    supabase.from("profesores").select("id, full_name").order("full_name"),
  ]);

  const classes = classesRes.data || [];
  const teachers = teachersRes.data || [];

  // 3. VISTA DE CONTROL DE ASISTENCIA (si class_id está seleccionado)
  if (classId) {
    const [classDetailRes, studentsRes, attendanceRes] = await Promise.all([
      supabase.from("curso_clases").select("*, curso_modulos(name)").eq("id", classId).single(),
      supabase.from("curso_inscripciones").select("status, alumnos(*)").eq("course_id", courseId).eq("status", "enrolled"),
      supabase.from("curso_asistencia").select("*").eq("class_id", classId),
    ]);

    const classDetail = classDetailRes.data;
    const enrolledStudents = (studentsRes.data || []).map((e: any) => e.alumnos).filter(Boolean);
    const attendanceRecords = attendanceRes.data || [];

    // Map para lookup rápido de estados ya registrados
    const attendanceMap = new Map<string, { status: string; notes: string | null }>();
    attendanceRecords.forEach((r) => {
      attendanceMap.set(r.student_id, { status: r.status, notes: r.notes });
    });

    return (
      <div className="max-w-4xl mx-auto pb-10">
        <Link
          href={`/erp/cursos/clases?course_id=${courseId}&module_id=${selectedModule.id}`}
          className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-4 transition-colors"
        >
          <ArrowLeft size={16} /> Volver a las Clases
        </Link>

        <div className="flex items-center gap-2 mb-6">
          <CheckSquare size={24} className="text-lilac-600" />
          <div>
            <h1 className="text-xl font-bold text-ink-900">Control de Asistencia</h1>
            <p className="text-xs text-ink-500">
              {course.name} &middot; Módulo: {classDetail?.curso_modulos?.name} &middot; Clase: <strong>{classDetail?.title}</strong>
            </p>
          </div>
        </div>

        <form action={saveAttendance} className="card bg-white border border-lilac-100 shadow-sm overflow-hidden">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="moduleId" value={selectedModule.id} />
          <input type="hidden" name="classId" value={classId} />

          <div className="px-5 py-4 border-b border-lilac-50 bg-lilac-50/10 flex items-center justify-between">
            <span className="text-xs font-bold text-ink-700 uppercase tracking-wider">Listado de alumnos</span>
            <span className="text-xs text-ink-400 font-bold">{enrolledStudents.length} alumnos matriculados</span>
          </div>

          {enrolledStudents.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-500 italic">No hay alumnos activos matriculados en este curso.</div>
          ) : (
            <div className="divide-y divide-lilac-50">
              {enrolledStudents.map((student) => {
                const recorded = attendanceMap.get(student.id) || { status: "present", notes: "" };
                return (
                  <div key={student.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="font-bold text-ink-950 text-sm">{student.full_name}</div>
                      <div className="text-[10px] text-ink-400 font-mono">{student.document_number}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      {/* Estado */}
                      <div className="flex items-center gap-2">
                        {[
                          { val: "present", label: "Presente", cls: "peer-checked:bg-green-600 peer-checked:text-white border-green-200 text-green-700" },
                          { val: "absent", label: "Ausente", cls: "peer-checked:bg-red-500 peer-checked:text-white border-red-200 text-red-700" },
                          { val: "justified", label: "Justificado", cls: "peer-checked:bg-amber-500 peer-checked:text-white border-amber-200 text-amber-700" },
                        ].map((s) => (
                          <label key={s.val} className="relative cursor-pointer">
                            <input
                              type="radio"
                              name={`status_${student.id}`}
                              value={s.val}
                              defaultChecked={recorded.status === s.val}
                              className="peer sr-only"
                              disabled={!canEdit}
                            />
                            <span className={`inline-block text-xs font-semibold px-2.5 py-1 border rounded-lg transition-all ${s.cls}`}>
                              {s.label}
                            </span>
                          </label>
                        ))}
                      </div>

                      {/* Nota/Observación */}
                      <input
                        type="text"
                        name={`notes_${student.id}`}
                        defaultValue={recorded.notes || ""}
                        placeholder="Nota / justificación..."
                        className="input text-xs py-1.5 w-full sm:w-44 focus:ring-1 focus:ring-lilac-500"
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {canEdit && enrolledStudents.length > 0 && (
            <div className="px-5 py-4 border-t border-lilac-50 bg-lilac-50/10 flex justify-end">
              <button type="submit" className="btn-primary text-xs py-2 px-5 shadow-sm font-semibold">
                Guardar Asistencia
              </button>
            </div>
          )}
        </form>
      </div>
    );
  }

  // 4. VISTA DE LISTADO DE CLASES Y PROGRAMACIÓN
  return (
    <div className="max-w-5xl mx-auto pb-10">
      <Link href="/erp/cursos/clases" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-4 transition-colors">
        <ArrowLeft size={16} /> Cambiar de Curso
      </Link>

      {/* Banner de Info del Curso */}
      <div className="card p-5 bg-white border border-lilac-100 shadow-sm mb-6">
        <span className="text-[10px] font-bold text-lilac-700 bg-lilac-50 px-2 py-0.5 border border-lilac-100 rounded-full uppercase">
          Curso seleccionado
        </span>
        <h2 className="text-lg font-bold text-ink-950 mt-1">{course.name}</h2>
      </div>

      {/* Selector de Módulos (Tabs) */}
      <div className="flex border-b border-lilac-100 mb-6 overflow-x-auto gap-1">
        {modules.map((m) => (
          <Link
            key={m.id}
            href={`/erp/cursos/clases?course_id=${courseId}&module_id=${m.id}`}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 -mb-px whitespace-nowrap transition-colors ${
              selectedModule.id === m.id
                ? "border-lilac-600 text-lilac-700 bg-lilac-50/30"
                : "border-transparent text-ink-600 hover:text-ink-900"
            }`}
          >
            Módulo {m.number}: {m.name}
          </Link>
        ))}
      </div>

      {/* Contenido Clases */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Listado de Clases */}
        <div className="md:col-span-2 space-y-3">
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-lilac-50 bg-lilac-50/10 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-800">Cronograma de Clases</span>
              <span className="text-xs text-ink-400 bg-lilac-50 px-2.5 py-0.5 rounded-full font-bold">
                {classes.length} clases
              </span>
            </div>

            {classes.length === 0 ? (
              <div className="p-8 text-center text-sm text-ink-500 italic">No hay clases programadas para este módulo.</div>
            ) : (
              <div className="divide-y divide-lilac-50">
                {classes.map((cls) => (
                  <div key={cls.id} className="p-5 flex justify-between items-start gap-4 hover:bg-lilac-50/10 transition-colors">
                    <div className="space-y-2">
                      <div className="space-y-0.5">
                        <h3 className="font-bold text-ink-950 text-sm flex items-center gap-1.5">
                          <Presentation size={15} className="text-lilac-600" /> {cls.title}
                        </h3>
                        {cls.description && (
                          <p className="text-xs text-ink-600 leading-relaxed max-w-md">{cls.description}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-4 text-[11px] text-ink-600 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} className="text-ink-400" /> {new Date(cls.date + "T12:00:00").toLocaleDateString("es-EC", { weekday: "short", day: "2-digit", month: "short" })}
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={13} className="text-ink-400" /> {cls.start_time.slice(0, 5)} - {cls.end_time.slice(0, 5)}
                        </span>
                        {cls.classroom && (
                          <span className="flex items-center gap-1">
                            <MapPin size={13} className="text-ink-400" /> Aula: {cls.classroom}
                          </span>
                        )}
                        {cls.profesores && (
                          <span className="flex items-center gap-1">
                            <User size={13} className="text-ink-400" /> Docente: {cls.profesores.full_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/erp/cursos/clases?course_id=${courseId}&module_id=${selectedModule.id}&class_id=${cls.id}`}
                        className="btn-secondary text-[11px] font-bold py-1 px-3 flex items-center gap-1 border border-lilac-200 hover:bg-lilac-50 rounded-xl transition"
                      >
                        <UserCheck size={12} /> Asistencia
                      </Link>

                      {canEdit && (
                        <ConfirmDeleteButton
                          action={deleteClass}
                          idName="classId"
                          idValue={cls.id}
                          extraFields={{ courseId, moduleId: selectedModule.id }}
                          confirmMessage="¿Estás seguro de que deseas eliminar esta clase del cronograma?"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Programar Clase */}
        <div className="md:col-span-1">
          {canEdit ? (
            <div className="card p-5 bg-white border border-lilac-100 shadow-sm">
              <h2 className="text-sm font-bold text-ink-950 mb-4 pb-2 border-b border-lilac-50 flex items-center gap-1.5">
                <Plus size={15} className="text-lilac-600" /> Programar Clase
              </h2>
              <form action={addClass} className="space-y-4">
                <input type="hidden" name="courseId" value={courseId} />
                <input type="hidden" name="moduleId" value={selectedModule.id} />
                <div>
                  <label className="label text-ink-800">Título de la clase *</label>
                  <input
                    name="title"
                    required
                    placeholder="Ej: Cirugía guiada práctica"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label text-ink-800">Descripción / Temario</label>
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="Indica temas o requisitos..."
                    className="input resize-none"
                  />
                </div>
                <div>
                  <label className="label text-ink-800">Fecha *</label>
                  <input name="date" type="date" required className="input" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label text-ink-800">Hora Inicio *</label>
                    <input name="startTime" type="time" required className="input" />
                  </div>
                  <div>
                    <label className="label text-ink-800">Hora Fin *</label>
                    <input name="endTime" type="time" required className="input" />
                  </div>
                </div>
                <div>
                  <label className="label text-ink-800">Docente a cargo</label>
                  <select name="teacherId" className="input text-xs">
                    <option value="">— Ninguno / Por definir —</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label text-ink-800">Aula / Laboratorio</label>
                  <input
                    name="classroom"
                    placeholder="Ej: Aula A, Preclínico 3..."
                    className="input"
                  />
                </div>
                <button type="submit" className="w-full btn-primary text-xs py-2.5 mt-2 shadow-sm">
                  Programar Clase
                </button>
              </form>
            </div>
          ) : (
            <div className="card p-5 bg-lilac-50/50 border border-lilac-100 text-center text-xs text-ink-500 italic">
              No tienes permisos para programar clases.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
