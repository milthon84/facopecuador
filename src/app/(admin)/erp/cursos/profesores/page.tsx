import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Award, Plus, Pencil, ArrowLeft, Mail, Phone, UserCheck } from "lucide-react";
import Link from "next/link";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";

export const dynamic = "force-dynamic";

// Server Actions
async function addTeacher(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/cursos/profesores");
  
  const fullName = (formData.get("fullName") as string)?.trim();
  const specialty = (formData.get("specialty") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();

  if (!fullName) return;

  const supabase = createAdminClient();
  await supabase.from("profesores").insert({
    full_name: fullName,
    specialty: specialty || null,
    phone: phone || null,
    email: email || null,
  });

  revalidatePath("/erp/cursos/profesores");
}

async function updateTeacher(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/cursos/profesores");

  const id = formData.get("id") as string;
  const fullName = (formData.get("fullName") as string)?.trim();
  const specialty = (formData.get("specialty") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();

  if (!id || !fullName) return;

  const supabase = createAdminClient();
  await supabase.from("profesores").update({
    full_name: fullName,
    specialty: specialty || null,
    phone: phone || null,
    email: email || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  revalidatePath("/erp/cursos/profesores");
  redirect("/erp/cursos/profesores");
}

async function deleteTeacher(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/cursos/profesores");
  const id = formData.get("id") as string;

  const supabase = createAdminClient();
  // Verificar si tiene asignaciones en curso_profesores o curso_clases antes de borrar
  const [courseAssoc, classAssoc] = await Promise.all([
    supabase.from("curso_profesores").select("id").eq("teacher_id", id).limit(1),
    supabase.from("curso_clases").select("id").eq("teacher_id", id).limit(1),
  ]);

  if ((courseAssoc.data || []).length > 0 || (classAssoc.data || []).length > 0) {
    // Si tiene asociaciones, no permitimos borrarlo directamente
    redirect("/erp/cursos/profesores?error=assigned");
  }

  await supabase.from("profesores").delete().eq("id", id);
  revalidatePath("/erp/cursos/profesores");
}

export default async function ProfesoresPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  await assertPermission("/erp/cursos/profesores");
  const canEdit = await hasWritePermission("/erp/cursos/profesores");
  const searchParams = await searchParamsPromise;
  
  const editId = searchParams.edit;
  const errorParam = searchParams.error;

  const supabase = createAdminClient();

  // Obtener lista de profesores
  const { data: profesores } = await supabase
    .from("profesores")
    .select("*")
    .order("full_name");

  // Si está en modo edición, cargar datos del profesor a editar
  let teacherToEdit = null;
  if (editId) {
    const { data } = await supabase
      .from("profesores")
      .select("*")
      .eq("id", editId)
      .single();
    teacherToEdit = data;
  }

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="flex items-center gap-2 mb-6">
        <Award size={24} className="text-gold-600" />
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Profesores</h1>
          <p className="text-sm text-ink-600">Registra y administra los profesores e instructores de los cursos.</p>
        </div>
      </div>

      {errorParam === "assigned" && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">
          <strong>No se puede eliminar el profesor:</strong> Tiene cursos asignados o clases programadas. Desasócialo antes de eliminarlo.
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Formulario (Nuevo / Editar) */}
        <div className="md:col-span-1">
          {canEdit ? (
            teacherToEdit ? (
              <div className="card p-5 bg-white border border-gold-200 shadow-md">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-lilac-50">
                  <h2 className="text-sm font-bold text-ink-950 flex items-center gap-1.5">
                    <Pencil size={15} className="text-gold-600" /> Editar Profesor
                  </h2>
                  <Link href="/erp/cursos/profesores" className="text-xs text-ink-500 hover:text-ink-800 flex items-center gap-0.5">
                    <ArrowLeft size={12} /> Cancelar
                  </Link>
                </div>
                <form action={updateTeacher} className="space-y-4">
                  <input type="hidden" name="id" value={teacherToEdit.id} />
                  <div>
                    <label className="label text-ink-800">Nombre completo *</label>
                    <input
                      name="fullName"
                      defaultValue={teacherToEdit.full_name}
                      required
                      placeholder="Ej: Dr. Alejandro Peralta"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label text-ink-800">Especialidad</label>
                    <input
                      name="specialty"
                      defaultValue={teacherToEdit.specialty || ""}
                      placeholder="Ej: Implantología, Ortodoncia"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label text-ink-800">Teléfono</label>
                    <input
                      name="phone"
                      defaultValue={teacherToEdit.phone || ""}
                      placeholder="Ej: 0998765432"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label text-ink-800">Correo electrónico</label>
                    <input
                      name="email"
                      type="email"
                      defaultValue={teacherToEdit.email || ""}
                      placeholder="Ej: profesor@facop.com"
                      className="input"
                    />
                  </div>
                  <button type="submit" className="w-full btn-primary text-xs py-2.5 mt-2 shadow-sm">
                    Guardar Cambios
                  </button>
                </form>
              </div>
            ) : (
              <div className="card p-5 bg-white border border-lilac-100 shadow-sm">
                <h2 className="text-sm font-bold text-ink-950 mb-4 flex items-center gap-1.5 pb-2 border-b border-lilac-50">
                  <Plus size={15} className="text-lilac-600" /> Nuevo Profesor
                </h2>
                <form action={addTeacher} className="space-y-4">
                  <div>
                    <label className="label text-ink-800">Nombre completo *</label>
                    <input
                      name="fullName"
                      required
                      placeholder="Ej: Dr. Alejandro Peralta"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label text-ink-800">Especialidad</label>
                    <input
                      name="specialty"
                      placeholder="Ej: Implantología, Ortodoncia"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label text-ink-800">Teléfono</label>
                    <input
                      name="phone"
                      placeholder="Ej: 0998765432"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label text-ink-800">Correo electrónico</label>
                    <input
                      name="email"
                      type="email"
                      placeholder="Ej: profesor@facop.com"
                      className="input"
                    />
                  </div>
                  <button type="submit" className="w-full btn-primary text-xs py-2.5 mt-2 shadow-sm">
                    Registrar Profesor
                  </button>
                </form>
              </div>
            )
          ) : (
            <div className="card p-5 bg-lilac-50/50 border border-lilac-100 text-center text-xs text-ink-500 italic">
              No tienes permisos para registrar o editar profesores.
            </div>
          )}
        </div>

        {/* Listado de Profesores */}
        <div className="md:col-span-2 space-y-3">
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-lilac-50 flex items-center justify-between bg-lilac-50/10">
              <span className="text-sm font-semibold text-ink-800">Profesores registrados</span>
              <span className="text-xs text-ink-400 bg-lilac-50 px-2 py-0.5 rounded-full font-bold">
                {profesores?.length ?? 0} profesores
              </span>
            </div>

            {!profesores || profesores.length === 0 ? (
              <div className="p-8 text-center text-sm text-ink-500 italic">No hay profesores registrados.</div>
            ) : (
              <div className="divide-y divide-lilac-50">
                {profesores.map((prof) => (
                  <div key={prof.id} className="p-5 flex justify-between items-start gap-4 hover:bg-lilac-50/10 transition-colors">
                    <div className="space-y-1">
                      <h3 className="font-bold text-ink-950 text-sm flex items-center gap-1.5">
                        <UserCheck size={14} className="text-lilac-600" /> {prof.full_name}
                      </h3>
                      {prof.specialty && (
                        <div className="text-xs text-lilac-700 bg-lilac-50 border border-lilac-100 px-2 py-0.5 rounded-lg w-fit font-medium">
                          {prof.specialty}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-4 text-xs text-ink-600 pt-1.5">
                        {prof.phone && (
                          <span className="flex items-center gap-1">
                            <Phone size={12} className="text-ink-400" /> {prof.phone}
                          </span>
                        )}
                        {prof.email && (
                          <span className="flex items-center gap-1">
                            <Mail size={12} className="text-ink-400" /> {prof.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Link
                          href={`/erp/cursos/profesores?edit=${prof.id}`}
                          className="p-1.5 text-gold-600 hover:bg-gold-50 rounded-lg transition"
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </Link>
                        <ConfirmDeleteButton
                          action={deleteTeacher}
                          idValue={prof.id}
                          confirmMessage="¿Estás seguro de que deseas eliminar este profesor?"
                        />
                      </div>
                    )}
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
