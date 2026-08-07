import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { 
  Presentation, Calendar, Clock, Plus, ArrowLeft, 
  CheckCircle2, UserCheck, BookOpen, GraduationCap, CheckSquare, 
  MapPin, User, Mail, Send, DollarSign, AlertCircle, CreditCard, Search, Megaphone, Users, Trash2
} from "lucide-react";
import Link from "next/link";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { sendCourseNoticeEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// --- Server Actions ---

async function addClass(formData: FormData) {
  "use server";
  const courseId = formData.get("courseId") as string;
  const moduleId = formData.get("moduleId") as string;
  const date = formData.get("date") as string;
  await assertWritePermission("/erp/cursos/clases");

  if (!courseId || !moduleId || !date) return;

  const supabase = createAdminClient();

  const dateFormatted = new Date(date + "T12:00:00").toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  const title = `Clase del ${dateFormatted}`;

  const { data: newClass } = await supabase.from("curso_clases").insert({
    module_id: moduleId,
    title,
    date,
    start_time: "08:00",
    end_time: "17:00",
  }).select("id").single();

  revalidatePath(`/erp/cursos/clases?tab=clases&course_id=${courseId}&module_id=${moduleId}`);
  if (newClass?.id) {
    redirect(`/erp/cursos/clases?tab=clases&course_id=${courseId}&module_id=${moduleId}&class_id=${newClass.id}`);
  }
}

async function deleteClass(formData: FormData) {
  "use server";
  const courseId = formData.get("courseId") as string;
  const moduleId = formData.get("moduleId") as string;
  const classId = formData.get("classId") as string;
  await assertWritePermission("/erp/cursos/clases");

  const supabase = createAdminClient();
  await supabase.from("curso_clases").delete().eq("id", classId);

  revalidatePath(`/erp/cursos/clases?tab=clases&course_id=${courseId}&module_id=${moduleId}`);
}

async function saveDirectAttendance(formData: FormData) {
  "use server";
  const courseId = formData.get("courseId") as string;
  const moduleId = formData.get("moduleId") as string;
  const date = formData.get("date") as string;
  let classId = formData.get("classId") as string;
  await assertWritePermission("/erp/cursos/clases");

  if (!courseId || !moduleId) return;

  const supabase = createAdminClient();

  if (!classId) {
    const { data: existingClass } = await supabase
      .from("curso_clases")
      .select("id")
      .eq("module_id", moduleId)
      .eq("date", date)
      .limit(1)
      .maybeSingle();

    if (existingClass?.id) {
      classId = existingClass.id;
    } else {
      const dateFormatted = new Date(date + "T12:00:00").toLocaleDateString("es-EC", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
      const title = `Clase del ${dateFormatted}`;

      const { data: newClass, error: createError } = await supabase
        .from("curso_clases")
        .insert({
          module_id: moduleId,
          title,
          date,
          start_time: "08:00",
          end_time: "17:00",
        })
        .select("id")
        .single();

      if (createError || !newClass) {
        throw new Error(createError?.message || "No se pudo registrar la clase.");
      }
      classId = newClass.id;
    }
  }

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

  if (attendanceData.length > 0) {
    const { error } = await supabase
      .from("curso_asistencia")
      .upsert(attendanceData, { onConflict: "class_id,student_id" });

    if (error) throw new Error(error.message);
  }

  revalidatePath(`/erp/cursos/clases?tab=clases&course_id=${courseId}&module_id=${moduleId}&class_id=${classId}`);
  redirect(`/erp/cursos/clases?tab=clases&course_id=${courseId}&module_id=${moduleId}&class_id=${classId}&msg=saved`);
}

async function sendNotice(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/cursos/clases");

  const courseId = formData.get("courseId") as string;
  const classId = formData.get("classId") as string || null;
  const subject = (formData.get("subject") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();

  if (!courseId || !subject || !message) return;

  const supabase = createAdminClient();

  const { data: course } = await supabase
    .from("cursos")
    .select("name")
    .eq("id", courseId)
    .single();

  if (!course) return;

  const { data: notice, error: insertError } = await supabase
    .from("curso_avisos")
    .insert({
      course_id: courseId,
      class_id: classId,
      subject,
      message,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !notice) {
    throw new Error(insertError?.message || "Error al registrar el comunicado");
  }

  const { data: enrollments } = await supabase
    .from("curso_inscripciones")
    .select("alumnos(email, full_name)")
    .eq("course_id", courseId)
    .eq("status", "enrolled");

  const recipients = (enrollments || [])
    .map((e: any) => e.alumnos)
    .filter((a) => a && a.email);

  if (recipients.length === 0) {
    await supabase
      .from("curso_avisos")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .eq("id", notice.id);
    
    revalidatePath("/erp/cursos/clases");
    redirect(`/erp/cursos/clases?tab=avisos&course_id=${courseId}&status=sent`);
  }

  let allSuccessful = true;
  for (const student of recipients) {
    try {
      const success = await sendCourseNoticeEmail(
        student.email,
        student.full_name,
        subject,
        message,
        course.name
      );
      if (!success) allSuccessful = false;
    } catch (err) {
      console.error(`Error enviando aviso a ${student.email}:`, err);
      allSuccessful = false;
    }
  }

  await supabase
    .from("curso_avisos")
    .update({
      status: allSuccessful ? "sent" : "failed",
    })
    .eq("id", notice.id);

  revalidatePath("/erp/cursos/clases");
  redirect(`/erp/cursos/clases?tab=avisos&course_id=${courseId}&status=sent`);
}

export default async function ClasesPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ 
    tab?: string;
    course_id?: string; 
    module_id?: string; 
    class_id?: string; 
    date?: string;
    msg?: string;
    status?: string;
    q?: string;
  }>;
}) {
  await assertPermission("/erp/cursos/clases");
  const canEdit = await hasWritePermission("/erp/cursos/clases");

  const searchParams = await searchParamsPromise;
  const activeTab = searchParams.tab || "clases";
  const courseId = searchParams.course_id;
  const moduleId = searchParams.module_id;
  const classId = searchParams.class_id;
  const selectedDate = searchParams.date || new Date().toISOString().split("T")[0];
  const msgParam = searchParams.msg;
  const statusParam = searchParams.status;

  const supabase = createAdminClient();

  // =========================================================
  // PASO 1: SI NO HAY CURSO SELECCIONADO, MOSTRAR SELECCIÓN DE CURSO
  // =========================================================
  if (!courseId) {
    const { data: cursos } = await supabase
      .from("cursos")
      .select("*, curso_modulos(id)")
      .in("status", ["active", "in_progress"])
      .order("start_date", { ascending: false });

    return (
      <div className="max-w-6xl mx-auto pb-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-lilac-50 border border-lilac-200 flex items-center justify-center text-lilac-700 shrink-0">
            <Presentation size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-900 leading-tight">Clases, Asistencia y Comunicados</h1>
            <p className="text-xs text-ink-500">Selecciona un curso activo o en ejecución para administrar sus clases, asistencias y comunicados.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {!cursos || cursos.length === 0 ? (
            <div className="sm:col-span-3 text-center text-xs text-ink-500 italic py-10 bg-white border border-lilac-100 rounded-2xl shadow-2xs">
              No hay cursos en ejecución ni abiertos en este momento.
            </div>
          ) : (
            cursos.map((c) => (
              <Link
                key={c.id}
                href={`/erp/cursos/clases?tab=clases&course_id=${c.id}`}
                className="card p-4 bg-white border border-lilac-100 shadow-2xs hover:shadow-md transition hover:border-lilac-300 flex flex-col justify-between gap-3 rounded-2xl group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                      c.status === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-green-50 text-green-700 border-green-200"
                    }`}>
                      {c.status === "in_progress" ? "En Ejecución" : "Abierto"}
                    </span>
                    <span className="text-[10px] text-ink-400 font-bold bg-lilac-50 px-2 py-0.5 rounded-md">
                      {c.curso_modulos?.length || 0} módulos
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-ink-950 text-sm leading-snug group-hover:text-lilac-700 transition-colors line-clamp-1">{c.name}</h3>
                    <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{c.description || "Curso activo de posgrado."}</p>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-lilac-50 flex items-center justify-between text-xs text-ink-600 font-medium">
                  <span className="flex items-center gap-1 text-[11px]">
                    <Calendar size={12} className="text-lilac-500" />
                    <span>{new Date(c.start_date + "T12:00:00").toLocaleDateString("es-EC")}</span>
                  </span>
                  <span className="text-lilac-700 font-bold text-xs group-hover:translate-x-0.5 transition-transform">
                    Gestionar Curso →
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    );
  }

  // =========================================================
  // PASO 2: CURSO SELECCIONADO
  // =========================================================
  const [courseRes, enrollmentsRes] = await Promise.all([
    supabase.from("cursos").select("*").eq("id", courseId).single(),
    supabase.from("curso_inscripciones").select("id").eq("course_id", courseId).eq("status", "enrolled"),
  ]);

  const selectedCourse = courseRes.data;
  if (!selectedCourse) return redirect("/erp/cursos/clases");
  const enrolledCount = (enrollmentsRes.data || []).length;

  return (
    <div className="max-w-6xl mx-auto pb-8 space-y-4">
      {/* ENCABEZADO COMPACTO DE CURSO + PESTAÑAS */}
      <div className="bg-white border border-lilac-200 shadow-2xs rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lilac-50 border border-lilac-200 flex items-center justify-center text-lilac-700 font-bold shrink-0">
              <GraduationCap size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-ink-950 leading-tight">{selectedCourse.name}</h1>
                <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  selectedCourse.status === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-green-50 text-green-700 border-green-200"
                }`}>
                  {selectedCourse.status === "in_progress" ? "En Ejecución" : "Abierto"}
                </span>
                <span className="text-[10px] font-bold text-ink-500 bg-lilac-50 px-2 py-0.5 rounded-md border border-lilac-100 inline-flex items-center gap-1">
                  <Users size={11} /> {enrolledCount} Alumnos
                </span>
              </div>
              <p className="text-xs text-ink-500 mt-0.5">
                Del {new Date(selectedCourse.start_date + "T12:00:00").toLocaleDateString("es-EC")} al {new Date(selectedCourse.end_date + "T12:00:00").toLocaleDateString("es-EC")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/erp/cursos/${selectedCourse.id}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-ink-700 bg-white border border-lilac-200 px-3 py-1.5 rounded-xl hover:bg-lilac-50 transition shadow-2xs"
            >
              <span>Detalle</span>
              <BookOpen size={13} />
            </Link>
            <Link
              href="/erp/cursos/clases"
              className="inline-flex items-center gap-1 text-xs font-bold text-lilac-700 bg-lilac-50 border border-lilac-200 px-3 py-1.5 rounded-xl hover:bg-lilac-100 transition shadow-2xs"
            >
              <ArrowLeft size={13} />
              <span>Cambiar Curso</span>
            </Link>
          </div>
        </div>

        {/* PESTAÑAS DE NAVEGACIÓN COMPACTAS */}
        <div className="flex border-t border-lilac-100 pt-3 gap-2 overflow-x-auto">
          <Link
            href={`/erp/cursos/clases?tab=clases&course_id=${courseId}`}
            className={`flex items-center gap-1.5 px-4 py-2 font-bold text-xs rounded-xl transition whitespace-nowrap ${
              activeTab === "clases"
                ? "bg-lilac-600 text-white shadow-2xs"
                : "text-ink-600 hover:text-ink-900 hover:bg-lilac-50/60"
            }`}
          >
            <Calendar size={14} />
            <span>Cronograma y Asistencia</span>
          </Link>

          <Link
            href={`/erp/cursos/clases?tab=avisos&course_id=${courseId}`}
            className={`flex items-center gap-1.5 px-4 py-2 font-bold text-xs rounded-xl transition whitespace-nowrap ${
              activeTab === "avisos"
                ? "bg-lilac-600 text-white shadow-2xs"
                : "text-ink-600 hover:text-ink-900 hover:bg-lilac-50/60"
            }`}
          >
            <Megaphone size={14} />
            <span>Avisos y Comunicados</span>
          </Link>
        </div>
      </div>

      {/* ========================================== */}
      {/* PESTAÑA 2: AVISOS Y COMUNICADOS            */}
      {/* ========================================== */}
      {activeTab === "avisos" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {await (async () => {
            let classesForSelector: any[] = [];
            const { data: modules } = await supabase
              .from("curso_modulos")
              .select("id")
              .eq("course_id", courseId);
            
            if (modules && modules.length > 0) {
              const moduleIds = modules.map(m => m.id);
              const { data: loadedClasses } = await supabase
                .from("curso_clases")
                .select("id, title, date, start_time")
                .in("module_id", moduleIds)
                .order("date");
              classesForSelector = loadedClasses || [];
            }

            const { data: avisos } = await supabase
              .from("curso_avisos")
              .select(`
                id,
                subject,
                message,
                sent_at,
                status,
                cursos (name),
                curso_clases (title, date)
              `)
              .eq("course_id", courseId)
              .order("sent_at", { ascending: false })
              .limit(30);

            const successNotice = statusParam === "sent";

            return (
              <div className="space-y-4">
                {successNotice && (
                  <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-xs font-semibold flex items-center gap-2 shadow-2xs">
                    <CheckCircle2 size={15} className="text-green-600 shrink-0" />
                    ¡Comunicado enviado con éxito a los alumnos matriculados en {selectedCourse.name}!
                  </div>
                )}

                <div className="grid md:grid-cols-3 gap-4 items-start">
                  <div className="md:col-span-1">
                    {canEdit ? (
                      <div className="card p-4 bg-white border border-lilac-100 shadow-2xs rounded-2xl">
                        <h2 className="text-xs font-bold text-ink-950 mb-3 pb-2 border-b border-lilac-50 flex items-center gap-1.5">
                          <Send size={14} className="text-lilac-600" /> Redactar Comunicado
                        </h2>
                        <form action={sendNotice} className="space-y-3">
                          <input type="hidden" name="courseId" value={courseId} />
                          <div>
                            <label className="label text-ink-800 font-semibold text-[11px]">Curso Destinatario</label>
                            <input
                              type="text"
                              disabled
                              value={selectedCourse.name}
                              className="input text-xs py-1.5 bg-gray-50 border-gray-200 font-bold text-ink-900"
                            />
                          </div>

                          {classesForSelector.length > 0 && (
                            <div>
                              <label className="label text-ink-800 text-[11px]">Asociar a una clase (opcional)</label>
                              <select name="classId" className="input text-xs py-1.5">
                                <option value="">— Ninguna clase en particular —</option>
                                {classesForSelector.map((cls) => (
                                  <option key={cls.id} value={cls.id}>
                                    {cls.title} ({new Date(cls.date + "T12:00:00").toLocaleDateString("es-EC")})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div>
                            <label className="label text-ink-800 text-[11px]">Asunto del correo *</label>
                            <input
                              name="subject"
                              required
                              placeholder="Ej: Requisitos para el Módulo Clínico"
                              className="input text-xs py-1.5"
                            />
                          </div>

                          <div>
                            <label className="label text-ink-800 text-[11px]">Mensaje *</label>
                            <textarea
                              name="message"
                              required
                              rows={5}
                              placeholder="Escribe el mensaje oficial..."
                              className="input text-xs py-1.5 resize-none"
                            />
                          </div>

                          <button type="submit" className="w-full btn-primary text-xs py-2 mt-1 flex items-center justify-center gap-1.5 shadow-2xs font-semibold cursor-pointer">
                            <Send size={13} /> Enviar email ({enrolledCount} alumnos)
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="card p-4 bg-lilac-50/50 border border-lilac-100 text-center text-xs text-ink-500 italic rounded-2xl">
                        No tienes permisos para redactar o enviar avisos.
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2 space-y-3">
                    <div className="bg-white border border-lilac-100 rounded-2xl shadow-2xs overflow-hidden">
                      <div className="px-4 py-3 border-b border-lilac-50 bg-lilac-50/10 flex items-center justify-between">
                        <span className="text-xs font-bold text-ink-900">
                          Comunicados Enviados
                        </span>
                        <span className="text-[11px] text-ink-500 bg-lilac-50 border border-lilac-100 px-2.5 py-0.5 rounded-full font-bold">
                          {avisos?.length ?? 0} comunicados
                        </span>
                      </div>

                      {!avisos || avisos.length === 0 ? (
                        <div className="p-8 text-center text-xs text-ink-500 italic">Aún no se han enviado comunicados en este curso.</div>
                      ) : (
                        <div className="divide-y divide-lilac-50">
                          {avisos.map((av: any) => (
                            <div key={av.id} className="p-4 space-y-1.5 hover:bg-lilac-50/20 transition-colors">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-0.5">
                                  <h3 className="font-bold text-ink-950 text-xs flex items-center gap-1.5">
                                    <Mail size={13} className="text-lilac-600" /> {av.subject}
                                  </h3>
                                  <p className="text-[10px] text-ink-400 font-semibold">
                                    {av.curso_clases ? `Clase: ${av.curso_clases.title}` : "Aviso General"}
                                  </p>
                                </div>

                                <div className="flex flex-col items-end shrink-0 text-right space-y-0.5">
                                  <span className={`inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                                    av.status === "sent" ? "bg-green-50 text-green-700 border-green-200" :
                                    av.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-150 animate-pulse" :
                                    "bg-red-50 text-red-700 border-red-100"
                                  }`}>
                                    {av.status === "sent" ? "Enviado" :
                                     av.status === "pending" ? "Procesando" : "Fallido"}
                                  </span>
                                  <span className="text-[9px] text-ink-500 font-medium">
                                    {new Date(av.sent_at).toLocaleString("es-EC")}
                                  </span>
                                </div>
                              </div>

                              <p className="text-xs text-ink-600 bg-gray-50 border border-gray-100 p-2.5 rounded-xl whitespace-pre-wrap leading-relaxed">
                                {av.message}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================== */}
      {/* PESTAÑA 1: CRONOGRAMA Y ASISTENCIA         */}
      {/* ========================================== */}
      {activeTab === "clases" && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {await (async () => {
            const modulesRes = await supabase.from("curso_modulos").select("*").eq("course_id", courseId).order("number");
            const modules = modulesRes.data || [];

            if (modules.length === 0) {
              return (
                <div className="max-w-xl mx-auto py-8 text-center space-y-3 bg-white border border-lilac-100 rounded-2xl shadow-2xs">
                  <div className="w-12 h-12 bg-lilac-50 text-lilac-600 rounded-full flex items-center justify-center mx-auto">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-ink-900">Curso sin Módulos</h2>
                    <p className="text-xs text-ink-600 max-w-sm mx-auto mt-0.5">
                      Para tomar asistencia y programar clases, primero configura los módulos del curso.
                    </p>
                  </div>
                  <Link href={`/erp/cursos/${courseId}?tab=modulos`} className="btn-primary text-xs py-2 px-4 shadow-2xs inline-block font-semibold">
                    Configurar Módulos Ahora
                  </Link>
                </div>
              );
            }

            const selectedModule = modules.find(m => m.id === moduleId) ?? modules[0];

            // Cargar alumnos inscritos con su tipo de pago
            const enrolledDocs = await supabase
              .from("curso_inscripciones")
              .select("id, status, created_at, payment_type, alumnos(*)")
              .eq("course_id", courseId)
              .eq("status", "enrolled");

            const enrolledStudents = enrolledDocs.data || [];

            const [classesRes, moduleBillingRes] = await Promise.all([
              supabase
                .from("curso_clases")
                .select("*, profesores(id, full_name)")
                .eq("module_id", selectedModule.id)
                .order("date")
                .order("start_time"),
              supabase
                .from("curso_modulo_inscripciones")
                .select("id, enrollment_id, billing_status, invoice_id, invoices(invoice_number, sri_status)")
                .eq("module_id", selectedModule.id),
            ]);

            const classes = classesRes.data || [];
            const enrollmentsList = enrolledStudents;
            const moduleBillingList = moduleBillingRes.data || [];

            // Determinar la clase activa a mostrar
            const activeClass = classes.find(c => c.id === classId) || classes[0] || null;

            // Cargar asistencia de la clase activa
            let attendanceRecords: any[] = [];
            if (activeClass) {
              const { data: attData } = await supabase.from("curso_asistencia").select("*").eq("class_id", activeClass.id);
              attendanceRecords = attData || [];
            }

            const attendanceMap = new Map<string, { status: string; notes: string | null }>();
            attendanceRecords.forEach((r) => {
              attendanceMap.set(r.student_id, { status: r.status, notes: r.notes });
            });

            const billingMap = new Map<string, { billingStatus: string; invoiceNumber?: string; inscriptionId: string }>();
            moduleBillingList.forEach((mb: any) => {
              billingMap.set(mb.enrollment_id, {
                billingStatus: mb.billing_status,
                invoiceNumber: mb.invoices?.invoice_number,
                inscriptionId: mb.id,
              });
            });

            return (
              <div className="space-y-3">
                {/* PESTAÑAS DE MÓDULOS ENCABEZADO UNIFICADO */}
                <div className="flex border-b border-lilac-200 bg-white px-3 pt-2 rounded-t-2xl gap-2 overflow-x-auto">
                  {modules.map((m) => (
                    <Link
                      key={m.id}
                      href={`/erp/cursos/clases?tab=clases&course_id=${courseId}&module_id=${m.id}`}
                      className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 -mb-px whitespace-nowrap transition-colors ${
                        selectedModule.id === m.id
                          ? "border-lilac-600 text-lilac-800 bg-lilac-50/50"
                          : "border-transparent text-ink-600 hover:text-ink-900 hover:bg-lilac-50/30"
                      }`}
                    >
                      Módulo {m.number}: {m.name} (${Number(m.cost).toFixed(2)})
                    </Link>
                  ))}
                </div>

                {/* TARJETA UNIFICADA COMPACTA: FECHA + NUEVA CLASE + ASISTENCIA */}
                <div className="bg-white border border-lilac-200 rounded-b-2xl rounded-tr-2xl shadow-2xs p-4 space-y-4">
                  {/* BARRA UNIFICADA DE CONTROL DE CLASE */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-lilac-100">
                    {/* Izquierda: Selector de Clases existentes */}
                    <div className="flex items-center gap-2 overflow-x-auto">
                      <span className="text-xs font-bold text-ink-800 shrink-0">Clases del Módulo:</span>
                      {classes.length === 0 ? (
                        <span className="text-xs text-ink-400 italic">Sin clases guardadas aún</span>
                      ) : (
                        classes.map((cls, idx) => {
                          const isSelected = activeClass?.id === cls.id;
                          const dateFormatted = new Date(cls.date + "T12:00:00").toLocaleDateString("es-EC", {
                            day: "2-digit",
                            month: "short",
                          });

                          return (
                            <div key={cls.id} className="flex items-center shrink-0">
                              <Link
                                href={`/erp/cursos/clases?tab=clases&course_id=${courseId}&module_id=${selectedModule.id}&class_id=${cls.id}`}
                                className={`px-3 py-1 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
                                  isSelected
                                    ? "bg-lilac-600 text-white border-lilac-700 shadow-2xs"
                                    : "bg-lilac-50/60 text-ink-800 border-lilac-200 hover:bg-lilac-100"
                                }`}
                              >
                                <Calendar size={12} />
                                <span>Clase #{idx + 1} ({dateFormatted})</span>
                              </Link>

                              {canEdit && (
                                <ConfirmDeleteButton
                                  action={deleteClass}
                                  idName="classId"
                                  idValue={cls.id}
                                  extraFields={{ courseId, moduleId: selectedModule.id }}
                                  confirmMessage="¿Eliminar esta clase?"
                                />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Derecha: Formulario ultra rápido (Fecha + Botón Nueva Clase) */}
                    {canEdit && (
                      <form action={addClass} className="flex items-center gap-2 shrink-0">
                        <input type="hidden" name="courseId" value={courseId} />
                        <input type="hidden" name="moduleId" value={selectedModule.id} />
                        
                        <input
                          type="date"
                          name="date"
                          required
                          defaultValue={selectedDate}
                          className="bg-lilac-50/70 border border-lilac-200 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-lilac-500"
                        />
                        <button
                          type="submit"
                          className="btn-primary text-xs py-1 px-3 shadow-2xs font-bold shrink-0 cursor-pointer flex items-center gap-1"
                        >
                          <Plus size={13} />
                          <span>Nueva Clase</span>
                        </button>
                      </form>
                    )}
                  </div>

                  {msgParam === "saved" && (
                    <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-2.5 text-xs font-semibold flex items-center gap-2 shadow-2xs">
                      <CheckCircle2 size={15} className="text-green-600 shrink-0" />
                      <span>¡Asistencia guardada exitosamente!</span>
                    </div>
                  )}

                  {/* FORMULARIO DE ASISTENCIA Y CONTROL DE PAGOS */}
                  {activeClass ? (
                    <form action={saveDirectAttendance} className="space-y-3">
                      <input type="hidden" name="courseId" value={courseId} />
                      <input type="hidden" name="moduleId" value={selectedModule.id} />
                      <input type="hidden" name="date" value={activeClass.date} />
                      <input type="hidden" name="classId" value={activeClass.id} />

                      <div className="flex items-center justify-between bg-lilac-50/40 px-3.5 py-2 rounded-xl border border-lilac-100">
                        <span className="text-xs font-bold text-ink-950 flex items-center gap-1.5">
                          <UserCheck size={15} className="text-lilac-600" />
                          Toma de Asistencia &mdash; Sesión del {new Date(activeClass.date + "T12:00:00").toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })}
                        </span>
                        <span className="text-[11px] font-bold text-lilac-800 bg-white border border-lilac-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                          {enrollmentsList.length} Alumnos
                        </span>
                      </div>

                      {enrollmentsList.length === 0 ? (
                        <div className="p-8 text-center text-xs text-ink-500 italic bg-lilac-50/20 border border-lilac-100/60 rounded-xl">
                          No hay alumnos matriculados en este curso todavía.
                        </div>
                      ) : (
                        <div className="border border-lilac-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-lilac-100 bg-white">
                          {enrollmentsList.map((enrollment: any) => {
                            const student = enrollment.alumnos;
                            if (!student) return null;

                            // POR DEFECTO AUSENTE ANTES DE TOMAR ASISTENCIA
                            const hasRecord = attendanceMap.has(student.id);
                            const recorded = attendanceMap.get(student.id) || { status: "absent", notes: "" };
                            const currentStatus = hasRecord ? recorded.status : "absent";

                            const hasBillingRecord = billingMap.has(enrollment.id);
                            const billingInfo = billingMap.get(enrollment.id) || { billingStatus: "pending", inscriptionId: "" };

                            // Determinar estado efectivo de pago del módulo:
                            // 1. Si hay registro en billingMap → usar su billing_status
                            // 2. Si NO hay registro → verificar payment_type del enrollment:
                            //    - 'full_course' → ya pagó todo, marcar como pagado (se creará el registro en el próximo addModule)
                            //    - 'inscription' o null → pendiente de pago
                            let effectiveBillingStatus = billingInfo.billingStatus;
                            let fullCourseInvoiceNumber: string | null = null;

                            if (!hasBillingRecord && enrollment.payment_type === "full_course") {
                              effectiveBillingStatus = "invoiced_full";
                            }

                            const prefName = encodeURIComponent(student.full_name);
                            const prefDoc = encodeURIComponent(student.document_number);
                            const prefEmail = encodeURIComponent(student.email);
                            const prefPhone = encodeURIComponent(student.phone);
                            const prefDesc = encodeURIComponent(`Pago Curso: ${selectedCourse.name} - Módulo ${selectedModule.number}: ${selectedModule.name}`);
                            const prefPrice = encodeURIComponent(selectedModule.cost.toString());

                            // RETORNO AUTOMÁTICO A LA PANTALLA DE ASISTENCIA Y CURSO DESPUÉS DE FACTURAR
                            const returnUrlParam = encodeURIComponent(`/erp/cursos/clases?tab=clases&course_id=${courseId}&module_id=${selectedModule.id}&class_id=${activeClass.id}`);
                            const invoiceLink = `/erp/facturacion/nueva?client_name=${prefName}&client_document=${prefDoc}&client_email=${prefEmail}&client_phone=${prefPhone}&module_enrollment_ids=${billingInfo.inscriptionId}&item_description=${prefDesc}&item_price=${prefPrice}&return_url=${returnUrlParam}`;

                            return (
                              <div key={student.id} className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-lilac-50/20 transition-colors">
                                <div className="space-y-1">
                                  <div className="font-bold text-ink-950 text-xs flex items-center gap-1.5">
                                    <span>{student.full_name}</span>
                                    {student.professional_title && (
                                      <span className="text-[9px] font-semibold text-lilac-700 bg-lilac-50 border border-lilac-100 px-1.5 py-0.2 rounded-md">
                                        {student.professional_title}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-ink-500 font-mono">
                                    Cédula: {student.document_number} &middot; Tel: {student.phone}
                                  </div>

                                  {/* ESTADO DE PAGO DEL MÓDULO INLINE COMPACTO */}
                                  <div className="pt-0.5 flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold text-ink-600">Pago Módulo:</span>
                                    {(effectiveBillingStatus === "invoiced" || effectiveBillingStatus === "invoiced_full") ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.2 rounded-md">
                                        <CheckCircle2 size={10} />
                                        {effectiveBillingStatus === "invoiced_full"
                                          ? `Pagado - Curso Completo${fullCourseInvoiceNumber ? ` (#${fullCourseInvoiceNumber})` : ""}`
                                          : `Facturado${billingInfo.invoiceNumber ? ` (#${billingInfo.invoiceNumber})` : ""}`}
                                      </span>
                                    ) : effectiveBillingStatus === "free" ? (
                                      <span className="text-[9px] font-bold text-ink-500 bg-gray-100 border border-gray-200 px-2 py-0.2 rounded-md">
                                        Beca / Sin Costo
                                      </span>
                                    ) : (
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.2 rounded-md">
                                          Pendiente de Pago
                                        </span>
                                        {canEdit && (
                                          <Link
                                            href={invoiceLink}
                                            className="btn-primary text-[9px] font-bold py-0.5 px-2 shadow-2xs hover:scale-[1.02] active:scale-[0.98] transition-transform rounded-md"
                                          >
                                            Facturar Módulo
                                          </Link>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* TOMA DE ASISTENCIA: PRESENTE / AUSENTE (POR DEFECTO AUSENTE) */}
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="flex items-center gap-1">
                                    {[
                                      { val: "present", label: "Presente", cls: "peer-checked:bg-green-600 peer-checked:text-white border-green-200 text-green-700" },
                                      { val: "absent", label: "Ausente", cls: "peer-checked:bg-red-500 peer-checked:text-white border-red-200 text-red-700" },
                                    ].map((s) => (
                                      <label key={s.val} className="relative cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`status_${student.id}`}
                                          value={s.val}
                                          defaultChecked={currentStatus === s.val}
                                          className="peer sr-only"
                                          disabled={!canEdit}
                                        />
                                        <span className={`inline-block text-[11px] font-bold px-3 py-1 border rounded-lg transition-all cursor-pointer ${s.cls}`}>
                                          {s.label}
                                        </span>
                                      </label>
                                    ))}
                                  </div>

                                  <input
                                    type="text"
                                    name={`notes_${student.id}`}
                                    defaultValue={recorded.notes || ""}
                                    placeholder="Nota / Observación..."
                                    className="input text-xs py-1 px-2.5 w-40 focus:ring-1 focus:ring-lilac-500 rounded-lg"
                                    disabled={!canEdit}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {canEdit && enrollmentsList.length > 0 && (
                        <div className="pt-1 flex justify-end">
                          <button type="submit" className="btn-primary text-xs py-2 px-5 shadow-sm font-bold cursor-pointer flex items-center gap-1.5">
                            <CheckCircle2 size={15} />
                            <span>Guardar Asistencia</span>
                          </button>
                        </div>
                      )}
                    </form>
                  ) : (
                    <div className="p-8 text-center text-xs text-ink-500 italic bg-lilac-50/20 border border-lilac-100 rounded-xl">
                      Para empezar a tomar asistencia, ingresa la fecha arriba y presiona <strong>"+ Nueva Clase"</strong>.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
