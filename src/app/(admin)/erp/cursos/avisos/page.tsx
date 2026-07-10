import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Megaphone, Plus, Calendar, ArrowRight, User, BookOpen, Send, Mail, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import { sendCourseNoticeEmail } from "@/lib/email";
import CourseNoticeSelector from "@/components/CourseNoticeSelector";

export const dynamic = "force-dynamic";

// --- Server Action ---

async function sendNotice(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/cursos/avisos");

  const courseId = formData.get("courseId") as string;
  const classId = formData.get("classId") as string || null;
  const subject = (formData.get("subject") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();

  if (!courseId || !subject || !message) return;

  const supabase = createAdminClient();

  // 1. Obtener datos del curso para el asunto/contenido
  const { data: course } = await supabase
    .from("cursos")
    .select("name")
    .eq("id", courseId)
    .single();

  if (!course) return;

  // 2. Registrar el aviso en la tabla curso_avisos
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

  // 3. Obtener alumnos matriculados y activos en este curso
  const { data: enrollments } = await supabase
    .from("curso_inscripciones")
    .select("alumnos(email, full_name)")
    .eq("course_id", courseId)
    .eq("status", "enrolled");

  const recipients = (enrollments || [])
    .map((e: any) => e.alumnos)
    .filter((a) => a && a.email);

  if (recipients.length === 0) {
    // Si no hay alumnos matriculados, marcamos como enviado pero indicamos que no hubo destinatarios
    await supabase
      .from("curso_avisos")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .eq("id", notice.id);
    
    revalidatePath("/erp/cursos/avisos");
    return;
  }

  // 4. Enviar correos en lote utilizando la infraestructura de Resend
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

  // 5. Actualizar el estado del aviso en base de datos
  await supabase
    .from("curso_avisos")
    .update({
      status: allSuccessful ? "sent" : "failed",
    })
    .eq("id", notice.id);

  revalidatePath("/erp/cursos/avisos");
  redirect("/erp/cursos/avisos?status=sent");
}

export default async function AvisosCursosPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ course_id?: string; status?: string }>;
}) {
  await assertPermission("/erp/cursos/avisos");
  const canEdit = await hasWritePermission("/erp/cursos/avisos");

  const searchParams = await searchParamsPromise;
  const selectedCourseId = searchParams.course_id || "";
  const successStatus = searchParams.status === "sent";

  const supabase = createAdminClient();

  // 1. Cargar cursos activos para el selector
  const { data: courses } = await supabase
    .from("cursos")
    .select("id, name")
    .eq("status", "active")
    .order("name");

  // 2. Cargar clases del curso seleccionado (si lo hay) para programar opcionalmente
  let classes: any[] = [];
  if (selectedCourseId) {
    const { data: modules } = await supabase
      .from("curso_modulos")
      .select("id")
      .eq("course_id", selectedCourseId);
    
    if (modules && modules.length > 0) {
      const moduleIds = modules.map(m => m.id);
      const { data: loadedClasses } = await supabase
        .from("curso_clases")
        .select("id, title, date, start_time")
        .in("module_id", moduleIds)
        .order("date");
      classes = loadedClasses || [];
    }
  }

  // 3. Cargar historial de avisos enviados
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
    .order("sent_at", { ascending: false })
    .limit(30);

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="flex items-center gap-2 mb-6">
        <Megaphone size={24} className="text-lilac-600" />
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Avisos y Comunicados</h1>
          <p className="text-sm text-ink-600">Envía correos electrónicos y avisos grupales a los alumnos matriculados en tus cursos.</p>
        </div>
      </div>

      {successStatus && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 mb-6 text-sm flex items-center gap-2 font-medium">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          ¡Comunicado enviado con éxito a todos los alumnos matriculados!
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Enviar Comunicado */}
        <div className="md:col-span-1">
          {canEdit ? (
            <div className="card p-5 bg-white border border-lilac-100 shadow-sm">
              <h2 className="text-sm font-bold text-ink-950 mb-4 pb-2 border-b border-lilac-50 flex items-center gap-1.5">
                <Send size={15} className="text-lilac-600" /> Redactar Aviso
              </h2>
              <form action={sendNotice} className="space-y-4">
                {/* Curso */}
                <div>
                  <label className="label text-ink-800 font-semibold">Seleccionar Curso *</label>
                  <CourseNoticeSelector
                    courses={courses || []}
                    defaultValue={selectedCourseId}
                  />
                </div>

                {/* Clase asociada (Opcional) */}
                {selectedCourseId && classes.length > 0 && (
                  <div>
                    <label className="label text-ink-800">Asociar a una clase (opcional)</label>
                    <select name="classId" className="input text-xs">
                      <option value="">— Ninguna clase en particular —</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.title} ({new Date(cls.date + "T12:00:00").toLocaleDateString("es-EC")})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Asunto */}
                <div>
                  <label className="label text-ink-800">Asunto del correo *</label>
                  <input
                    name="subject"
                    required
                    placeholder="Ej: Requisitos para el Módulo Clínico del Sábado"
                    className="input"
                  />
                </div>

                {/* Mensaje */}
                <div>
                  <label className="label text-ink-800">Mensaje *</label>
                  <textarea
                    name="message"
                    required
                    rows={6}
                    placeholder="Escribe el mensaje o comunicado oficial aquí..."
                    className="input resize-none"
                  />
                </div>

                <button type="submit" className="w-full btn-primary text-xs py-2.5 mt-2 flex items-center justify-center gap-1.5 shadow-sm font-semibold">
                  <Send size={14} /> Enviar Comunicado
                </button>
              </form>
            </div>
          ) : (
            <div className="card p-5 bg-lilac-50/50 border border-lilac-100 text-center text-xs text-ink-500 italic">
              No tienes permisos para redactar o enviar avisos.
            </div>
          )}
        </div>

        {/* Historial de Avisos */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-lilac-50 bg-lilac-50/10 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-800">Historial de comunicados enviados</span>
              <span className="text-xs text-ink-400 bg-lilac-50 px-2.5 py-0.5 rounded-full font-bold">
                {avisos?.length ?? 0} comunicados
              </span>
            </div>

            {!avisos || avisos.length === 0 ? (
              <div className="p-10 text-center text-sm text-ink-500 italic">Aún no se han enviado comunicados.</div>
            ) : (
              <div className="divide-y divide-lilac-50">
                {avisos.map((av: any) => (
                  <div key={av.id} className="p-5 space-y-2 hover:bg-lilac-50/10 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <h3 className="font-bold text-ink-950 text-sm flex items-center gap-1.5">
                          <Mail size={14} className="text-lilac-600" /> {av.subject}
                        </h3>
                        <p className="text-[10px] text-ink-400 font-semibold">
                          Curso: {av.cursos?.name} {av.curso_clases ? `| Clase: ${av.curso_clases.title}` : ""}
                        </p>
                      </div>

                      <div className="flex flex-col items-end shrink-0 text-right space-y-1">
                        <span className={`inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          av.status === "sent" ? "bg-green-50 text-green-700 border-green-200" :
                          av.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-150 animate-pulse" :
                          "bg-red-50 text-red-700 border-red-100"
                        }`}>
                          {av.status === "sent" ? "Enviado" :
                           av.status === "pending" ? "Procesando" : "Fallido"}
                        </span>
                        <span className="text-[10px] text-ink-500 font-medium">
                          {new Date(av.sent_at).toLocaleString("es-EC")}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-ink-600 bg-gray-50 border border-gray-100 p-3 rounded-xl whitespace-pre-wrap leading-relaxed">
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
}


