"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertWritePermission } from "@/lib/auth-action";
import { revalidatePath } from "next/cache";
import { parseDbError } from "@/lib/db-error-parser";

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
  teacherIds?: string[];
}) {
  await assertWritePermission("/erp/cursos");

  const { id, courseId, number, name, cost, description, date, teacherIds } = payload;

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

  // Actualizar asignaciones de profesores del módulo
  if (teacherIds !== undefined) {
    try {
      await supabase.from("modulo_profesores").delete().eq("module_id", id);
      if (teacherIds.length > 0) {
        const inserts = teacherIds.map((tId) => ({
          module_id: id,
          teacher_id: tId,
        }));
        const { error: insErr } = await supabase.from("modulo_profesores").insert(inserts);
        if (insErr) {
          console.error("[updateModuleAction] Error al asignar profesores:", insErr.message);
        }
      }
    } catch (e: any) {
      console.error("[updateModuleAction] Excepción al guardar profesores del módulo:", e.message);
    }
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
  const endDate = (formData.get("endDate") as string) || startDate;
  const maxStudents = formData.get("maxStudents") ? Number(formData.get("maxStudents")) : null;
  const status = formData.get("status") as string;
  const imageFile = formData.get("imageFile") as File;

  if (!name || !startDate || !endDate || isNaN(totalCost)) {
    throw new Error("Por favor completa los campos requeridos.");
  }

  if (endDate < startDate) {
    throw new Error("La fecha de finalización no puede ser anterior a la fecha de inicio.");
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
    throw new Error(parseDbError(error?.message) || "Error al crear el curso");
  }

  revalidatePath("/erp/cursos");
  return { success: true, courseId: newCourse.id };
}

export async function updateCourseAction(payload: {
  id: string;
  name: string;
  description?: string | null;
  totalCost: number;
  maxStudents?: number | null;
  startDate: string;
  endDate: string;
  status: string;
}) {
  await assertWritePermission("/erp/cursos");
  const { id, name, description, totalCost, maxStudents, startDate, endDate, status } = payload;

  if (!id || !name || isNaN(totalCost)) {
    throw new Error("Datos de curso inválidos.");
  }

  if (endDate < startDate) {
    throw new Error("La fecha de finalización no puede ser anterior a la fecha de inicio.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("cursos")
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      total_cost: totalCost,
      max_students: maxStudents || null,
      start_date: startDate,
      end_date: endDate,
      status: status || "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(parseDbError(error.message) || "Error al actualizar el curso.");
  }

  revalidatePath(`/erp/cursos/${id}`);
  revalidatePath("/erp/cursos");
  return { success: true };
}

export async function updateCourseStatusAction(courseId: string, status: string) {
  await assertWritePermission("/erp/cursos");
  if (!courseId || !status) throw new Error("Parámetros requeridos faltantes.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("cursos")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);

  if (error) throw new Error(parseDbError(error.message));

  revalidatePath(`/erp/cursos/${courseId}`);
  revalidatePath("/erp/cursos");
  return { success: true };
}

export async function enrollStudentInCourseAction(studentId: string, courseId: string) {
  await assertWritePermission("/erp/cursos");
  if (!studentId || !courseId) throw new Error("Parámetros requeridos faltantes.");

  const supabase = createAdminClient();
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
    throw new Error(parseDbError(enrollError.message));
  }

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

  revalidatePath(`/erp/cursos/${courseId}`);
  revalidatePath("/erp/cursos/alumnos");
  return { success: true };
}

export async function registerAndEnrollStudentAction(data: {
  fullName: string;
  documentNumber: string;
  phone: string;
  email: string;
  professionalTitle?: string;
  notes?: string;
  courseId: string;
}) {
  await assertWritePermission("/erp/cursos");
  if (!data.fullName || !data.documentNumber || !data.phone || !data.email || !data.courseId) {
    throw new Error("Por favor completa los datos obligatorios del alumno.");
  }

  const supabase = createAdminClient();

  const docTrimmed = data.documentNumber.trim();
  const emailTrimmed = data.email.trim();

  let studentId: string;

  // 1. Buscar si el alumno ya existe registrado en el sistema (por cédula o email)
  const { data: existingStudent } = await supabase
    .from("alumnos")
    .select("id")
    .or(`document_number.eq.${docTrimmed},email.eq.${emailTrimmed}`)
    .limit(1)
    .maybeSingle();

  if (existingStudent) {
    studentId = existingStudent.id;
    // Actualizar sus datos personales
    await supabase
      .from("alumnos")
      .update({
        full_name: data.fullName.trim(),
        phone: data.phone.trim(),
        email: emailTrimmed,
        document_number: docTrimmed,
        professional_title: data.professionalTitle?.trim() || null,
        notes: data.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", studentId);
  } else {
    // 2. Si es un alumno completamente nuevo en la base general, insertarlo
    const { data: newStudent, error: studentError } = await supabase
      .from("alumnos")
      .insert({
        full_name: data.fullName.trim(),
        document_number: docTrimmed,
        phone: data.phone.trim(),
        email: emailTrimmed,
        professional_title: data.professionalTitle?.trim() || null,
        notes: data.notes?.trim() || null,
      })
      .select("id")
      .single();

    if (studentError || !newStudent) {
      throw new Error(parseDbError(studentError?.message));
    }
    studentId = newStudent.id;
  }

  // 3. Inscribir en el curso solicitado
  await enrollStudentInCourseAction(studentId, data.courseId);

  return { success: true, studentId };
}

export async function getModuleAttendanceDataAction(moduleId: string) {
  try {
    const supabase = createAdminClient();

    const { data: moduleInfo } = await supabase
      .from("curso_modulos")
      .select("*, cursos(name)")
      .eq("id", moduleId)
      .single();

    if (!moduleInfo) throw new Error("Módulo no encontrado.");

    const { data: modTeachers } = await supabase
      .from("modulo_profesores")
      .select("profesores(full_name, specialty)")
      .eq("module_id", moduleId);

    const { data: moduleInscriptions } = await supabase
      .from("curso_modulo_inscripciones")
      .select("id, billing_status, curso_inscripciones(status, alumnos(id, full_name, document_number, phone, email))")
      .eq("module_id", moduleId);

    const students = (moduleInscriptions || [])
      .map((mi: any) => {
        const student = mi.curso_inscripciones?.alumnos;
        if (!student) return null;
        return {
          moduloInscripcionId: mi.id,
          billingStatus: mi.billing_status as string,
          enrollmentStatus: mi.curso_inscripciones.status as string,
          studentId: student.id,
          fullName: student.full_name,
          documentNumber: student.document_number,
          phone: student.phone,
          email: student.email,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.fullName.localeCompare(b.fullName));

    return {
      success: true,
      courseName: moduleInfo.cursos?.name || "Curso",
      moduleNumber: moduleInfo.number,
      moduleName: moduleInfo.name,
      moduleDate: moduleInfo.start_date,
      teachers: (modTeachers || []).map((t: any) => t.profesores).filter(Boolean),
      students,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateModuleBillingStatusAction(moduloInscripcionId: string, billingStatus: string, moduleId: string) {
  await assertWritePermission("/erp/cursos");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("curso_modulo_inscripciones")
    .update({ billing_status: billingStatus, updated_at: new Date().toISOString() })
    .eq("id", moduloInscripcionId);

  if (error) throw new Error(error.message);

  revalidatePath(`/erp/cursos`);
  return { success: true };
}
