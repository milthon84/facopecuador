import { getSessionUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function GET(req: Request) {
  const user = await getSessionUser(req);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patient_id");

  if (!patientId) {
    return NextResponse.json({ error: "Falta patient_id" }, { status: 400 });
  }

  const { data: record, error } = await supabase
    .from("dental_records")
    .select("*")
    .eq("patient_id", patientId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 is postgrest error for no rows returned, which is fine (first clinical record)
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ record: record || null });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser(req);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const role = (user.app_metadata?.role as string) ?? "recepcionista";
  if (role !== "admin") {
    const { data } = await supabase
      .from("role_permissions")
      .select("path")
      .eq("role_name", role);
    const paths = (data || []).map((p: any) => p.path);
    if (!paths.includes("/erp/pacientes/modificar")) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const {
      patient_id,
      date_of_birth,
      sex,
      address,
      medical_history,
      stomatognathic_exam,
      odontogram_state,
    } = body;

    if (!patient_id) {
      return NextResponse.json({ error: "Falta patient_id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("dental_records")
      .upsert(
        {
          patient_id,
          date_of_birth: date_of_birth || null,
          sex: sex || null,
          address: address || null,
          medical_history: medical_history || {},
          stomatognathic_exam: stomatognathic_exam || {},
          odontogram_state: odontogram_state || {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "patient_id" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Invalidar caché de Next.js para que todas las vistas de pacientes se actualicen
    try {
      revalidatePath("/admin/pacientes");
      revalidatePath(`/admin/pacientes/${patient_id}`);
    } catch (cacheError) {
      console.error("Error al revalidar en edición directa de ficha:", cacheError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Error al actualizar la ficha dental" }, { status: 500 });
  }
}

