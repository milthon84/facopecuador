import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Award, Search, ArrowRight, UserCheck, FileText, Download } from "lucide-react";
import Link from "next/link";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import { parseDbError } from "@/lib/db-error-parser";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import NuevoProfesorModal from "@/components/NuevoProfesorModal";
import TeacherDetailClient from "./TeacherDetailClient";

export const dynamic = "force-dynamic";

async function uploadTeacherFile(file: File, prefix: string): Promise<string | null> {
  if (!file || file.size === 0) return null;
  try {
    const supabase = createAdminClient();
    const fileExt = file.name.split(".").pop();
    const fileName = `${prefix}_${Date.now()}.${fileExt}`;
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
      console.error("Error al subir archivo de profesor:", uploadError.message);
    }
  } catch (err) {
    console.error("Excepción al subir archivo de profesor:", err);
  }
  return null;
}

// Server Actions
async function addTeacher(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/cursos/profesores");
  
  const fullName = (formData.get("fullName") as string)?.trim();
  const specialty = (formData.get("specialty") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const photoFile = formData.get("photoFile") as File;
  const cvFile = formData.get("cvFile") as File;

  if (!fullName) return;

  const photoUrl = await uploadTeacherFile(photoFile, "teacher_photo");
  const cvUrl = await uploadTeacherFile(cvFile, "teacher_cv");

  const insertPayload: any = {
    full_name: fullName,
    specialty: specialty || null,
    phone: phone || null,
    email: email || null,
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
  const specialty = (formData.get("specialty") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const existingPhotoUrl = (formData.get("existingPhotoUrl") as string) || null;
  const existingCvUrl = (formData.get("existingCvUrl") as string) || null;
  const photoFile = formData.get("photoFile") as File;
  const cvFile = formData.get("cvFile") as File;

  if (!id || !fullName) return;

  const newPhotoUrl = await uploadTeacherFile(photoFile, "teacher_photo");
  const newCvUrl = await uploadTeacherFile(cvFile, "teacher_cv");

  const updatePayload: any = {
    full_name: fullName,
    specialty: specialty || null,
    phone: phone || null,
    email: email || null,
    photo_url: newPhotoUrl || existingPhotoUrl,
    cv_url: newCvUrl || existingCvUrl,
    updated_at: new Date().toISOString(),
  };

  const supabase = createAdminClient();
  await supabase.from("profesores").update(updatePayload).eq("id", id);

  revalidatePath(`/erp/cursos/profesores?id=${id}`);
  revalidatePath("/erp/cursos/profesores");
}

async function deleteTeacher(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/cursos/profesores");
  const id = formData.get("id") as string;

  const supabase = createAdminClient();
  const [courseAssoc, classAssoc] = await Promise.all([
    supabase.from("curso_profesores").select("id").eq("teacher_id", id).limit(1),
    supabase.from("curso_clases").select("id").eq("teacher_id", id).limit(1),
  ]);

  if ((courseAssoc.data || []).length > 0 || (classAssoc.data || []).length > 0) {
    redirect("/erp/cursos/profesores?error=assigned");
  }

  await supabase.from("profesores").delete().eq("id", id);
  revalidatePath("/erp/cursos/profesores");
}

export default async function ProfesoresPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ id?: string; q?: string; edit?: string; error?: string }>;
}) {
  await assertPermission("/erp/cursos/profesores");
  const canEdit = await hasWritePermission("/erp/cursos/profesores");
  const searchParams = await searchParamsPromise;
  
  const teacherId = searchParams.id;
  const searchQuery = searchParams.q || "";
  const editMode = searchParams.edit === "true";
  const errorParam = searchParams.error;

  const supabase = createAdminClient();

  // === VISTA DE DETALLE DEL PROFESOR ===
  if (teacherId) {
    const [teacherRes, assignedCoursesRes, assignedClassesRes] = await Promise.all([
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
    ]);

    const teacher = teacherRes.data;
    if (!teacher) return redirect("/erp/cursos/profesores");

    const assignedCourses = assignedCoursesRes.data || [];
    const assignedClasses = assignedClassesRes.data || [];

    return (
      <TeacherDetailClient
        teacher={teacher}
        assignedCourses={assignedCourses}
        assignedClasses={assignedClasses}
        canEdit={canEdit}
        editMode={editMode}
        updateTeacherAction={updateTeacher}
      />
    );
  }

  // === VISTA GENERAL / DIRECTORIO DE PROFESORES (FULL WIDTH) ===
  let query = supabase.from("profesores").select("*");

  if (searchQuery) {
    query = query.or(
      `full_name.ilike.%${searchQuery}%,specialty.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`
    );
  }

  const { data: profesores } = await query.order("full_name");

  return (
    <div className="max-w-6xl mx-auto pb-10 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-lilac-50 border border-lilac-200 flex items-center justify-center text-gold-600 shrink-0">
            <Award size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Directorio de Profesores</h1>
            <p className="text-sm text-ink-600">Registra profesores, administra especialidades, hojas de vida (CV) y clases asignadas.</p>
          </div>
        </div>

        {canEdit && (
          <NuevoProfesorModal action={addTeacher} />
        )}
      </div>

      {errorParam === "assigned" && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm shadow-2xs">
          <strong>No se puede eliminar el profesor:</strong> Tiene cursos asignados o clases programadas. Desasócialo antes de eliminarlo.
        </div>
      )}

      {/* Barra de Búsqueda */}
      <form method="GET" action="/erp/cursos/profesores" className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" size={16} />
          <input
            name="q"
            defaultValue={searchQuery}
            placeholder="Buscar por nombre, especialidad, correo o teléfono..."
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
          <span className="text-sm font-bold text-ink-900">Listado de Profesores Registrados</span>
          <span className="text-xs text-ink-500 bg-lilac-50 border border-lilac-100 px-3 py-1 rounded-full font-bold">
            {profesores?.length ?? 0} profesores
          </span>
        </div>

        {!profesores || profesores.length === 0 ? (
          <div className="p-12 text-center text-sm text-ink-500 italic">
            {searchQuery ? "No se encontraron profesores con el criterio de búsqueda." : "No hay profesores registrados en el sistema."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-lilac-50/50 text-[10px] font-bold text-ink-500 uppercase tracking-wider border-b border-lilac-100">
                <tr>
                  <th className="text-left px-6 py-3.5">Profesor & Especialidad</th>
                  <th className="text-left px-6 py-3.5">Teléfono</th>
                  <th className="text-left px-6 py-3.5">Correo Electrónico</th>
                  <th className="text-left px-6 py-3.5">Hoja de Vida (CV)</th>
                  <th className="text-right px-6 py-3.5">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {profesores.map((prof) => (
                  <tr key={prof.id} className="hover:bg-lilac-50/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {prof.photo_url ? (
                          <img
                            src={prof.photo_url}
                            alt={prof.full_name}
                            className="w-10 h-10 rounded-full object-cover border border-lilac-200 shadow-2xs shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-lilac-50 border border-lilac-200 flex items-center justify-center text-lilac-600 font-bold shrink-0">
                            <UserCheck size={18} />
                          </div>
                        )}
                        <div>
                          <Link href={`/erp/cursos/profesores?id=${prof.id}`} className="font-bold text-ink-950 hover:text-lilac-700">
                            {prof.full_name}
                          </Link>
                          {prof.specialty && (
                            <div className="text-[11px] text-lilac-800 font-semibold mt-0.5">{prof.specialty}</div>
                          )}
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
                          href={prof.cv_url}
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
                            confirmMessage="¿Estás seguro de que deseas eliminar este profesor?"
                          />
                        )}
                      </div>
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
