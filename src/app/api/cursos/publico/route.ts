import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: courses, error } = await supabase
      .from("cursos")
      .select("id, name, start_date, end_date")
      .eq("status", "active")
      .order("start_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Error al obtener los cursos" }, { status: 500 });
    }

    return NextResponse.json({ courses: courses || [] });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
