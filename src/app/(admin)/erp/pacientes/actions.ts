"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendQuotationEmail, QuotationItem } from "@/lib/email";
import { buildQuotationWhatsAppUrl } from "@/lib/whatsapp";

export async function createPatientQuotationAction(data: {
  patientId: string;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  total: number;
  notes?: string;
  sendEmail?: boolean;
}) {
  try {
    const supabase = createAdminClient();

    // 1) Fetch patient details
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, full_name, email, phone")
      .eq("id", data.patientId)
      .single();

    if (patientError || !patient) {
      return { success: false, error: "Paciente no encontrado." };
    }

    // 2) Generate Quotation Number (e.g. COT-202607-XXXX)
    const timestamp = Date.now().toString().slice(-4);
    const quotationNumber = `COT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${timestamp}`;

    let sentEmailAt: string | null = null;
    if (data.sendEmail && patient.email) {
      const emailSuccess = await sendQuotationEmail({
        patientName: patient.full_name,
        patientEmail: patient.email,
        quotationNumber,
        dateStr: new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" }),
        items: data.items,
        subtotal: data.subtotal,
        discount: data.discount,
        total: data.total,
        notes: data.notes
      });
      if (emailSuccess) {
        sentEmailAt = new Date().toISOString();
      }
    }

    // 3) Insert quotation into database
    const { data: inserted, error: insertError } = await supabase
      .from("patient_quotations")
      .insert({
        patient_id: data.patientId,
        quotation_number: quotationNumber,
        items: data.items,
        subtotal: data.subtotal,
        discount: data.discount,
        total: data.total,
        notes: data.notes || null,
        status: "enviada",
        sent_email_at: sentEmailAt,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error al guardar cotización:", insertError);
      return { success: false, error: `Error al guardar cotización: ${insertError.message}` };
    }

    const whatsappUrl = buildQuotationWhatsAppUrl(
      patient.phone,
      patient.full_name,
      quotationNumber,
      data.items,
      data.total,
      data.notes
    );

    revalidatePath(`/erp/pacientes/${data.patientId}`);

    return {
      success: true,
      quotationId: inserted.id,
      quotationNumber,
      whatsappUrl,
      emailSent: !!sentEmailAt
    };
  } catch (err: any) {
    console.error("Excepción en createPatientQuotationAction:", err);
    return { success: false, error: err.message || "Error al procesar la cotización." };
  }
}

export async function sendQuotationEmailAction(quotationId: string) {
  try {
    const supabase = createAdminClient();
    const { data: quote, error: quoteError } = await supabase
      .from("patient_quotations")
      .select("*, patients(full_name, email)")
      .eq("id", quotationId)
      .single();

    if (quoteError || !quote) {
      return { success: false, error: "Cotización no encontrada." };
    }

    const patient = (quote as any).patients;
    if (!patient?.email) {
      return { success: false, error: "El paciente no tiene un correo electrónico registrado." };
    }

    const success = await sendQuotationEmail({
      patientName: patient.full_name,
      patientEmail: patient.email,
      quotationNumber: quote.quotation_number,
      dateStr: new Date(quote.created_at).toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" }),
      items: quote.items || [],
      subtotal: quote.subtotal,
      discount: quote.discount,
      total: quote.total,
      notes: quote.notes
    });

    if (success) {
      await supabase
        .from("patient_quotations")
        .update({ sent_email_at: new Date().toISOString() })
        .eq("id", quotationId);
      revalidatePath(`/erp/pacientes/${quote.patient_id}`);
      return { success: true };
    } else {
      return { success: false, error: "No se pudo enviar el correo mediante Resend." };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Error al enviar el correo." };
  }
}

export async function getPatientOdontogramStateAction(patientId: string) {
  try {
    const supabase = createAdminClient();
    // 1. Consultar dental_records
    const { data: record } = await supabase
      .from("dental_records")
      .select("odontogram_state")
      .eq("patient_id", patientId)
      .maybeSingle();

    if (record?.odontogram_state && Object.keys(record.odontogram_state).length > 0) {
      return { success: true, odontogramState: record.odontogram_state };
    }

    // 2. Consultar última atención si dental_records estuviera vacío
    const { data: consultation } = await supabase
      .from("dental_consultations")
      .select("odontogram_snapshot")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (consultation?.odontogram_snapshot && Object.keys(consultation.odontogram_snapshot).length > 0) {
      return { success: true, odontogramState: consultation.odontogram_snapshot };
    }

    return { success: true, odontogramState: null };
  } catch (err: any) {
    console.error("Error al obtener odontograma:", err);
    return { success: false, error: err.message };
  }
}
