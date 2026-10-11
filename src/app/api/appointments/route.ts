import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendConfirmationEmail, sendAdminNotification } from "@/lib/email";

const schema = z.object({
  // Puede venir anidado en patient o plano a primer nivel para herramientas como n8n
  patient: z.object({
    document_number: z.string().min(3),
    full_name: z.string().min(3),
    phone: z.string().min(7),
    email: z.string().email().optional().or(z.literal("")),
  }).optional(),
  // Campos planos alternativos (ideales para n8n AI Tools):
  document_number: z.string().min(3).optional(),
  full_name: z.string().min(3).optional(),
  phone: z.string().min(7).optional(),
  email: z.string().optional(),

  starts_at: z.string(),
  ends_at: z.string(),
  reason: z.string().nullable().optional(),
  doctor_id: z.string().uuid().nullable().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const parse = schema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parse.error.issues }, { status: 400 });
  }
  
  const rawData = parse.data;
  
  // Normalizar datos del paciente soportando plano o anidado
  const docNumber = rawData.patient?.document_number || rawData.document_number;
  const fullName = rawData.patient?.full_name || rawData.full_name;
  const phone = rawData.patient?.phone || rawData.phone;
  let email = (rawData.patient?.email || rawData.email || "").trim();

  if (!docNumber || !fullName || !phone) {
    return NextResponse.json(
      { error: "Datos del paciente incompletos. Se requiere cédula/documento, nombre completo y teléfono." },
      { status: 400 }
    );
  }

  // Si no se proporcionó email válido, asignar email por defecto para registro
  if (!email || !email.includes("@")) {
    email = `${docNumber}@paciente.facop.com.ec`;
  }

  const patient = {
    document_number: docNumber,
    full_name: fullName,
    phone,
    email,
  };

  const { starts_at, ends_at, reason, doctor_id } = rawData;

  const startsDate = new Date(starts_at);
  if (isNaN(startsDate.getTime())) {
    return NextResponse.json({ error: "Horario inválido" }, { status: 400 });
  }

  // Si no es personal de la clínica autenticado, no permitir agendar en el pasado
  const { getSessionUser } = await import("@/lib/supabase/auth");
  const user = await getSessionUser(req);
  const isClinicStaff = !!user && (user.app_metadata?.role === "admin" || user.app_metadata?.role === "recepcionista");

  if (!isClinicStaff && startsDate.getTime() < Date.now()) {
    return NextResponse.json({ error: "No se puede agendar citas en el pasado" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1) Verificar que el slot sigue disponible
  const { data: existing } = await supabase
    .from("appointments")
    .select("id")
    .eq("starts_at", starts_at)
    .neq("status", "cancelled")
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Ese horario ya fue tomado" }, { status: 409 });
  }

  // 2) Upsert del paciente (únicamente por cédula)
  const emailLower = patient.email.toLowerCase();
  const { data: existingPatient } = await supabase
    .from("patients")
    .select("id")
    .eq("document_number", patient.document_number.trim())
    .maybeSingle();

  let patientId: string;
  if (existingPatient) {
    const { error: updErr } = await supabase
      .from("patients")
      .update({
        full_name: patient.full_name,
        phone: patient.phone,
        email: emailLower,
      })
      .eq("id", existingPatient.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    patientId = existingPatient.id;
  } else {
    const { data: newPatient, error: insErr } = await supabase
      .from("patients")
      .insert({
        full_name: patient.full_name,
        phone: patient.phone,
        email: emailLower,
        document_number: patient.document_number.trim(),
      })
      .select("id")
      .single();
    if (insErr || !newPatient) return NextResponse.json({ error: insErr?.message || "Error al registrar el paciente" }, { status: 500 });
    patientId = newPatient.id;
  }

  // 3) Crear la cita (solo el personal puede asignar doctor; pacientes públicos no asignan doctor)
  const assignedDoctorId = isClinicStaff && doctor_id ? doctor_id : null;

  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .insert({
      patient_id: patientId,
      starts_at,
      ends_at,
      reason: reason || null,
      status: "scheduled",
      doctor_id: assignedDoctorId,
    })
    .select("id")
    .single();

  if (apptErr || !appt) {
    if (apptErr?.code === "23505") {
      return NextResponse.json({ error: "Ese horario ya fue tomado" }, { status: 409 });
    }
    return NextResponse.json({ error: apptErr?.message || "Error al crear" }, { status: 500 });
  }

  // 4) Enviar emails (no bloqueamos la respuesta si fallan)
  try {
    await Promise.all([
      sendConfirmationEmail({
        patientName: patient.full_name,
        patientEmail: emailLower,
        startsAt: starts_at,
        reason,
        appointmentId: appt.id,
      }),
      sendAdminNotification({
        patientName: patient.full_name,
        patientEmail: emailLower,
        startsAt: starts_at,
        reason,
        appointmentId: appt.id,
        phone: patient.phone,
        document: patient.document_number,
      }),
    ]);
  } catch (e) {
    console.error("Email error:", e);
  }

  return NextResponse.json({ appointment_id: appt.id });
}
