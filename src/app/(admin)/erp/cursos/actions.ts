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

  // 1. Verificar si ya existe un registro de inscripción para este alumno y curso
  const { data: existingEnrollment } = await supabase
    .from("curso_inscripciones")
    .select("id, status")
    .eq("course_id", courseId)
    .eq("student_id", studentId)
    .maybeSingle();

  let enrollmentId: string;

  if (existingEnrollment) {
    // Si ya está activo como matriculado
    if (existingEnrollment.status === "enrolled") {
      throw new Error("El alumno ya se encuentra matriculado en este curso.");
    }

    // Si estaba retirado ('dropped') o cancelado, reactivar su inscripción
    const { error: updateError } = await supabase
      .from("curso_inscripciones")
      .update({
        status: "enrolled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingEnrollment.id);

    if (updateError) {
      throw new Error(parseDbError(updateError.message));
    }
    enrollmentId = existingEnrollment.id;
  } else {
    // Si es una nueva inscripción
    const { data: newEnrollment, error: enrollError } = await supabase
      .from("curso_inscripciones")
      .insert({
        course_id: courseId,
        student_id: studentId,
        status: "enrolled",
      })
      .select("id")
      .single();

    if (enrollError || !newEnrollment) {
      throw new Error(parseDbError(enrollError?.message));
    }
    enrollmentId = newEnrollment.id;
  }

  // 2. Garantizar que todos los módulos del curso estén inscritos para el alumno
  const { data: modules } = await supabase
    .from("curso_modulos")
    .select("id")
    .eq("course_id", courseId);

  if (modules && modules.length > 0) {
    const { data: existingModuleInscriptions } = await supabase
      .from("curso_modulo_inscripciones")
      .select("module_id")
      .eq("enrollment_id", enrollmentId);

    const existingModIds = new Set((existingModuleInscriptions || []).map((m: any) => m.module_id));
    const missingModules = modules.filter((m) => !existingModIds.has(m.id));

    if (missingModules.length > 0) {
      const moduleInscriptions = missingModules.map((m) => ({
        enrollment_id: enrollmentId,
        module_id: m.id,
        billing_status: "pending",
      }));
      await supabase.from("curso_modulo_inscripciones").insert(moduleInscriptions);
    }
  }

  revalidatePath(`/erp/cursos/${courseId}`);
  revalidatePath("/erp/cursos/alumnos");
  return { success: true, enrollmentId };
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

  // 1. Buscar al alumno en el sistema por su CÉDULA / RUC / PASAPORTE (Identificador único primario)
  const { data: existingStudent } = await supabase
    .from("alumnos")
    .select("id, full_name, email, document_number")
    .eq("document_number", docTrimmed)
    .maybeSingle();

  if (existingStudent) {
    studentId = existingStudent.id;
    // Si la Cédula ya existe en la base de datos, actualizar sus datos personales
    const { error: updateError } = await supabase
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

    if (updateError && (updateError.message.includes("alumnos_email_key") || updateError.message.includes("email"))) {
      await supabase
        .from("alumnos")
        .update({
          full_name: data.fullName.trim(),
          phone: data.phone.trim(),
          document_number: docTrimmed,
          professional_title: data.professionalTitle?.trim() || null,
          notes: data.notes?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", studentId);
    }
  } else {
    // Si la Cédula es totalmente nueva, crear la ficha del alumno
    let { data: newStudent, error: studentError } = await supabase
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

    // Si existe una restricción de email único en la BD que colisione con otro registro previo,
    // reintentar con una variación válida basada en su Cédula para no bloquear la matrícula
    if (studentError && (studentError.message.includes("alumnos_email_key") || studentError.message.includes("email"))) {
      const parts = emailTrimmed.split("@");
      const fallbackEmail = parts.length === 2 ? `${parts[0]}+${docTrimmed}@${parts[1]}` : `${docTrimmed}@noemail.local`;

      const { data: retryStudent, error: retryError } = await supabase
        .from("alumnos")
        .insert({
          full_name: data.fullName.trim(),
          document_number: docTrimmed,
          phone: data.phone.trim(),
          email: fallbackEmail,
          professional_title: data.professionalTitle?.trim() || null,
          notes: data.notes?.trim() || null,
        })
        .select("id")
        .single();

      if (retryError || !retryStudent) {
        throw new Error(parseDbError(retryError?.message));
      }
      newStudent = retryStudent;
      studentError = null;
    } else if (studentError || !newStudent) {
      throw new Error(parseDbError(studentError?.message));
    }

    studentId = newStudent.id;
  }

  // 2. Inscribir o Reactivar la matrícula en el curso
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
      .select("id, billing_status, invoices(invoice_number, invoice_items(description)), curso_inscripciones(status, payment_type, alumnos(id, full_name, document_number, phone, email))")
      .eq("module_id", moduleId);

    const students = (moduleInscriptions || [])
      .map((mi: any) => {
        const student = mi.curso_inscripciones?.alumnos;
        if (!student) return null;

        const items = mi.invoices?.invoice_items || [];
        const isInscriptionInvoice = Array.isArray(items) && items.some((item: any) =>
          item.description?.toLowerCase().includes("inscripción") || item.description?.toLowerCase().includes("inscripcion")
        );
        const isFullCourse = mi.curso_inscripciones?.payment_type === "full_course";

        let status = mi.billing_status as string;
        if (isFullCourse) {
          status = "invoiced";
        } else if (status === "invoiced" && isInscriptionInvoice) {
          status = "pending";
        }

        return {
          moduloInscripcionId: mi.id,
          billingStatus: status,
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

export async function registerNoFiscalEnrollmentAction(enrollmentId: string, courseId?: string) {
  await assertWritePermission("/erp/cursos");
  if (!enrollmentId) throw new Error("ID de inscripción requerido.");

  const supabase = createAdminClient();

  // 1. Intentar actualizar el tipo de pago a "no_fiscal"
  let { error: enrollError } = await supabase
    .from("curso_inscripciones")
    .update({ payment_type: "no_fiscal", updated_at: new Date().toISOString() })
    .eq("id", enrollmentId);

  // Fallback si la restricción CHECK de Postgres 'curso_inscripciones_payment_type_check' no incluye 'no_fiscal'
  if (enrollError && (enrollError.message.includes("payment_type") || enrollError.message.includes("check"))) {
    const { error: fallbackError } = await supabase
      .from("curso_inscripciones")
      .update({ payment_type: "full_course", updated_at: new Date().toISOString() })
      .eq("id", enrollmentId);

    enrollError = fallbackError;
  }

  // 2. Actualizar la cuota de inscripción / primer módulo a 'free' (Pagado SF), manteniendo los siguientes módulos en 'pending' para su cobro por módulo
  const { data: moduleInscriptions } = await supabase
    .from("curso_modulo_inscripciones")
    .select("id")
    .eq("enrollment_id", enrollmentId)
    .order("id", { ascending: true });

  if (moduleInscriptions && moduleInscriptions.length > 0) {
    const firstModuleId = moduleInscriptions[0].id;
    await supabase
      .from("curso_modulo_inscripciones")
      .update({ billing_status: "free", updated_at: new Date().toISOString() })
      .eq("id", firstModuleId);
  }

  if (courseId) {
    revalidatePath(`/erp/cursos/${courseId}`);
  }
  revalidatePath("/erp/cursos/alumnos");
  revalidatePath("/erp/cursos");
  return { success: true };
}

export async function registerNoFiscalModuleAction(moduleInscriptionId: string, courseId?: string) {
  await assertWritePermission("/erp/cursos");
  if (!moduleInscriptionId) throw new Error("ID de inscripción a módulo requerido.");

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("curso_modulo_inscripciones")
    .update({ billing_status: "free", updated_at: new Date().toISOString() })
    .eq("id", moduleInscriptionId);

  if (error) {
    throw new Error(parseDbError(error.message));
  }

  if (courseId) {
    revalidatePath(`/erp/cursos/${courseId}`);
  }
  revalidatePath("/erp/cursos/alumnos");
  revalidatePath("/erp/cursos/clases");
  revalidatePath("/erp/cursos");
  return { success: true };
}
