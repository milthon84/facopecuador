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
