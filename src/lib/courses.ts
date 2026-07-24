import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Retorna la fecha de hoy en Ecuador en formato YYYY-MM-DD
 */
export function getEcuadorDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
}

/**
 * Automáticamente actualiza a 'completed' los cursos en estado 'active' cuya fecha de fin ya pasó.
 * Corre de manera pasiva en los fetch principales para asegurar consistencia en tiempo real.
 */
export async function updateExpiredCourses(supabase: SupabaseClient): Promise<void> {
  try {
    const todayStr = getEcuadorDateString();
    
    // Ejecutar actualización rápida en la DB
    const { error } = await supabase
      .from("cursos")
      .update({ status: "completed" })
      .eq("status", "active")
      .lt("end_date", todayStr);

    if (error) {
      console.error("[courses-auto-complete] Error ejecutando update:", error.message);
    }
  } catch (err) {
    console.error("[courses-auto-complete] Excepción atrapada:", err);
  }
}
