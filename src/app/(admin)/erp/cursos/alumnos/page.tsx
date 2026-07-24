import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { 
  Users, Plus, Pencil, ArrowLeft, Search, GraduationCap, 
  BookOpen, DollarSign, Calendar, FileText, CheckCircle2, 
  HelpCircle, AlertCircle 
} from "lucide-react";
import Link from "next/link";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import EnrollmentStatusSelector from "@/components/EnrollmentStatusSelector";
import { updateExpiredCourses } from "@/lib/courses";

export const dynamic = "force-dynamic";

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

  if (!fullName || !docNumber || !phone || !email) return;

  const supabase = createAdminClient();
  const { data: newStudent, error } = await supabase
    .from("alumnos")
    .insert({
      full_name: fullName,
      document_number: docNumber,
      phone,
      email,
      professional_title: title || null,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/erp/cursos/alumnos");
  redirect(`/erp/cursos/alumnos?id=${newStudent.id}`);
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

  if (!id || !fullName || !docNumber || !phone || !email) return;

  const supabase = createAdminClient();
  await supabase
    .from("alumnos")
    .update({
      full_name: fullName,
      document_number: docNumber,
      phone,
      email,
      professional_title: title || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
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
    const [studentRes, enrollmentsRes, allCoursesRes] = await Promise.all([
      supabase.from("alumnos").select("*").eq("id", studentId).single(),
      supabase
        .from("curso_inscripciones")
        .select(`
          id,
          status,
          created_at,
          cursos (id, name, total_cost),
          curso_modulo_inscripciones: curso_modulo_inscripciones (
            id,
            billing_status,
            invoice_id,
            curso_modulos (id, number, name, cost),
            invoices (id, invoice_number, sri_status)
          )
        `)
        .eq("student_id", studentId),
      supabase.from("cursos").select("id, name, total_cost").eq("status", "active"),
    ]);

    const student = studentRes.data;
    if (!student) return redirect("/erp/cursos/alumnos");

    const enrollments = enrollmentsRes.data || [];
    const allCourses = allCoursesRes.data || [];

    // Filtrar cursos en los que el alumno NO está inscrito
    const enrolledCourseIds = new Set(enrollments.map((e: any) => e.cursos?.id));
    const availableCourses = allCourses.filter(c => !enrolledCourseIds.has(c.id));

    return (
      <div className="max-w-5xl mx-auto pb-12">
        <Link href="/erp/cursos/alumnos" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-4 transition-colors">
          <ArrowLeft size={16} /> Volver al Directorio
        </Link>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Perfil del Alumno */}
          <div className="md:col-span-1 space-y-4">
            {editMode && canEdit ? (
              <div className="card p-5 bg-white border border-gold-200 shadow-md">
                <h2 className="text-sm font-bold text-ink-950 mb-4 pb-2 border-b border-lilac-50 flex items-center gap-1.5">
                  <Pencil size={15} className="text-gold-600" /> Editar Perfil
                </h2>
                <form action={updateStudent} className="space-y-4">
                  <input type="hidden" name="id" value={student.id} />
                  <div>
                    <label className="label text-ink-800">Nombre completo *</label>
                    <input name="fullName" defaultValue={student.full_name} required className="input" />
                  </div>
                  <div>
                    <label className="label text-ink-800">Identificación (Cédula/RUC) *</label>
                    <input name="documentNumber" defaultValue={student.document_number} required className="input font-mono" />
                  </div>
                  <div>
                    <label className="label text-ink-800">Teléfono *</label>
                    <input name="phone" defaultValue={student.phone} required className="input" />
                  </div>
                  <div>
                    <label className="label text-ink-800">Correo electrónico *</label>
                    <input name="email" type="email" defaultValue={student.email} required className="input" />
                  </div>
                  <div>
                    <label className="label text-ink-800">Título profesional</label>
                    <input name="professionalTitle" defaultValue={student.professional_title || ""} placeholder="Ej: Odontólogo General" className="input" />
                  </div>
                  <div>
                    <label className="label text-ink-800">Notas académicas / internas</label>
                    <textarea name="notes" rows={2} defaultValue={student.notes || ""} className="input resize-none" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="flex-1 btn-primary text-xs py-2.5">Guardar</button>
                    <Link href={`/erp/cursos/alumnos?id=${student.id}`} className="flex-1 btn-secondary text-xs py-2.5 text-center">Cancelar</Link>
                  </div>
                </form>
              </div>
            ) : (
              <div className="card p-5 bg-white border border-lilac-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-lilac-50 pb-2">
                  <h2 className="text-sm font-bold text-ink-950">Ficha del Alumno</h2>
                  {canEdit && (
                    <Link href={`/erp/cursos/alumnos?id=${student.id}&edit=true`} className="text-xs text-lilac-600 hover:text-lilac-800 font-semibold">
                      Editar
                    </Link>
                  )}
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-ink-400 tracking-wider">Nombre</div>
                    <div className="font-bold text-ink-900">{student.full_name}</div>
                  </div>
                  {student.professional_title && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-ink-400 tracking-wider">Título Profesional</div>
                      <div className="font-semibold text-lilac-800 bg-lilac-50 px-2 py-0.5 rounded-lg w-fit text-xs border border-lilac-100">{student.professional_title}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] uppercase font-bold text-ink-400 tracking-wider">Identificación</div>
                    <div className="font-mono text-xs">{student.document_number}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-ink-400 tracking-wider">Teléfono</div>
                    <div className="text-xs">{student.phone}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-ink-400 tracking-wider">Correo</div>
                    <div className="text-xs font-medium text-lilac-900 underline">{student.email}</div>
                  </div>
                  {student.notes && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-ink-400 tracking-wider">Notas</div>
                      <div className="text-xs text-ink-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100 leading-relaxed">{student.notes}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Registrar Matrícula */}
            {canEdit && (
              <div className="card p-5 bg-white border border-lilac-100 shadow-sm">
                <h3 className="text-sm font-bold text-ink-950 mb-4 pb-2 border-b border-lilac-50 flex items-center gap-1.5">
                  <GraduationCap size={15} className="text-lilac-600" /> Matricular en Curso
                </h3>
                {availableCourses.length === 0 ? (
                  <p className="text-xs text-ink-500 italic text-center py-4">No hay más cursos activos disponibles para matricular.</p>
                ) : (
                  <form action={enrollStudent} className="space-y-4">
                    <input type="hidden" name="studentId" value={student.id} />
                    <div>
                      <label className="label text-ink-800">Seleccionar Curso</label>
                      <select name="courseId" required className="input text-xs">
                        <option value="">Selecciona un curso...</option>
                        {availableCourses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} (${Number(c.total_cost).toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" className="w-full btn-primary text-xs py-2.5 shadow-sm">
                      Matricular Alumno
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Historial de Cursos y Módulos Facturables */}
          <div className="md:col-span-2 space-y-6">
            <h2 className="text-lg font-bold text-ink-900 border-b border-lilac-100 pb-2 flex items-center gap-2">
              <GraduationCap size={20} className="text-lilac-600" /> Cursos e Inscripciones Activas
            </h2>

            {enrollments.length === 0 ? (
              <div className="card p-8 text-center text-sm text-ink-500 italic bg-white border border-lilac-100 shadow-sm">
                El alumno no está matriculado en ningún curso todavía.
              </div>
            ) : (
              enrollments.map((enroll: any) => {
                const curso = enroll.cursos;
                if (!curso) return null;

                const sortedModules = [...(enroll.curso_modulo_inscripciones || [])].sort(
                  (a: any, b: any) => (a.curso_modulos?.number || 0) - (b.curso_modulos?.number || 0)
                );

                return (
                  <div key={enroll.id} className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
                    {/* Header del Curso */}
                    <div className="px-5 py-4 border-b border-lilac-50 bg-lilac-50/10 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-ink-950 text-base">{curso.name}</h3>
                        <p className="text-xs text-ink-500">Inscrito el {new Date(enroll.created_at).toLocaleDateString("es-EC")}</p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {canEdit && (
                        <EnrollmentStatusSelector
                          enrollmentId={enroll.id}
                          studentId={student.id}
                          initialStatus={enroll.status}
                          action={updateEnrollmentStatus}
                        />
                        )}
                        <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          enroll.status === "enrolled" ? "bg-green-50 text-green-700 border-green-200" :
                          enroll.status === "completed" ? "bg-lilac-50 text-lilac-700 border-lilac-200" :
                          "bg-red-50 text-red-700 border-red-100"
                        }`}>
                          {enroll.status === "enrolled" ? "En Curso" :
                           enroll.status === "completed" ? "Completado" : "Retirado"}
                        </span>
                      </div>
                    </div>

                    {/* Módulos de Facturación */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-ink-600">Estado de pago por módulo:</span>
                      </div>

                      {sortedModules.length === 0 ? (
                        <p className="text-xs text-ink-400 italic">No hay módulos configurados para este curso.</p>
                      ) : (
                        <div className="space-y-2">
                          {sortedModules.map((mi: any) => {
                            const mod = mi.curso_modulos;
                            if (!mod) return null;

                            // Prefill invoice link parameters
                            const prefName = encodeURIComponent(student.full_name);
                            const prefDoc = encodeURIComponent(student.document_number);
                            const prefEmail = encodeURIComponent(student.email);
                            const prefPhone = encodeURIComponent(student.phone);
                            const prefDesc = encodeURIComponent(`Pago Curso: ${curso.name} - Módulo ${mod.number}: ${mod.name}`);
                            const prefPrice = encodeURIComponent(mod.cost.toString());

                            const invoiceLink = `/erp/facturacion/nueva?client_name=${prefName}&client_document=${prefDoc}&client_email=${prefEmail}&client_phone=${prefPhone}&module_enrollment_ids=${mi.id}&item_description=${prefDesc}&item_price=${prefPrice}`;

                            return (
                              <div key={mi.id} className="flex justify-between items-center gap-4 p-3 bg-lilac-50/10 border border-lilac-100/50 rounded-xl">
                                <div className="space-y-0.5">
                                  <div className="text-xs font-bold text-ink-900">
                                    Módulo {mod.number}: {mod.name}
                                  </div>
                                  <div className="text-[10px] text-ink-500 font-semibold">
                                    Costo: ${Number(mod.cost).toFixed(2)}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {mi.billing_status === "invoiced" && mi.invoices && mi.invoices.sri_status !== "cancelled" ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-xl">
                                      <CheckCircle2 size={11} /> Facturado (#{mi.invoices.invoice_number})
                                    </span>
                                  ) : mi.billing_status === "free" ? (
                                    <span className="text-[10px] font-bold text-ink-500 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-xl">
                                      Beca / Sin Costo
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl">
                                      Pendiente de Pago
                                    </span>
                                  )}

                                  {mi.billing_status === "pending" && canEdit && (
                                    <Link
                                      href={invoiceLink}
                                      className="btn-primary text-[10px] font-bold py-1 px-3 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
                                    >
                                      Facturar Módulo
                                    </Link>
                                  )}
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
        </div>
      </div>
    );
  }

  // === VISTA GENERAL / DIRECTORIO DE ALUMNOS ===
  const supabaseAdmin = createAdminClient();
  let query = supabaseAdmin.from("alumnos").select("*");

  if (searchQuery) {
    query = query.or(
      `full_name.ilike.%${searchQuery}%,document_number.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`
    );
  }

  const { data: alumnos } = await query.order("full_name");

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="flex items-center gap-2 mb-6">
        <Users size={24} className="text-lilac-600" />
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Directorio de Alumnos</h1>
          <p className="text-sm text-ink-600">Registra nuevos alumnos y realiza inscripciones a cursos de posgrado.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Formulario de Registro */}
        <div className="md:col-span-1">
          {canEdit ? (
            <div className="card p-5 bg-white border border-lilac-100 shadow-sm">
              <h2 className="text-sm font-bold text-ink-950 mb-4 pb-2 border-b border-lilac-50 flex items-center gap-1.5">
                <Plus size={15} className="text-lilac-600" /> Registrar Alumno
              </h2>
              <form action={addStudent} className="space-y-4">
                <div>
                  <label className="label text-ink-800">Nombre completo *</label>
                  <input name="fullName" required placeholder="Ej: Dra. Gabriela Roldán" className="input" />
                </div>
                <div>
                  <label className="label text-ink-800">Identificación (Cédula/RUC) *</label>
                  <input name="documentNumber" required placeholder="Ej: 1712345678" className="input font-mono" />
                </div>
                <div>
                  <label className="label text-ink-800">Teléfono *</label>
                  <input name="phone" required placeholder="Ej: 0991234567" className="input" />
                </div>
                <div>
                  <label className="label text-ink-800">Correo electrónico *</label>
                  <input name="email" type="email" required placeholder="Ej: doctora@correo.com" className="input" />
                </div>
                <div>
                  <label className="label text-ink-800">Título profesional</label>
                  <input name="professionalTitle" placeholder="Ej: Odontólogo General, Endodoncista" className="input" />
                </div>
                <div>
                  <label className="label text-ink-800">Notas internas</label>
                  <textarea name="notes" rows={2} placeholder="Comentarios adicionales..." className="input resize-none" />
                </div>
                <button type="submit" className="w-full btn-primary text-xs py-2.5 mt-2 shadow-sm">
                  Registrar Alumno
                </button>
              </form>
            </div>
          ) : (
            <div className="card p-5 bg-lilac-50/50 border border-lilac-100 text-center text-xs text-ink-500 italic">
              No tienes permisos para registrar alumnos.
            </div>
          )}
        </div>

        {/* Listado de Alumnos */}
        <div className="md:col-span-2 space-y-4">
          {/* Barra de Búsqueda */}
          <form method="GET" action="/erp/cursos/alumnos" className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={16} />
              <input
                name="q"
                defaultValue={searchQuery}
                placeholder="Buscar por nombre, cédula, correo o teléfono..."
                className="w-full bg-white border border-lilac-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
              />
            </div>
            <button type="submit" className="btn-primary text-xs py-2 px-4 shadow-sm shrink-0">
              Buscar
            </button>
          </form>

          {/* Directorio */}
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-lilac-50 bg-lilac-50/10 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-800 font-bold">Listado de Alumnos</span>
              <span className="text-xs text-ink-400 bg-lilac-50 px-2.5 py-0.5 rounded-full font-bold">
                {alumnos?.length ?? 0} alumnos
              </span>
            </div>

            {!alumnos || alumnos.length === 0 ? (
              <div className="p-10 text-center text-sm text-ink-500 italic">
                {searchQuery ? "No se encontraron alumnos con el criterio de búsqueda." : "No hay alumnos registrados en el sistema."}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-lilac-50/50 text-[10px] font-bold text-ink-500 uppercase tracking-wider border-b border-lilac-100">
                  <tr>
                    <th className="text-left px-5 py-3">Nombre</th>
                    <th className="text-left px-5 py-3">Documento</th>
                    <th className="text-left px-5 py-3">Email</th>
                    <th className="text-left px-5 py-3">Teléfono</th>
                    <th className="text-right px-5 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lilac-50">
                  {alumnos.map((student) => (
                    <tr key={student.id} className="hover:bg-lilac-50/10">
                      <td className="px-5 py-3">
                        <Link href={`/erp/cursos/alumnos?id=${student.id}`} className="font-bold text-ink-950 hover:text-lilac-700">
                          {student.full_name}
                        </Link>
                        {student.professional_title && (
                          <div className="text-[10px] text-ink-500 font-medium">{student.professional_title}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ink-700">
                        {student.document_number}
                      </td>
                      <td className="px-5 py-3 text-xs text-ink-700">
                        {student.email}
                      </td>
                      <td className="px-5 py-3 text-xs text-ink-700">
                        {student.phone}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/erp/cursos/alumnos?id=${student.id}`}
                          className="inline-flex items-center text-xs font-semibold text-lilac-600 hover:text-lilac-800"
                        >
                          Ver Ficha →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
