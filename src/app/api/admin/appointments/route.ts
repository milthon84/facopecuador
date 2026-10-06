import { getSessionUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { logAudit, getIpFromRequest } from "@/lib/audit";
import type { UserRole } from "@/lib/roles";
import { sendReminderEmail } from "@/lib/email";

export async function PATCH(req: Request) {
  const user = await getSessionUser(req);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const role = (user.app_metadata?.role as string) ?? "recepcionista";
  if (role !== "admin") {
    const { data } = await adminClient
      .from("role_permissions")
      .select("path")
      .eq("role_name", role);
    const paths = (data || []).map((p: any) => p.path);
    if (!paths.includes("/erp/calendario/modificar") && !paths.includes("/erp/modificar")) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const { id, status, doctor_id, extra } = body;

    if (!id) {
      return NextResponse.json({ error: "id es requerido" }, { status: 400 });
    }

    if (!status && doctor_id === undefined && !extra) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    // Obtener estado anterior para auditoría
    const { data: prevAppt } = await adminClient
      .from("appointments")
      .select("status, patient_id, doctor_id")
      .eq("id", id)
      .single();

    const updateData: Record<string, any> = {};
    if (status) updateData.status = status;
    if (doctor_id !== undefined) updateData.doctor_id = doctor_id || null;
    if (extra) Object.assign(updateData, extra);

    const { data: updatedAppt, error } = await adminClient
      .from("appointments")
      .update(updateData)
      .eq("id", id)
      .select("patient_id, doctor_id, status")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Registrar auditoría
    const action = status === "cancelled" ? "cancel" : "update";
    const actionLabels: Record<string, string> = {
      cancelled: "Cita cancelada",
      attended:  "Cita marcada como atendida",
      no_show:   "Cita marcada como no asistió",
      scheduled: "Cita reprogramada",
    };
    
    let description = status ? (actionLabels[status] || `Cita actualizada: ${status}`) : "Cita actualizada";
    if (doctor_id !== undefined && prevAppt?.doctor_id !== doctor_id) {
      description = doctor_id ? "Doctor asignado a la cita" : "Doctor desasignado de la cita";
    }

    await logAudit({
      user_id: user.id,
      user_email: user.email,
      user_role: (user.app_metadata?.role as UserRole) ?? null,
      action,
      resource: "appointment",
      resource_id: id,
      description,
      metadata: {
        previous_status: prevAppt?.status,
        new_status: status || prevAppt?.status,
        previous_doctor_id: prevAppt?.doctor_id,
        new_doctor_id: doctor_id,
        ...(extra || {}),
      },
      ip_address: getIpFromRequest(req),
    });

    // Invalidar caché
    try {
      revalidatePath("/erp");
      revalidatePath("/erp/calendario");
      revalidatePath(`/erp/citas/${id}`);
      revalidatePath("/erp/pacientes");
      if (updatedAppt?.patient_id) {
        revalidatePath(`/erp/pacientes/${updatedAppt.patient_id}`);
      }
    } catch { /* ignorar */ }

    return NextResponse.json({ success: true, appointment: updatedAppt });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Error al procesar la actualización" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const role = (user.app_metadata?.role as string) ?? "recepcionista";
  if (role !== "admin") {
    const { data } = await adminClient
      .from("role_permissions")
      .select("path")
      .eq("role_name", role);
    const paths = (data || []).map((p: any) => p.path);
    if (!paths.includes("/erp/calendario/modificar") && !paths.includes("/erp/modificar")) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "id es requerido" }, { status: 400 });
    }

    // Obtener la cita y datos del paciente
    const { data: appt, error: fetchErr } = await adminClient
      .from("appointments")
      .select("id, starts_at, reason, patient:patients(full_name, email)")
      .eq("id", id)
      .single();

    if (fetchErr || !appt) {
      return NextResponse.json({ error: "Cita no encontrada o desasociada" }, { status: 404 });
    }

    const patient = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;
    if (!patient || !patient.email) {
      return NextResponse.json({ error: "El paciente no tiene un correo configurado" }, { status: 400 });
    }

    // Enviar el correo
    await sendReminderEmail({
      patientName: patient.full_name,
      patientEmail: patient.email,
      startsAt: appt.starts_at,
      reason: appt.reason,
      appointmentId: appt.id,
    });

    // Actualizar reminder_sent_at en la base de datos
    const { error: updateErr } = await adminClient
      .from("appointments")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", id);

    if (updateErr) {
      console.warn("⚠️ No se pudo registrar la fecha de envío del recordatorio en la base de datos:", updateErr.message);
    }

    // Registrar auditoría
    await logAudit({
      user_id: user.id,
      user_email: user.email,
      user_role: (user.app_metadata?.role as UserRole) ?? null,
      action: "update",
      resource: "appointment",
      resource_id: id,
      description: "Recordatorio de cita enviado manualmente",
      metadata: {
        recipient: patient.email,
      },
      ip_address: getIpFromRequest(req),
    });

    // Invalidar caché
    try {
      revalidatePath("/admin");
      revalidatePath("/admin/calendario");
      revalidatePath(`/admin/citas/${id}`);
    } catch { /* ignorar */ }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Error al enviar el recordatorio" }, { status: 500 });
  }
}

