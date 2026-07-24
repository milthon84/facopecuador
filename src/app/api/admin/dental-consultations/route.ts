import { getSessionUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { sendDentalConsultationEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  const user = await getSessionUser(req);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const {
      appointment_id,
      patient_id,
      date_of_birth,
      sex,
      address,
      medical_history,
      stomatognathic_exam,
      odontogram_state,
      treatment_notes,
      prescription,
      dentition_mode,
    } = body;

    if (!appointment_id || !patient_id || !treatment_notes) {
      return NextResponse.json({ error: "Campos requeridos faltantes (appointment_id, patient_id o treatment_notes)" }, { status: 400 });
    }

    // 1) Upsert permanent dental record for the patient
    const { error: recordError } = await supabase
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

    if (recordError) {
      throw new Error(`Error al actualizar ficha dental permanente: ${recordError.message}`);
    }

    // 2) Insert or update evolution sheet for this specific consultation session
    const { error: consultationError } = await supabase
      .from("dental_consultations")
      .upsert(
        {
          appointment_id,
          patient_id,
          treatment_notes,
          prescription: prescription || null,
          odontogram_snapshot: odontogram_state || {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "appointment_id" }
      );

    if (consultationError) {
      throw new Error(`Error al guardar evolución de consulta: ${consultationError.message}`);
    }

    // 3) Mark the appointment as attended
    const { error: apptError } = await supabase
      .from("appointments")
      .update({ status: "attended" })
      .eq("id", appointment_id);

    if (apptError) {
      throw new Error(`Error al actualizar estado de la cita: ${apptError.message}`);
    }

    // 4) Fetch appointment and patient info to trigger the email
    const { data: appt, error: fetchError } = await supabase
      .from("appointments")
      .select("starts_at, patient:patients(full_name, email)")
      .eq("id", appointment_id)
      .single();

    if (fetchError || !appt) {
      throw new Error("No se pudo obtener información de la cita para el correo.");
    }

    const patient = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;

    if (patient && patient.email) {
      // 5) Build clinical summaries for the email
      const historyKeys: Record<string, string> = {
        alergia_antibiotico: "Alergia Antibiótico",
        alergia_anestesia: "Alergia Anestesia",
        hemorragias: "Hemorragias",
        vih_sida: "VIH/SIDA",
        tuberculosis: "Tuberculosis",
        diabetes: "Diabetes",
        asma: "Asma",
        hipertension: "Hipertensión",
        cardiovasculares: "Enfermedades Cardiovasculares"
      };

      const historyList = Object.entries(medical_history || {})
        .filter(([k, v]) => v === true && historyKeys[k])
        .map(([k]) => historyKeys[k]);

      const medHistoryObj = medical_history as any;
      if (medHistoryObj?.otros) {
        historyList.push(`Otros: ${medHistoryObj.otros}`);
      }
      const historySummary = historyList.length > 0 ? historyList.join(", ") : "Ninguno registrado";

      const examKeys: Record<string, string> = {
        labios: "Labios",
        mejillas: "Mejillas",
        maxilar_superior: "Maxilar Superior",
        maxilar_inferior: "Maxilar Inferior",
        lengua: "Lengua",
        paladar: "Paladar",
        amigdalas: "Amígdalas",
        otros: "Otros"
      };

      const examList = Object.entries(stomatognathic_exam || {})
        .map(([k, v]: [string, any]) => {
          const label = examKeys[k] || k;
          if (v?.status === "alteracion") {
            return `<strong>${label}</strong>: Alteración (${v.desc || "Sin detalle"})`;
          }
          return `<strong>${label}</strong>: Normal`;
        });
      const stomatognathicSummary = examList.length > 0 ? examList.join("<br/>") : "No registrado";

      const toothStates: Record<string, string> = {
        caries: "Caries",
        sellante_necesario: "Sellante necesario",
        sellante_realizado: "Sellante realizado",
        corona: "Corona",
        perdida: "Ausente",
        extraccion: "Extracción requerida"
      };

      const surfaceNames: Record<string, string> = {
        center: "Centro",
        top: "Superior",
        bottom: "Inferior",
        left: "Izquierda",
        right: "Derecha"
      };

      const odontogramList: string[] = [];
      Object.entries(odontogram_state || {}).forEach(([tooth, info]: [string, any]) => {
        const toothNum = parseInt(tooth, 10);
        const conditions: string[] = [];
        if (info.general && info.general !== "sano" && toothStates[info.general]) {
          conditions.push(toothStates[info.general]);
        }
        Object.entries(info.surfaces || {}).forEach(([surf, cond]: [string, any]) => {
          if (cond && cond !== "sano" && toothStates[cond]) {
            const surfEs = surfaceNames[surf] || surf;
            conditions.push(`${toothStates[cond]} (${surfEs})`);
          }
        });
        if (conditions.length > 0) {
          odontogramList.push(`• <strong>Diente ${toothNum}</strong>: ${conditions.join(", ")}`);
        }
      });
      const odontogramSummary = odontogramList.length > 0 ? odontogramList.join("<br/>") : "Todos los dientes sin novedades o sanos";

      const dateFormatted = new Date(appt.starts_at).toLocaleDateString("es-CO", {
        weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
      });

      let computedDentitionMode = dentition_mode;
      if (!computedDentitionMode && date_of_birth) {
        const birthDateObj = new Date(date_of_birth);
        const today = new Date();
        let age = today.getFullYear() - birthDateObj.getFullYear();
        const m = today.getMonth() - birthDateObj.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
          age--;
        }
        computedDentitionMode = age <= 12 ? "infantil" : "adulta";
      }

      // 6) Send premium summary email to the patient
      await sendDentalConsultationEmail({
        patientName: patient.full_name,
        patientEmail: patient.email,
        dateStr: dateFormatted,
        treatmentNotes: treatment_notes,
        prescription,
        medicalHistorySummary: historySummary,
        stomatognathicSummary,
        odontogramSummary,
        medicalHistoryRaw: medical_history,
        stomatognathicExamRaw: stomatognathic_exam,
        odontogramStateRaw: odontogram_state,
        dentitionMode: computedDentitionMode,
      });
    }

    // Invalidar caché de Next.js para que todas las vistas se sincronicen al instante
    try {
      revalidatePath("/admin");
      revalidatePath("/admin/calendario");
      revalidatePath(`/admin/citas/${appointment_id}`);
      revalidatePath("/admin/pacientes");
      revalidatePath(`/admin/pacientes/${patient_id}`);
    } catch (cacheError) {
      console.error("Error al revalidar rutas en consulta dental:", cacheError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Error al procesar la atención" }, { status: 500 });
  }
}

