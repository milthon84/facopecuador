import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateExpiredCourses, getPublicCourseVisibilityCutoffDate } from "@/lib/courses";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const supabase = createAdminClient();

    await updateExpiredCourses(supabase);
    const cutoffDate = getPublicCourseVisibilityCutoffDate();

    let { data: course, error } = await supabase
      .from("cursos")
      .select("id, name, description, total_cost, start_date, end_date, image_url, brochure_url, status")
      .eq("id", courseId)
      .single();

    if (error && error.message?.includes("brochure_url")) {
      const fallback = await supabase
        .from("cursos")
        .select("id, name, description, total_cost, start_date, end_date, image_url, status")
        .eq("id", courseId)
        .single();
      course = fallback.data ? { ...fallback.data, brochure_url: null } : null;
      error = fallback.error;
    }

    if (error || !course) {
      return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
    }

    if (["draft", "cancelled"].includes(course.status)) {
      return NextResponse.json({ error: "El curso no está publicado." }, { status: 404 });
    }

    if (course.status === "completed" && course.end_date < cutoffDate) {
      return NextResponse.json({ error: "El curso ha finalizado y ha expirado su visibilidad." }, { status: 404 });
    }

    return NextResponse.json({ course });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
