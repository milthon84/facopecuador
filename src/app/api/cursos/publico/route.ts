import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateExpiredCourses, getPublicCourseVisibilityCutoffDate } from "@/lib/courses";

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Auto-actualizar estados de cursos
    await updateExpiredCourses(supabase);
    const cutoffDate = getPublicCourseVisibilityCutoffDate();

    let rawCourses: any[] | null = null;
    let { data: initialCourses, error } = await supabase
      .from("cursos")
      .select("id, name, description, total_cost, start_date, end_date, image_url, brochure_url, status")
      .in("status", ["active", "in_progress", "completed"])
      .order("start_date", { ascending: true });

    // Fallback defensivo si la columna brochure_url aún no fue creada en la BD
    if (error && error.message?.includes("brochure_url")) {
      const fallback = await supabase
        .from("cursos")
        .select("id, name, description, total_cost, start_date, end_date, image_url, status")
        .in("status", ["active", "in_progress", "completed"])
        .order("start_date", { ascending: true });
      rawCourses = (fallback.data || []).map((c: any) => ({ ...c, brochure_url: null }));
      error = fallback.error;
    } else {
      rawCourses = initialCourses;
    }

    if (error) {
      return NextResponse.json({ error: "Error al obtener los cursos" }, { status: 500 });
    }

    const courses = (rawCourses || []).map((c: any) => ({
      ...c,
      brochure_url: c.brochure_url || null,
    })).filter((c: any) => {
      if (c.status === "completed") {
        return c.end_date >= cutoffDate;
      }
      return true;
    });

    return NextResponse.json({ courses });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
