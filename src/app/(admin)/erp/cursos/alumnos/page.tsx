import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Users, Search, ArrowRight, User } from "lucide-react";
import Link from "next/link";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import { updateExpiredCourses } from "@/lib/courses";
import { parseDbError } from "@/lib/db-error-parser";
import NuevoAlumnoModal from "@/components/NuevoAlumnoModal";
import StudentDetailClient from "./StudentDetailClient";

export const dynamic = "force-dynamic";

async function uploadStudentPhoto(file: File): Promise<string | null> {
  if (!file || file.size === 0) return null;
  try {
    const supabase = createAdminClient();
    const fileExt = file.name.split(".").pop();
    const fileName = `student_photo_${Date.now()}.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("course-banners")
      .upload(fileName, buffer, {
        contentType: file.type,
      });

    if (!uploadError) {
      const { data } = supabase.storage.from("course-banners").getPublicUrl(fileName);
      return data.publicUrl;
    } else {
      console.error("Error al subir foto de alumno:", uploadError.message);
    }
  } catch (err) {
    console.error("Excepción al subir foto de alumno:", err);
  }
  return null;
}

// --- Server Actions ---

async function addStudent(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/cursos/alumnos");

  const fullName = (formData.get("fullName") as string)?.trim();
  const docNumber = (formData.get("documentNumber") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const title = (formData.get("professionalTitle") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim();
  const courseId = (formData.get("courseId") as string)?.trim();
  const photoFile = formData.get("photoFile") as File;

  if (!fullName || !docNumber || !phone || !email) return;

  const photoUrl = await uploadStudentPhoto(photoFile);
  const supabase = createAdminClient();

  let studentId: string;

  const { data: existingStudent } = await supabase
    .from("alumnos")
    .select("id")
    .or(`document_number.eq.${docNumber},email.eq.${email}`)
    .limit(1)
    .maybeSingle();

  if (existingStudent) {
    studentId = existingStudent.id;
    const updatePayload: any = {
      full_name: fullName,
      document_number: docNumber,
      phone,
      email,
      professional_title: title || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };
    if (photoUrl) updatePayload.photo_url = photoUrl;
    await supabase.from("alumnos").update(updatePayload).eq("id", studentId);
  } else {
    const insertPayload: any = {
      full_name: fullName,
      document_number: docNumber,
      phone,
      email,
      professional_title: title || null,
      notes: notes || null,
    };
    if (photoUrl) insertPayload.photo_url = photoUrl;

    const { data: newStudent, error } = await supabase
      .from("alumnos")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error || !newStudent) {
      throw new Error(parseDbError(error?.message));
    }
    studentId = newStudent.id;
  }

  // Matricular inmediatamente si se eligió curso
  if (courseId) {
    const { data: existingEnrollment } = await supabase
      .from("curso_inscripciones")
      .select("id")
      .eq("course_id", courseId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (!existingEnrollment) {
      const { data: enrollment } = await supabase
        .from("curso_inscripciones")
        .insert({
          course_id: courseId,
          student_id: studentId,
          status: "enrolled",
        })
        .select("id")
        .single();

      if (enrollment) {
        const { data: modules } = await supabase
          .from("curso_modulos")
          .select("id")
          .eq("course_id", courseId);

        if (modules && modules.length > 0) {
          const moduleInscriptions = modules.map((m) => ({
            enrollment_id: enrollment.id,
            module_id: m.id,
            billing_status: "pending",
          }));
          await supabase.from("curso_modulo_inscripciones").insert(moduleInscriptions);
        }
      }
    }
  }

  revalidatePath("/erp/cursos/alumnos");
  redirect(`/erp/cursos/alumnos?id=${studentId}`);
}

async function updateStudent(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  await assertWritePermission("/erp/cursos/alumnos");

  const fullName = (formData.get("fullName") as string)?.trim();
  const docNumber = (formData.get("documentNumber") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const title = (formData.get("professionalTitle") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim();
  const existingPhotoUrl = (formData.get("existingPhotoUrl") as string) || null;
  const photoFile = formData.get("photoFile") as File;

  if (!id || !fullName || !docNumber || !phone || !email) return;

  const newPhotoUrl = await uploadStudentPhoto(photoFile);

  const updatePayload: any = {
    full_name: fullName,
    document_number: docNumber,
    phone,
    email,
    professional_title: title || null,
    notes: notes || null,
    photo_url: newPhotoUrl || existingPhotoUrl,
    updated_at: new Date().toISOString(),
  };

  const supabase = createAdminClient();
  await supabase
    .from("alumnos")
    .update(updatePayload)
    .eq("id", id);

  revalidatePath(`/erp/cursos/alumnos?id=${id}`);
}

async function enrollStudent(formData: FormData) {
  "use server";
  const studentId = formData.get("studentId") as string;
  const courseId = formData.get("courseId") as string;
  await assertWritePermission("/erp/cursos/alumnos");

  if (!studentId || !courseId) return;

  const supabase = createAdminClient();

  // 1. Crear la inscripción principal en curso_inscripciones
  const { data: enrollment, error: enrollError } = await supabase
    .from("curso_inscripciones")
    .insert({
      course_id: courseId,
      student_id: studentId,
      status: "enrolled",
    })
    .select("id")
    .single();

  if (enrollError) {
    throw new Error(enrollError.message);
  }

  // 2. Obtener todos los módulos asociados al curso
  const { data: modules } = await supabase
    .from("curso_modulos")
    .select("id")
    .eq("course_id", courseId);

  // 3. Crear las inscripciones detalladas por módulo en curso_modulo_inscripciones
  if (modules && modules.length > 0) {
    const moduleInscriptions = modules.map((m) => ({
      enrollment_id: enrollment.id,
      module_id: m.id,
      billing_status: "pending",
    }));
    await supabase.from("curso_modulo_inscripciones").insert(moduleInscriptions);
  }

  revalidatePath(`/erp/cursos/alumnos?id=${studentId}`);
}

async function updateEnrollmentStatus(formData: FormData) {
  "use server";
  const studentId = formData.get("studentId") as string;
  const enrollmentId = formData.get("enrollmentId") as string;
  const status = formData.get("status") as string;
  await assertWritePermission("/erp/cursos/alumnos");

  const supabase = createAdminClient();
  await supabase
    .from("curso_inscripciones")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", enrollmentId);

  revalidatePath(`/erp/cursos/alumnos?id=${studentId}`);
}

export default async function AlumnosPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ id?: string; q?: string; edit?: string }>;
}) {
  await assertPermission("/erp/cursos/alumnos");
  const canEdit = await hasWritePermission("/erp/cursos/alumnos");

  const searchParams = await searchParamsPromise;
  const studentId = searchParams.id;
  const searchQuery = searchParams.q || "";
  const editMode = searchParams.edit === "true";

  const supabase = createAdminClient();

  // Auto-completar cursos expirados
  await updateExpiredCourses(supabase);

  if (studentId) {
    // === VISTA DE DETALLE DEL ALUMNO ===
    const [studentRes, enrollmentsRes, attendanceRes, allCoursesRes] = await Promise.all([
      supabase.from("alumnos").select("*").eq("id", studentId).single(),
      supabase
        .from("curso_inscripciones")
        .select(`
          id,
          status,
          created_at,
          cursos (id, name, total_cost, start_date, end_date),
          curso_modulo_inscripciones: curso_modulo_inscripciones (
            id,
            billing_status,
            invoice_id,
            curso_modulos (id, number, name, cost),
            invoices (id, invoice_number, sri_status)
          )
        `)
        .eq("student_id", studentId),
      supabase
        .from("curso_asistencia")
        .select(`
          id,
          status,
          notes,
          created_at,
          curso_clases (
            id,
            title,
            date,
            start_time,
            end_time,
            classroom,
            curso_modulos (
              id,
              number,
              name,
              cursos (id, name)
            )
          )
        `)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
      supabase.from("cursos").select("id, name, total_cost").in("status", ["active", "in_progress"]).order("name"),
    ]);

    const student = studentRes.data;
    if (!student) return redirect("/erp/cursos/alumnos");

    // Cargar facturas emitidas a nombre del alumno (por cédula o email)
    const invoicesRes = await supabase
      .from("invoices")
      .select("*")
      .or(`client_document.eq.${student.document_number},client_email.eq.${student.email}`)
      .order("created_at", { ascending: false });

    const enrollments = enrollmentsRes.data || [];
    const attendance = attendanceRes.data || [];
    const invoices = invoicesRes.data || [];
    const allCourses = allCoursesRes.data || [];

    // Filtrar cursos en los que el alumno NO está inscrito
    const enrolledCourseIds = new Set(enrollments.map((e: any) => e.cursos?.id));
    const availableCourses = allCourses.filter(c => !enrolledCourseIds.has(c.id));

    return (
      <StudentDetailClient
        student={student}
        enrollments={enrollments}
        attendance={attendance}
        invoices={invoices}
        availableCourses={availableCourses}
        canEdit={canEdit}
        editMode={editMode}
        updateStudentAction={updateStudent}
        enrollStudentAction={enrollStudent}
        updateEnrollmentStatusAction={updateEnrollmentStatus}
      />
    );
  }

  // === VISTA GENERAL / DIRECTORIO DE ALUMNOS (FULL WIDTH) ===
  let query = supabase.from("alumnos").select("*");

  if (searchQuery) {
    query = query.or(
      `full_name.ilike.%${searchQuery}%,document_number.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`
    );
  }

  const [alumnosRes, activeCoursesRes] = await Promise.all([
    query.order("full_name"),
    supabase.from("cursos").select("id, name, total_cost").in("status", ["active", "in_progress"]).order("name")
  ]);

  const alumnos = alumnosRes.data || [];
  const activeCourses = activeCoursesRes.data || [];

  return (
    <div className="max-w-6xl mx-auto pb-10 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-lilac-50 border border-lilac-200 flex items-center justify-center text-lilac-700 shrink-0">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Directorio de Alumnos</h1>
            <p className="text-sm text-ink-600">Registra alumnos, consulta asistencias a clases e historial de facturación.</p>
          </div>
        </div>

        {canEdit && (
          <NuevoAlumnoModal activeCourses={activeCourses} action={addStudent} />
        )}
      </div>

      {/* Barra de Búsqueda */}
      <form method="GET" action="/erp/cursos/alumnos" className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" size={16} />
          <input
            name="q"
            defaultValue={searchQuery}
            placeholder="Buscar por nombre, cédula/RUC, correo o teléfono..."
            className="w-full bg-white border border-lilac-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 shadow-2xs"
          />
        </div>
        <button type="submit" className="btn-primary text-xs py-2.5 px-5 shadow-sm shrink-0 cursor-pointer">
          Buscar
        </button>
      </form>

      {/* Tabla del Directorio (Full Width) */}
      <div className="bg-white border border-lilac-100 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-lilac-50 bg-lilac-50/10 flex items-center justify-between">
          <span className="text-sm font-bold text-ink-900">Listado de Alumnos Registrados</span>
          <span className="text-xs text-ink-500 bg-lilac-50 border border-lilac-100 px-3 py-1 rounded-full font-bold">
            {alumnos?.length ?? 0} alumnos
          </span>
        </div>

        {!alumnos || alumnos.length === 0 ? (
          <div className="p-12 text-center text-sm text-ink-500 italic">
            {searchQuery ? "No se encontraron alumnos con el criterio de búsqueda." : "No hay alumnos registrados en el sistema."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-lilac-50/50 text-[10px] font-bold text-ink-500 uppercase tracking-wider border-b border-lilac-100">
                <tr>
                  <th className="text-left px-6 py-3.5">Nombre Alumno</th>
                  <th className="text-left px-6 py-3.5">Identificación (Cédula/RUC)</th>
                  <th className="text-left px-6 py-3.5">Correo Electrónico</th>
                  <th className="text-left px-6 py-3.5">Teléfono</th>
                  <th className="text-right px-6 py-3.5">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {alumnos.map((student) => (
                  <tr key={student.id} className="hover:bg-lilac-50/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {student.photo_url ? (
                          <img
                            src={student.photo_url}
                            alt={student.full_name}
                            className="w-10 h-10 rounded-full object-cover border border-lilac-200 shadow-2xs shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-lilac-50 border border-lilac-200 flex items-center justify-center text-lilac-600 font-bold shrink-0">
                            <User size={18} />
                          </div>
                        )}
                        <div>
                          <Link href={`/erp/cursos/alumnos?id=${student.id}`} className="font-bold text-ink-950 hover:text-lilac-700">
                            {student.full_name}
                          </Link>
                          {student.professional_title && (
                            <div className="text-[11px] text-lilac-800 font-medium">{student.professional_title}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-ink-800 font-bold">
                      {student.document_number}
                    </td>
                    <td className="px-6 py-4 text-xs text-ink-700">
                      {student.email}
                    </td>
                    <td className="px-6 py-4 text-xs text-ink-700 font-medium">
                      {student.phone}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/erp/cursos/alumnos?id=${student.id}`}
                        className="inline-flex items-center justify-center gap-1.5 bg-lilac-700 hover:bg-lilac-800 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all shadow-2xs hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                      >
                        <span>Gestionar</span>
                        <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
