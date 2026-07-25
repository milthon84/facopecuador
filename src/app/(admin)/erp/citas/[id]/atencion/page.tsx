import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import AtencionClientPage from "./AtencionClientPage";
import { assertWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

export default async function AtencionPage({ params }: { params: Promise<{ id: string }> }) {
  await assertWritePermission("/erp/pacientes");
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: appt } = await supabase
    .from("appointments")
    .select("*, patient:patients(*)")
    .eq("id", id)
    .single();

  if (!appt) return notFound();

  const patient = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;

  // Buscar consulta previa si existe (para edición)
  const { data: consultation } = await supabase
    .from("dental_consultations")
    .select("*")
    .eq("appointment_id", appt.id)
    .single();

  // Buscar historial de consultas pasadas y fotos del paciente para referencia clínica
  const [pastConsultationsRes, photosRes] = await Promise.all([
    supabase
      .from("dental_consultations")
      .select("*")
      .eq("patient_id", patient.id)
      .neq("appointment_id", appt.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("patient_photos")
      .select("*")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
  ]);

  return (
    <AtencionClientPage
      appointment={appt}
      patient={patient}
      initialConsultation={consultation || null}
      pastConsultations={pastConsultationsRes.data || []}
      patientPhotos={photosRes.data || []}
    />
  );
}
