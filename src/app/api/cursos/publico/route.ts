import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateExpiredCourses, getPublicCourseVisibilityCutoffDate } from "@/lib/courses";

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Auto-actualizar estados de cursos
    await updateExpiredCourses(supabase);
    const cutoffDate = getPublicCourseVisibilityCutoffDate();

    const { data: rawCourses, error } = await supabase
      .from("cursos")
      .select("id, name, start_date, end_date, status")
      .in("status", ["active", "in_progress", "completed"])
      .order("start_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Error al obtener los cursos" }, { status: 500 });
    }

    const courses = (rawCourses || []).filter((c) => {
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
