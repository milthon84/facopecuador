import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { GraduationCap, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { assertWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

async function createCourse(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/cursos");

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const totalCost = Number(formData.get("totalCost"));
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const maxStudents = formData.get("maxStudents") ? Number(formData.get("maxStudents")) : null;
  const status = formData.get("status") as string;
  const imageFile = formData.get("imageFile") as File;

  if (!name || !startDate || !endDate || isNaN(totalCost)) return;

  const supabase = createAdminClient();
  let imageUrl: string | null = null;

  // Procesar subida de boceto del curso si existe
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
        console.error("Error al subir el boceto:", uploadError.message);
      }
    } catch (err) {
      console.error("Excepción en la subida del boceto:", err);
    }
  }

  const { data: newCourse, error } = await supabase
    .from("cursos")
    .insert({
      name,
      description: description || null,
      total_cost: totalCost,
      start_date: startDate,
      end_date: endDate,
      max_students: maxStudents,
      status: status || "draft",
      image_url: imageUrl,
    })
    .select("id")
    .single();

  if (error || !newCourse) {
    throw new Error(error?.message || "Error al crear el curso");
  }

  revalidatePath("/erp/cursos");
  redirect(`/erp/cursos/${newCourse.id}`);
}

export default async function NuevoCursoPage() {
  await assertWritePermission("/erp/cursos");

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <Link href="/erp/cursos" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-4 transition-colors">
        <ArrowLeft size={16} /> Volver a Cursos
      </Link>

      <div className="flex items-center gap-2 mb-6">
        <GraduationCap size={24} className="text-lilac-600" />
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Aperturar Nuevo Curso</h1>
          <p className="text-sm text-ink-600">Completa los datos generales para crear un nuevo programa de formación.</p>
        </div>
      </div>

      <div className="card p-6 bg-white border border-lilac-100 shadow-sm">
        <form action={createCourse} className="space-y-4">
          <div>
            <label className="label text-ink-800">Nombre del Curso *</label>
            <input
              name="name"
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
                required
                className="input"
              />
            </div>
            <div>
              <label className="label text-ink-800">Fecha de Finalización *</label>
              <input
                name="endDate"
                type="date"
                required
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label text-ink-800 font-semibold">Boceto o Portada del Curso (Imagen)</label>
            <input
              name="imageFile"
              type="file"
              accept="image/*"
              className="w-full text-xs text-ink-600 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-lilac-50 file:text-lilac-700 hover:file:bg-lilac-100 bg-white border border-lilac-200 rounded-xl p-1 focus:outline-none"
            />
          </div>

          <div>
            <label className="label text-ink-800">Estado inicial</label>
            <select name="status" className="input">
              <option value="draft">Borrador (No visible en inscripciones aún)</option>
              <option value="active">Activo (Abierto para inscripciones)</option>
            </select>
          </div>

          <button type="submit" className="w-full btn-primary text-sm py-3 mt-4 shadow-sm">
            Crear Curso y Configurar Detalles
          </button>
        </form>
      </div>
    </div>
  );
}
