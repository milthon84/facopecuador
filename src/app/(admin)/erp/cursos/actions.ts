"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertWritePermission } from "@/lib/auth-action";
import { revalidatePath } from "next/cache";

export async function copyCourseAction(courseId: string) {
  await assertWritePermission("/erp/cursos");

  if (!courseId) {
    throw new Error("ID de curso no proporcionado.");
  }

  const supabase = createAdminClient();

  // 1. Obtener información del curso original
  const { data: origCourse, error: courseErr } = await supabase
    .from("cursos")
    .select("*")
    .eq("id", courseId)
    .single();

  if (courseErr || !origCourse) {
    throw new Error("Curso no encontrado.");
  }

  // 2. Obtener módulos del curso original
  const { data: origModules } = await supabase
    .from("curso_modulos")
    .select("*")
    .eq("course_id", courseId)
    .order("number");

  // 3. Obtener profesores asignados al curso original
  const { data: origTeachers } = await supabase
    .from("curso_profesores")
    .select("*")
    .eq("course_id", courseId);

  // 4. Crear el nuevo curso duplicado en estado borrador
  const { data: newCourse, error: newCourseErr } = await supabase
    .from("cursos")
    .insert({
      name: `${origCourse.name} (Copia)`,
      description: origCourse.description,
      total_cost: origCourse.total_cost,
      start_date: origCourse.start_date,
      end_date: origCourse.end_date,
      max_students: origCourse.max_students,
      status: "draft",
      image_url: origCourse.image_url,
    })
    .select("id")
    .single();

  if (newCourseErr || !newCourse) {
    throw new Error(newCourseErr?.message || "Error al duplicar el curso.");
  }

  // 5. Duplicar módulos si existen
  if (origModules && origModules.length > 0) {
    const modulesToInsert = origModules.map((m) => ({
      course_id: newCourse.id,
      number: m.number,
      name: m.name,
      description: m.description,
      cost: m.cost,
      start_date: m.start_date,
      end_date: m.end_date,
    }));

    const { error: modErr } = await supabase
      .from("curso_modulos")
      .insert(modulesToInsert);

    if (modErr) {
      console.error("[copyCourseAction] Error al copiar módulos:", modErr.message);
    }
  }

  // 6. Duplicar profesores si existen
  if (origTeachers && origTeachers.length > 0) {
    const teachersToInsert = origTeachers.map((t) => ({
      course_id: newCourse.id,
      teacher_id: t.teacher_id,
      role: t.role,
    }));

    const { error: teachErr } = await supabase
      .from("curso_profesores")
      .insert(teachersToInsert);

    if (teachErr) {
      console.error("[copyCourseAction] Error al copiar profesores:", teachErr.message);
    }
  }

  revalidatePath("/erp/cursos");
  return { success: true, newCourseId: newCourse.id };
}

export async function updateModuleAction(payload: {
  id: string;
  courseId: string;
  number: number;
  name: string;
  cost: number;
  description?: string | null;
  date?: string | null;
}) {
  await assertWritePermission("/erp/cursos");

  const { id, courseId, number, name, cost, description, date } = payload;

  if (!id || !courseId || !name || isNaN(number) || isNaN(cost)) {
    throw new Error("Datos de módulo inválidos.");
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("curso_modulos")
    .update({
      number,
      name,
      cost,
      description: description || null,
      start_date: date || null,
      end_date: date || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Error al actualizar el módulo.");
  }

  revalidatePath(`/erp/cursos/${courseId}`);
  return { success: true };
}

export async function createCourseAction(formData: FormData) {
  await assertWritePermission("/erp/cursos");

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const totalCost = Number(formData.get("totalCost"));
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const maxStudents = formData.get("maxStudents") ? Number(formData.get("maxStudents")) : null;
  const status = formData.get("status") as string;
  const imageFile = formData.get("imageFile") as File;

  if (!name || !startDate || !endDate || isNaN(totalCost)) {
    throw new Error("Por favor completa los campos requeridos.");
  }

  const supabase = createAdminClient();
  let imageUrl: string | null = null;

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
  return { success: true, courseId: newCourse.id };
}
