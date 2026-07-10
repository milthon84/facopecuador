import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const supabase = createAdminClient();

    const { data: course, error } = await supabase
      .from("cursos")
      .select("id, name, description, total_cost, start_date, end_date, image_url, status")
      .eq("id", courseId)
      .eq("status", "active")
      .single();

    if (error || !course) {
      return NextResponse.json({ error: "Curso no encontrado o inactivo" }, { status: 404 });
    }

    return NextResponse.json({ course });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
