import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Retorna la fecha de hoy en Ecuador en formato YYYY-MM-DD
 */
export function getEcuadorDateString(offsetDays: number = 0): string {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  return d.toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
}

/**
 * Automáticamente actualiza los estados de los cursos según sus fechas:
 * - 'active' (Abierto) -> 'in_progress' (En Ejecución) cuando start_date <= hoy y end_date >= hoy.
 * - 'active' o 'in_progress' -> 'completed' (Finalizado) cuando end_date < hoy.
 */
export async function updateExpiredCourses(supabase: SupabaseClient): Promise<void> {
  try {
    const todayStr = getEcuadorDateString();

    // 1. Cursos abiertos que ya iniciaron -> 'in_progress'
    const { error: err1 } = await supabase
      .from("cursos")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("status", "active")
      .lte("start_date", todayStr)
      .gte("end_date", todayStr);

    if (err1) {
      console.error("[courses-auto-update] Error al pasar a in_progress:", err1.message);
    }

    // 2. Cursos abiertos o en ejecución que ya terminaron -> 'completed'
    const { error: err2 } = await supabase
      .from("cursos")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .in("status", ["active", "in_progress"])
      .lt("end_date", todayStr);

    if (err2) {
      console.error("[courses-auto-update] Error al pasar a completed:", err2.message);
    }
  } catch (err) {
    console.error("[courses-auto-update] Excepción atrapada:", err);
  }
}

/**
 * Retorna la fecha límite de visibilidad pública para cursos finalizados.
 * Cursos finalizados hace más de 14 días (2 semanas) dejan de mostrarse públicamente.
 */
export function getPublicCourseVisibilityCutoffDate(): string {
  return getEcuadorDateString(-14);
}

/**
 * Garantiza que cada inscripción a un curso tenga registrados todos los módulos existentes
 * en la tabla `curso_modulo_inscripciones`.
 * Si se crearon nuevos módulos después de que el alumno se inscribió, esta función los detecta
 * e inserta automáticamente las inscripciones faltantes.
 */
export async function syncMissingModuleInscriptions(
  supabase: SupabaseClient,
  filter?: { studentId?: string; courseId?: string; enrollmentId?: string }
): Promise<{ insertedCount: number }> {
  try {
    let enrollQuery = supabase
      .from("curso_inscripciones")
      .select("id, course_id, status");

    if (filter?.enrollmentId) {
      enrollQuery = enrollQuery.eq("id", filter.enrollmentId);
    } else {
      if (filter?.studentId) {
        enrollQuery = enrollQuery.eq("student_id", filter.studentId);
      }
      if (filter?.courseId) {
        enrollQuery = enrollQuery.eq("course_id", filter.courseId);
      }
    }

    // Excluir alumnos retirados del curso
    enrollQuery = enrollQuery.neq("status", "dropped");

    const { data: enrollments, error: enrollErr } = await enrollQuery;
    if (enrollErr || !enrollments || enrollments.length === 0) {
      return { insertedCount: 0 };
    }

    const courseIds = Array.from(new Set(enrollments.map((e) => e.course_id)));
    const enrollmentIds = enrollments.map((e) => e.id);

    // Obtener todos los módulos actuales de estos cursos
    const { data: allModules, error: modErr } = await supabase
      .from("curso_modulos")
      .select("id, course_id, number")
      .in("course_id", courseIds);

    if (modErr || !allModules || allModules.length === 0) {
      return { insertedCount: 0 };
    }

    // Obtener inscripciones de módulo ya existentes
    const { data: existingInscriptions, error: existErr } = await supabase
      .from("curso_modulo_inscripciones")
      .select("enrollment_id, module_id")
      .in("enrollment_id", enrollmentIds);

    if (existErr) {
      console.error("[syncMissingModuleInscriptions] Error consultando inscripciones existentes:", existErr.message);
      return { insertedCount: 0 };
    }

    const existingSet = new Set(
      (existingInscriptions || []).map((ei: any) => `${ei.enrollment_id}_${ei.module_id}`)
    );

    const toInsert: { enrollment_id: string; module_id: string; billing_status: string }[] = [];

    for (const enroll of enrollments) {
      const courseMods = allModules.filter((m) => m.course_id === enroll.course_id);
      for (const mod of courseMods) {
        const key = `${enroll.id}_${mod.id}`;
        if (!existingSet.has(key)) {
          toInsert.push({
            enrollment_id: enroll.id,
            module_id: mod.id,
            billing_status: "pending",
          });
        }
      }
    }

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase
        .from("curso_modulo_inscripciones")
        .insert(toInsert);

      if (insErr) {
        console.error("[syncMissingModuleInscriptions] Error insertando módulos faltantes:", insErr.message);
        return { insertedCount: 0 };
      }
    }

    return { insertedCount: toInsert.length };
  } catch (err: any) {
    console.error("[syncMissingModuleInscriptions] Excepción:", err.message);
    return { insertedCount: 0 };
  }
}

