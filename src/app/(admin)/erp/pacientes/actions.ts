"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendQuotationEmail, QuotationItem } from "@/lib/email";
import { buildQuotationWhatsAppUrl } from "@/lib/whatsapp";
import { assertWritePermission } from "@/lib/auth-action";

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

export async function uploadPatientPhotoAction(formData: FormData) {
  try {
    await assertWritePermission("/erp/pacientes");
    const supabase = createAdminClient();

    const patientId = formData.get("patientId") as string;
    const title = (formData.get("title") as string)?.trim();
    const notes = (formData.get("notes") as string)?.trim() || null;
    const imageFile = formData.get("imageFile") as File | null;

    if (!patientId || !title || !imageFile || imageFile.size === 0) {
      return { success: false, error: "El asunto y la foto son obligatorios." };
    }

    const fileExt = imageFile.name.split(".").pop() || "jpg";
    const fileName = `${patientId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("patient-photos")
      .upload(fileName, buffer, {
        contentType: imageFile.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Error al subir foto a Supabase storage:", uploadError);
      return { success: false, error: `Error al guardar archivo: ${uploadError.message}` };
    }

    const { data: urlData } = supabase.storage.from("patient-photos").getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    const { data: inserted, error: insertError } = await supabase
      .from("patient_photos")
      .insert({
        patient_id: patientId,
        title,
        notes,
        image_url: imageUrl,
        storage_path: fileName,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Error al insertar foto en BD:", insertError);
      return { success: false, error: `Error al guardar en base de datos: ${insertError.message}` };
    }

    revalidatePath(`/erp/pacientes/${patientId}`);
    return { success: true, photo: inserted };
  } catch (err: any) {
    console.error("Excepción al subir foto del paciente:", err);
    return { success: false, error: err.message || "Error al procesar la foto." };
  }
}

export async function deletePatientPhotoAction(photoId: string, patientId: string) {
  try {
    await assertWritePermission("/erp/pacientes");
    const supabase = createAdminClient();

    const { data: photo, error: fetchError } = await supabase
      .from("patient_photos")
      .select("storage_path")
      .eq("id", photoId)
      .single();

    if (fetchError || !photo) {
      return { success: false, error: "Foto no encontrada." };
    }

    if (photo.storage_path) {
      await supabase.storage.from("patient-photos").remove([photo.storage_path]);
    }

    const { error: deleteError } = await supabase
      .from("patient_photos")
      .delete()
      .eq("id", photoId);

    if (deleteError) {
      return { success: false, error: `Error al eliminar de base de datos: ${deleteError.message}` };
    }

    revalidatePath(`/erp/pacientes/${patientId}`);
    return { success: true };
  } catch (err: any) {
    console.error("Error al eliminar foto:", err);
    return { success: false, error: err.message || "Error al eliminar foto." };
  }
}

export async function deletePatientAction(patientId: string) {
  try {
    await assertWritePermission("/erp/pacientes");
    const supabase = createAdminClient();

    // 1. Fetch patient info
    const { data: patient, error: pErr } = await supabase
      .from("patients")
      .select("id, full_name, document_number")
      .eq("id", patientId)
      .single();

    if (pErr || !patient) {
      return { success: false, error: "Paciente no encontrado." };
    }

    // 2. Check if patient has invoices (facturas) by patient_id or document_number
    let invoicesQuery = supabase.from("invoices").select("id").limit(1);
    if (patient.document_number) {
      invoicesQuery = invoicesQuery.or(`patient_id.eq.${patient.id},client_document.eq.${patient.document_number}`);
    } else {
      invoicesQuery = invoicesQuery.eq("patient_id", patient.id);
    }
    const { data: invoices } = await invoicesQuery;

    if (invoices && invoices.length > 0) {
      return {
        success: false,
        error: `No se puede eliminar a "${patient.full_name}" porque registra facturas o comprobantes emitidos.`
      };
    }

    // 3. Check if patient has completed attentions / clinical consultations
    const { data: consultations } = await supabase
      .from("dental_consultations")
      .select("id")
      .eq("patient_id", patient.id)
      .limit(1);

    if (consultations && consultations.length > 0) {
      return {
        success: false,
        error: `No se puede eliminar a "${patient.full_name}" porque posee consultas o evoluciones médicas registradas.`
      };
    }

    // Check if patient has attended/completed appointments
    const { data: attendedAppts } = await supabase
      .from("appointments")
      .select("id")
      .eq("patient_id", patient.id)
      .in("status", ["atendida", "completada", "finalizada"])
      .limit(1);

    if (attendedAppts && attendedAppts.length > 0) {
      return {
        success: false,
        error: `No se puede eliminar a "${patient.full_name}" porque registra citas médicas con estado Atendida o Completada.`
      };
    }

    // 4. Patient has NO invoices and NO completed attentions!
    // Safe to delete dependent records:
    // a) Delete non-completed appointments (pendientes/canceladas)
    await supabase.from("appointments").delete().eq("patient_id", patient.id);

    // b) Delete patient photos from storage and DB
    const { data: photos } = await supabase.from("patient_photos").select("storage_path").eq("patient_id", patient.id);
    if (photos && photos.length > 0) {
      const paths = photos.map(p => p.storage_path).filter(Boolean) as string[];
      if (paths.length > 0) {
        await supabase.storage.from("patient-photos").remove(paths);
      }
      await supabase.from("patient_photos").delete().eq("patient_id", patient.id);
    }

    // c) Delete quotations
    await supabase.from("patient_quotations").delete().eq("patient_id", patient.id);

    // d) Delete dental records
    await supabase.from("dental_records").delete().eq("patient_id", patient.id);

    // 5. Delete patient record
    const { error: deleteError } = await supabase
      .from("patients")
      .delete()
      .eq("id", patient.id);

    if (deleteError) {
      return { success: false, error: `Error al eliminar paciente: ${deleteError.message}` };
    }

    revalidatePath("/erp/pacientes");
    return { success: true };
  } catch (err: any) {
    console.error("Error en deletePatientAction:", err);
    return { success: false, error: err.message || "Error inesperado al eliminar el paciente." };
  }
}
