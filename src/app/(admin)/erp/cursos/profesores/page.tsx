import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Award, Search, ArrowRight, UserCheck, FileText, Stethoscope, GraduationCap, Users } from "lucide-react";
import Link from "next/link";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import { parseDbError } from "@/lib/db-error-parser";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import NuevoProfesorModal from "@/components/NuevoProfesorModal";
import TeacherDetailClient from "./TeacherDetailClient";
import { optimizeImageForWeb } from "@/lib/image-optimizer";
import { proxyStorageUrl } from "@/lib/storage-proxy";
import { warmLocalStorageCache } from "@/lib/storage-cache-server";
import { cleanDocumentNumber } from "@/lib/validators";

export const dynamic = "force-dynamic";

async function uploadTeacherFile(file: File, prefix: string): Promise<string | null> {
  if (!file || file.size === 0) return null;
  try {
    const supabase = createAdminClient();
    const arrayBuffer = await file.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);

    let uploadBuffer: any = originalBuffer;
    let contentType = file.type;
    let fileExt = file.name.split(".").pop() || "bin";

    if (file.type.startsWith("image/")) {
      const optimized = await optimizeImageForWeb(originalBuffer, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 80,
        format: "webp",
      });
      uploadBuffer = optimized.buffer;
      contentType = optimized.contentType;
      fileExt = optimized.extension;
    }

    const fileName = `${prefix}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("course-banners")
      .upload(fileName, uploadBuffer, {
        contentType,
        cacheControl: "31536000",
        upsert: true,
      });

    if (!uploadError) {
      await warmLocalStorageCache("course-banners", fileName, uploadBuffer);
      const { data } = supabase.storage.from("course-banners").getPublicUrl(fileName);
      return data.publicUrl;
    } else {
      console.error("Error al subir archivo de especialista:", uploadError.message);
    }
  } catch (err) {
    console.error("Excepción al subir archivo de especialista:", err);
  }
  return null;
}

// Server Actions
async function addTeacher(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/cursos/profesores");
  
  const fullName = (formData.get("fullName") as string)?.trim();
  const rawDocument = (formData.get("documentNumber") as string)?.trim();
  const documentNumber = cleanDocumentNumber(rawDocument);
  const specialty = (formData.get("specialty") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const photoFile = formData.get("photoFile") as File;
  const cvFile = formData.get("cvFile") as File;

  // Datos bancarios
  const bankName = (formData.get("bankName") as string)?.trim();
  const bankAccountType = (formData.get("bankAccountType") as string)?.trim();
  const bankAccountNumber = (formData.get("bankAccountNumber") as string)?.trim();
  const bankAccountOwner = (formData.get("bankAccountOwner") as string)?.trim();
  const rawBankAccountId = (formData.get("bankAccountId") as string)?.trim();
  const bankAccountId = cleanDocumentNumber(rawBankAccountId);

  const isDoctor = formData.get("is_doctor") === "on" || formData.get("is_doctor") === "true";
  const isTeacher = formData.get("is_teacher") === "on" || formData.get("is_teacher") === "true";

  if (!fullName) {
    throw new Error("El nombre completo del especialista es obligatorio.");
  }
  if (!documentNumber) {
    throw new Error("La cédula o RUC del especialista es obligatoria.");
  }
  if (!specialty) {
    throw new Error("La especialidad del especialista es obligatoria.");
  }

  const photoUrl = await uploadTeacherFile(photoFile, "teacher_photo");
  const cvUrl = await uploadTeacherFile(cvFile, "teacher_cv");

  const insertPayload: any = {
    full_name: fullName,
    document_number: documentNumber,
    specialty: specialty,
    phone: phone || null,
    email: email || null,
    is_doctor: isDoctor,
    is_teacher: isTeacher,
    bank_name: bankName || null,
    bank_account_type: bankAccountType || null,
    bank_account_number: bankAccountNumber || null,
    bank_account_owner: bankAccountOwner || null,
    bank_account_id: bankAccountId || null,
  };

  if (photoUrl) insertPayload.photo_url = photoUrl;
  if (cvUrl) insertPayload.cv_url = cvUrl;

  const supabase = createAdminClient();
  const { data: newTeacher, error } = await supabase.from("profesores").insert(insertPayload).select("id").single();

  if (error) {
    throw new Error(parseDbError(error.message));
  }

  revalidatePath("/erp/cursos/profesores");
  if (newTeacher?.id) {
    redirect(`/erp/cursos/profesores?id=${newTeacher.id}`);
  }
}

async function updateTeacher(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/cursos/profesores");

  const id = formData.get("id") as string;
  const fullName = (formData.get("fullName") as string)?.trim();
  const rawDocument = (formData.get("documentNumber") as string)?.trim();
  const documentNumber = cleanDocumentNumber(rawDocument);
  const specialty = (formData.get("specialty") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const existingPhotoUrl = (formData.get("existingPhotoUrl") as string) || null;
  const existingCvUrl = (formData.get("existingCvUrl") as string) || null;
  const photoFile = formData.get("photoFile") as File;
  const cvFile = formData.get("cvFile") as File;

  // Datos bancarios
  const bankName = (formData.get("bankName") as string)?.trim();
  const bankAccountType = (formData.get("bankAccountType") as string)?.trim();
  const bankAccountNumber = (formData.get("bankAccountNumber") as string)?.trim();
  const bankAccountOwner = (formData.get("bankAccountOwner") as string)?.trim();
  const rawBankAccountId = (formData.get("bankAccountId") as string)?.trim();
  const bankAccountId = cleanDocumentNumber(rawBankAccountId);

  const isDoctor = formData.get("is_doctor") === "on" || formData.get("is_doctor") === "true";
  const isTeacher = formData.get("is_teacher") === "on" || formData.get("is_teacher") === "true";

  if (!id) throw new Error("ID de especialista no válido.");
  if (!fullName) {
    throw new Error("El nombre completo del especialista es obligatorio.");
  }
  if (!documentNumber) {
    throw new Error("La cédula o RUC del especialista es obligatoria.");
  }
  if (!specialty) {
    throw new Error("La especialidad del especialista es obligatoria.");
  }

  const newPhotoUrl = await uploadTeacherFile(photoFile, "teacher_photo");
  const newCvUrl = await uploadTeacherFile(cvFile, "teacher_cv");

  const updatePayload: any = {
    full_name: fullName,
    document_number: documentNumber,
    specialty: specialty,
    phone: phone || null,
    email: email || null,
    is_doctor: isDoctor,
    is_teacher: isTeacher,
    bank_name: bankName || null,
    bank_account_type: bankAccountType || null,
    bank_account_number: bankAccountNumber || null,
    bank_account_owner: bankAccountOwner || null,
    bank_account_id: bankAccountId || null,
    photo_url: newPhotoUrl || existingPhotoUrl,
    cv_url: newCvUrl || existingCvUrl,
    updated_at: new Date().toISOString(),
  };

  const supabase = createAdminClient();
  const { error } = await supabase.from("profesores").update(updatePayload).eq("id", id);
  if (error) {
    throw new Error(parseDbError(error.message));
  }

  revalidatePath(`/erp/cursos/profesores?id=${id}`);
  revalidatePath("/erp/cursos/profesores");
}

async function deleteTeacher(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/cursos/profesores");
  const id = formData.get("id") as string;

  const supabase = createAdminClient();
  const [courseAssoc, classAssoc, apptAssoc] = await Promise.all([
    supabase.from("curso_profesores").select("id").eq("teacher_id", id).limit(1),
    supabase.from("curso_clases").select("id").eq("teacher_id", id).limit(1),
    supabase.from("appointments").select("id").eq("doctor_id", id).limit(1),
  ]);

  if ((courseAssoc.data || []).length > 0 || (classAssoc.data || []).length > 0) {
    redirect("/erp/cursos/profesores?error=assigned");
  }

  if ((apptAssoc.data || []).length > 0) {
    redirect("/erp/cursos/profesores?error=appointments");
  }

  await supabase.from("profesores").delete().eq("id", id);
  revalidatePath("/erp/cursos/profesores");
}

export default async function ProfesoresPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ id?: string; q?: string; edit?: string; role?: string; error?: string }>;
}) {
  await assertPermission("/erp/cursos/profesores");
  const canEdit = await hasWritePermission("/erp/cursos/profesores");
  const searchParams = await searchParamsPromise;
  
  const teacherId = searchParams.id;
  const searchQuery = searchParams.q || "";
  const roleFilter = searchParams.role || "all";
  const editMode = searchParams.edit === "true";
  const errorParam = searchParams.error;

  const supabase = createAdminClient();

  // === VISTA DE DETALLE DEL ESPECIALISTA ===
  if (teacherId) {
    const [teacherRes, assignedCoursesRes, assignedClassesRes, assignedAppointmentsRes] = await Promise.all([
      supabase.from("profesores").select("*").eq("id", teacherId).single(),
      supabase
        .from("curso_profesores")
        .select("id, role, created_at, cursos(*)")
        .eq("teacher_id", teacherId),
      supabase
        .from("curso_clases")
        .select("id, title, date, start_time, end_time, classroom, curso_modulos(id, number, name, cursos(id, name))")
        .eq("teacher_id", teacherId)
        .order("date", { ascending: false }),
      supabase
        .from("appointments")
        .select("id, starts_at, ends_at, status, reason, patient:patients(id, full_name, phone, document_number), dental_consultation:dental_consultations(id, treatment_notes)")
        .eq("doctor_id", teacherId)
        .order("starts_at", { ascending: false }),
    ]);

    const teacher = teacherRes.data;
    if (!teacher) return redirect("/erp/cursos/profesores");

    const rawAssignedCourses = assignedCoursesRes.data || [];
    const assignedClasses = assignedClassesRes.data || [];
    const rawAppointments = assignedAppointmentsRes.data || [];

    // Facturación y métricas de cursos asignados al especialista
    const courseIds = rawAssignedCourses.map((c: any) => c.cursos?.id).filter(Boolean);
    let enrichedCourses = rawAssignedCourses;
    let coursesBilledTotal = 0;

    if (courseIds.length > 0) {
      const [moduloInscRes, enrolRes] = await Promise.all([
        supabase
          .from("curso_modulo_inscripciones")
          .select("id, enrollment_id, module_id, invoice_id, billing_status, invoices:invoices(id, invoice_number, total, sri_status, created_at), curso_modulos:curso_modulos(course_id, cost)"),
        supabase
          .from("curso_inscripciones")
          .select("id, course_id, status, invoice_id, invoices:invoices(id, invoice_number, total, sri_status, created_at)"),
      ]);

      const courseStatsMap: Record<string, { totalBilled: number; invoicesCount: number; studentCount: Set<string>; invoices: any[] }> = {};
      courseIds.forEach((id: string) => {
        courseStatsMap[id] = { totalBilled: 0, invoicesCount: 0, studentCount: new Set(), invoices: [] };
      });

      const seenInvoiceIds = new Set<string>();

      (moduloInscRes.data || []).forEach((mi: any) => {
        const cId = mi.curso_modulos?.course_id;
        if (!cId || !courseStatsMap[cId]) return;
        if (mi.enrollment_id) courseStatsMap[cId].studentCount.add(mi.enrollment_id);
        if (mi.invoice_id && mi.invoices && !seenInvoiceIds.has(mi.invoice_id)) {
          const inv = mi.invoices;
          if (inv.sri_status !== "cancelled" && inv.sri_status !== "rejected") {
            seenInvoiceIds.add(mi.invoice_id);
            const amount = Number(inv.total) || 0;
            courseStatsMap[cId].totalBilled += amount;
            courseStatsMap[cId].invoicesCount++;
            courseStatsMap[cId].invoices.push({
              id: inv.id,
              invoice_number: inv.invoice_number,
              total: amount,
              created_at: inv.created_at,
              sri_status: inv.sri_status,
            });
          }
        }
      });

      (enrolRes.data || []).forEach((e: any) => {
        const cId = e.course_id;
        if (!cId || !courseStatsMap[cId]) return;
        courseStatsMap[cId].studentCount.add(e.id);
        if (e.invoice_id && e.invoices && !seenInvoiceIds.has(e.invoice_id)) {
          const inv = e.invoices;
          if (inv.sri_status !== "cancelled" && inv.sri_status !== "rejected") {
            seenInvoiceIds.add(e.invoice_id);
            const amount = Number(inv.total) || 0;
            courseStatsMap[cId].totalBilled += amount;
            courseStatsMap[cId].invoicesCount++;
            courseStatsMap[cId].invoices.push({
              id: inv.id,
              invoice_number: inv.invoice_number,
              total: amount,
              created_at: inv.created_at,
              sri_status: inv.sri_status,
            });
          }
        }
      });

      enrichedCourses = rawAssignedCourses.map((ac: any) => {
        const cId = ac.cursos?.id;
        const stats = cId ? courseStatsMap[cId] : null;
        const billed = stats ? stats.totalBilled : 0;
        coursesBilledTotal += billed;
        return {
          ...ac,
          billed_total: billed,
          invoices_count: stats ? stats.invoicesCount : 0,
          student_count: stats ? stats.studentCount.size : 0,
          invoices: stats ? stats.invoices : [],
        };
      });
    }

    // Facturas enlazadas a las citas del doctor (a través de xml_url = appointment_id)
    const apptIds = rawAppointments.map((a) => a.id);
    const { data: matchedInvoices } = apptIds.length > 0
      ? await supabase
          .from("invoices")
          .select("id, xml_url, invoice_number, total, sri_status, created_at")
          .in("xml_url", apptIds)
      : { data: [] };

    const apptInvoiceMap: Record<string, { id: string; invoice_number: string; total: number; sri_status: string; created_at?: string }> = {};
    let clinicBilledTotal = 0;
    matchedInvoices?.forEach((inv) => {
      if (inv.xml_url) {
        apptInvoiceMap[inv.xml_url] = {
          id: inv.id,
          invoice_number: inv.invoice_number,
          total: Number(inv.total) || 0,
          sri_status: inv.sri_status,
          created_at: inv.created_at,
        };
        if (inv.sri_status === "authorized" || inv.sri_status === "submitted" || inv.sri_status === "draft") {
          clinicBilledTotal += Number(inv.total) || 0;
        }
      }
    });

    const assignedAppointments = rawAppointments.map((a) => ({
      ...a,
      invoice: apptInvoiceMap[a.id] || null,
    }));

    return (
      <TeacherDetailClient
        teacher={teacher}
        assignedCourses={enrichedCourses}
        assignedClasses={assignedClasses}
        assignedAppointments={assignedAppointments}
        billedTotal={clinicBilledTotal + coursesBilledTotal}
        clinicBilledTotal={clinicBilledTotal}
        coursesBilledTotal={coursesBilledTotal}
        canEdit={canEdit}
        editMode={editMode}
        updateTeacherAction={updateTeacher}
      />
    );
  }

  // === VISTA GENERAL / DIRECTORIO DE ESPECIALISTAS ===
  let query = supabase.from("profesores").select("*");

  if (roleFilter === "doctor") {
    query = query.eq("is_doctor", true);
  } else if (roleFilter === "teacher") {
    query = query.eq("is_teacher", true);
  }

  if (searchQuery) {
    query = query.or(
      `full_name.ilike.%${searchQuery}%,specialty.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,document_number.ilike.%${searchQuery}%`
    );
  }

  const { data: profesores } = await query.order("full_name");

  return (
    <div className="max-w-6xl mx-auto pb-10 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-lilac-50 border border-lilac-200 flex items-center justify-center text-lilac-700 shrink-0 shadow-2xs">
            <Award size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Directorio de Especialistas</h1>
            <p className="text-sm text-ink-600">Registra especialistas, administra roles de atención a pacientes, cursos académicos y hojas de vida.</p>
          </div>
        </div>

        {canEdit && (
          <NuevoProfesorModal action={addTeacher} />
        )}
      </div>

      {errorParam === "assigned" && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm shadow-2xs">
          <strong>No se puede eliminar el especialista:</strong> Tiene cursos asignados o clases programadas. Desasócialo antes de eliminarlo.
        </div>
      )}

      {errorParam === "appointments" && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm shadow-2xs">
          <strong>No se puede eliminar el especialista:</strong> Tiene citas médicas o atenciones clínicas registradas a su nombre.
        </div>
      )}

      {/* Barra de Búsqueda y Filtros de Rol */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Pestañas de filtro por rol */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-lilac-100 shadow-2xs">
          <Link
            href={`/erp/cursos/profesores?role=all${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              roleFilter === "all"
                ? "bg-lilac-600 text-white shadow-2xs"
                : "text-ink-600 hover:text-ink-900 hover:bg-lilac-50/50"
            }`}
          >
            Todos
          </Link>
          <Link
            href={`/erp/cursos/profesores?role=doctor${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              roleFilter === "doctor"
                ? "bg-teal-600 text-white shadow-2xs"
                : "text-teal-700 hover:text-teal-900 hover:bg-teal-50/50"
            }`}
          >
            <Stethoscope size={13} />
            <span>Atención a Pacientes</span>
          </Link>
          <Link
            href={`/erp/cursos/profesores?role=teacher${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              roleFilter === "teacher"
                ? "bg-lilac-600 text-white shadow-2xs"
                : "text-lilac-700 hover:text-lilac-900 hover:bg-lilac-50/50"
            }`}
          >
            <GraduationCap size={13} />
            <span>Profesor / Cursos</span>
          </Link>
        </div>

        {/* Formulario de búsqueda */}
        <form method="GET" action="/erp/cursos/profesores" className="relative flex gap-2 flex-1 max-w-md">
          {roleFilter !== "all" && <input type="hidden" name="role" value={roleFilter} />}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" size={16} />
            <input
              name="q"
              defaultValue={searchQuery}
              placeholder="Buscar por nombre, especialidad..."
              className="w-full bg-white border border-lilac-200 rounded-2xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-500 shadow-2xs"
            />
          </div>
          <button type="submit" className="btn-primary text-xs py-2 px-4 shadow-sm shrink-0 cursor-pointer">
            Buscar
          </button>
        </form>
      </div>

      {/* Tabla del Directorio */}
      <div className="bg-white border border-lilac-100 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-lilac-50 bg-lilac-50/10 flex items-center justify-between">
          <span className="text-sm font-bold text-ink-900">Listado de Especialistas Registrados</span>
          <span className="text-xs text-ink-500 bg-lilac-50 border border-lilac-100 px-3 py-1 rounded-full font-bold">
            {profesores?.length ?? 0} {profesores?.length === 1 ? "especialista" : "especialistas"}
          </span>
        </div>

        {!profesores || profesores.length === 0 ? (
          <div className="p-12 text-center text-sm text-ink-500 italic">
            {searchQuery ? "No se encontraron especialistas con el criterio de búsqueda." : "No hay especialistas registrados en el sistema."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-lilac-50/50 text-[10px] font-bold text-ink-500 uppercase tracking-wider border-b border-lilac-100">
                <tr>
                  <th className="text-left px-6 py-3.5">Especialista & Roles</th>
                  <th className="text-left px-6 py-3.5">Teléfono</th>
                  <th className="text-left px-6 py-3.5">Correo Electrónico</th>
                  <th className="text-left px-6 py-3.5">Hoja de Vida (CV)</th>
                  <th className="text-right px-6 py-3.5">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {profesores.map((prof) => {
                  const isDoc = prof.is_doctor ?? true;
                  const isTeach = prof.is_teacher ?? true;

                  return (
                    <tr key={prof.id} className="hover:bg-lilac-50/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {prof.photo_url ? (
                            <img
                              src={proxyStorageUrl(prof.photo_url)}
                              alt={prof.full_name}
                              loading="lazy"
                              className="w-10 h-10 rounded-full object-cover border border-lilac-200 shadow-2xs shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-lilac-50 border border-lilac-200 flex items-center justify-center text-lilac-600 font-bold shrink-0">
                              <UserCheck size={18} />
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link href={`/erp/cursos/profesores?id=${prof.id}`} className="font-bold text-ink-950 hover:text-lilac-700">
                                {prof.full_name}
                              </Link>
                              {prof.document_number && (
                                <span className="text-[10px] bg-slate-100 text-slate-700 font-mono px-1.5 py-0.5 rounded border border-slate-200">
                                  CI: {prof.document_number}
                                </span>
                              )}
                            </div>
                            {prof.specialty && (
                              <div className="text-[11px] text-ink-600 font-medium">{prof.specialty}</div>
                            )}
                            <div className="flex items-center gap-1.5 pt-0.5">
                              {isDoc && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                                  <Stethoscope size={10} /> Atención Pacientes
                                </span>
                              )}
                              {isTeach && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-lilac-800 bg-lilac-50 border border-lilac-200 px-2 py-0.5 rounded-md">
                                  <GraduationCap size={10} /> Profesor / Cursos
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-ink-800 font-medium">
                        {prof.phone || "-"}
                      </td>
                      <td className="px-6 py-4 text-xs text-ink-700">
                        {prof.email || "-"}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {prof.cv_url ? (
                          <a
                            href={proxyStorageUrl(prof.cv_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-lilac-50 text-lilac-700 hover:bg-lilac-100 font-bold text-xs px-2.5 py-1 rounded-xl border border-lilac-200 shadow-2xs transition"
                          >
                            <FileText size={12} />
                            <span>Ver CV</span>
                          </a>
                        ) : (
                          <span className="text-ink-400 italic text-xs">No subido</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/erp/cursos/profesores?id=${prof.id}`}
                            className="inline-flex items-center justify-center gap-1.5 bg-lilac-700 hover:bg-lilac-800 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all shadow-2xs hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                          >
                            <span>Gestionar</span>
                            <ArrowRight size={13} />
                          </Link>

                          {canEdit && (
                            <ConfirmDeleteButton
                              action={deleteTeacher}
                              idValue={prof.id}
                              confirmMessage="¿Estás seguro de que deseas eliminar este especialista?"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
