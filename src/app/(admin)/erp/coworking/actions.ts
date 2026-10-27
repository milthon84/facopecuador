"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertWritePermission } from "@/lib/auth-action";
import { revalidatePath } from "next/cache";
import {
  CoworkingRentalStatus,
  parseCoworkingDocuments,
  serializeCoworkingDocuments,
  hasCoworkingDocuments,
  CoworkingDocumentItem,
} from "@/lib/coworking-types";
import { logAudit } from "@/lib/audit";
import { cleanDocumentNumber } from "@/lib/validators";

/**
 * Actualiza los datos de check-in del doctor y paciente.
 */
export async function updateDoctorInfoAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await assertWritePermission("/erp/coworking");
    const id = formData.get("id") as string;
    const doctor_name = (formData.get("doctor_name") as string)?.trim();
    const rawDoctorDoc = (formData.get("doctor_document") as string)?.trim();
    const doctor_document = cleanDocumentNumber(rawDoctorDoc) || null;
    const doctor_phone = (formData.get("doctor_phone") as string)?.trim() || null;
    const doctor_email = (formData.get("doctor_email") as string)?.trim() || null;
    const doctor_specialty = (formData.get("doctor_specialty") as string)?.trim() || null;
    const doctor_registration_number = (formData.get("doctor_registration_number") as string)?.trim() || null;
    const patient_name = (formData.get("patient_name") as string)?.trim() || null;
    const rawPatientDoc = (formData.get("patient_document") as string)?.trim();
    const patient_document = cleanDocumentNumber(rawPatientDoc) || null;
    const notes = (formData.get("notes") as string)?.trim() || null;

    if (!id) {
      return { error: "ID de reserva no válido." };
    }
    if (!doctor_name) {
      return { error: "El nombre del doctor es obligatorio." };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("coworking_rentals")
      .update({
        doctor_name,
        doctor_document,
        doctor_phone,
        doctor_email,
        doctor_specialty,
        doctor_registration_number,
        patient_name,
        patient_document,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }

    try {
      await logAudit({
        user_id: user.id,
        user_email: user.email ?? "unknown",
        action: "update",
        resource: "appointment",
        resource_id: id,
        description: `Datos de doctor/check-in actualizados en alquiler: ${doctor_name}`,
        metadata: { doctor_name, doctor_document },
      });
    } catch {
      // Ignorar fallo de log
    }

    revalidatePath("/erp/coworking");
    revalidatePath(`/erp/coworking/${id}`);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Error al actualizar datos del doctor." };
  }
}

/**
 * Sube uno o varios archivos de contrato o descargo de responsabilidad.
 */
export async function uploadCoworkingDocumentAction(
  formData: FormData
): Promise<{ success?: boolean; error?: string; documents?: CoworkingDocumentItem[] }> {
  try {
    const user = await assertWritePermission("/erp/coworking");
    const id = formData.get("id") as string;
    const type = formData.get("type") as "contract" | "waiver";

    if (!id || !type) {
      return { error: "Parámetros inválidos." };
    }

    // Obtener todos los archivos seleccionados
    const files = formData.getAll("files") as File[];
    const singleFile = formData.get("file") as File | null;
    const allFiles: File[] = [];

    if (files && files.length > 0) {
      for (const f of files) {
        if (f && f.size > 0) allFiles.push(f);
      }
    }
    if (singleFile && singleFile.size > 0 && !allFiles.some((f) => f.name === singleFile.name && f.size === singleFile.size)) {
      allFiles.push(singleFile);
    }

    if (allFiles.length === 0) {
      return { error: "No se seleccionó ningún archivo." };
    }

    const supabase = createAdminClient();

    // Obtener la reserva actual
    const { data: currentRental, error: fetchErr } = await supabase
      .from("coworking_rentals")
      .select("id, contract_url, contract_uploaded_at, waiver_url, waiver_uploaded_at")
      .eq("id", id)
      .single();

    if (fetchErr || !currentRental) {
      return { error: "Reserva de alquiler no encontrada." };
    }

    const isContract = type === "contract";
    const existingRaw = isContract ? currentRental.contract_url : currentRental.waiver_url;
    const existingDate = isContract ? currentRental.contract_uploaded_at : currentRental.waiver_uploaded_at;
    const defaultPrefix = isContract ? "Contrato" : "Descargo";

    const currentDocs = parseCoworkingDocuments(existingRaw, defaultPrefix, existingDate);
    const newDocs: CoworkingDocumentItem[] = [];

    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i];

      if (file.size > 25 * 1024 * 1024) {
        return { error: `El archivo "${file.name}" supera el tamaño máximo permitido (25MB).` };
      }

      const rawBytes = Buffer.from(await file.arrayBuffer());
      let uploadBuffer: Buffer = rawBytes;
      let contentType = file.type || "application/octet-stream";
      let fileExt = file.name.split(".").pop()?.toLowerCase() || "pdf";

      if (contentType.startsWith("image/")) {
        try {
          const { optimizeImageForWeb } = await import("@/lib/image-optimizer");
          const optimized = await optimizeImageForWeb(rawBytes, {
            maxWidth: 1800,
            maxHeight: 1800,
            quality: 85,
            format: "webp",
          });
          uploadBuffer = optimized.buffer;
          contentType = optimized.contentType;
          fileExt = optimized.extension;
        } catch (optErr) {
          console.warn("No se pudo optimizar la imagen del documento:", optErr);
        }
      }

      const timestamp = Date.now();
      const rand = Math.random().toString(36).substring(2, 7);
      const folder = isContract ? "contratos" : "descargos";
      const fileName = `coworking/${folder}/${id}_${timestamp}_${i}_${rand}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("patient-documents")
        .upload(fileName, uploadBuffer, {
          contentType,
          cacheControl: "31536000",
          upsert: true,
        });

      if (uploadError) {
        return { error: `Error al subir "${file.name}": ${uploadError.message}` };
      }

      try {
        const { warmLocalStorageCache } = await import("@/lib/storage-cache-server");
        await warmLocalStorageCache("patient-documents", fileName, uploadBuffer);
      } catch {
        // Cache opcional
      }

      const { data: urlData } = supabase.storage.from("patient-documents").getPublicUrl(fileName);
      const publicUrl = urlData?.publicUrl || null;

      if (publicUrl) {
        newDocs.push({
          id: `${timestamp}_${i}_${rand}`,
          url: publicUrl,
          name: file.name,
          uploaded_at: new Date().toISOString(),
          size: file.size,
        });
      }
    }

    const mergedDocs = [...currentDocs, ...newDocs];
    const serialized = serializeCoworkingDocuments(mergedDocs);
    const nowIso = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      updated_at: nowIso,
    };

    if (isContract) {
      updatePayload.contract_url = serialized;
      updatePayload.contract_uploaded_at = nowIso;
    } else {
      updatePayload.waiver_url = serialized;
      updatePayload.waiver_uploaded_at = nowIso;
    }

    const { error: dbError } = await supabase
      .from("coworking_rentals")
      .update(updatePayload)
      .eq("id", id);

    if (dbError) {
      return { error: dbError.message };
    }

    try {
      await logAudit({
        user_id: user.id,
        user_email: user.email ?? "unknown",
        action: "update",
        resource: "appointment",
        resource_id: id,
        description: `Subidos ${newDocs.length} archivo(s) de ${isContract ? "contrato" : "descargo"} para alquiler coworking`,
      });
    } catch {
      // Ignorar fallo de log
    }

    revalidatePath("/erp/coworking");
    revalidatePath(`/erp/coworking/${id}`);

    return { success: true, documents: mergedDocs };
  } catch (err: any) {
    return { error: err.message || "Error al procesar archivos." };
  }
}

/**
 * Elimina un documento específico de la lista.
 */
export async function removeCoworkingDocumentAction(
  rentalId: string,
  type: "contract" | "waiver",
  docId: string
): Promise<{ success?: boolean; error?: string; remainingDocs?: CoworkingDocumentItem[] }> {
  try {
    const user = await assertWritePermission("/erp/coworking");
    const supabase = createAdminClient();

    const { data: currentRental, error: fetchErr } = await supabase
      .from("coworking_rentals")
      .select("id, contract_url, contract_uploaded_at, waiver_url, waiver_uploaded_at")
      .eq("id", rentalId)
      .single();

    if (fetchErr || !currentRental) {
      return { error: "Reserva de alquiler no encontrada." };
    }

    const isContract = type === "contract";
    const existingRaw = isContract ? currentRental.contract_url : currentRental.waiver_url;
    const existingDate = isContract ? currentRental.contract_uploaded_at : currentRental.waiver_uploaded_at;
    const defaultPrefix = isContract ? "Contrato" : "Descargo";

    const currentDocs = parseCoworkingDocuments(existingRaw, defaultPrefix, existingDate);
    const filteredDocs = currentDocs.filter((d) => d.id !== docId && d.url !== docId);

    const serialized = serializeCoworkingDocuments(filteredDocs);
    const nowIso = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      updated_at: nowIso,
    };

    if (isContract) {
      updatePayload.contract_url = serialized;
      updatePayload.contract_uploaded_at = filteredDocs.length > 0 ? existingDate : null;
    } else {
      updatePayload.waiver_url = serialized;
      updatePayload.waiver_uploaded_at = filteredDocs.length > 0 ? existingDate : null;
    }

    const { error: dbError } = await supabase
      .from("coworking_rentals")
      .update(updatePayload)
      .eq("id", rentalId);

    if (dbError) {
      return { error: dbError.message };
    }

    try {
      await logAudit({
        user_id: user.id,
        user_email: user.email ?? "unknown",
        action: "update",
        resource: "appointment",
        resource_id: rentalId,
        description: `Eliminado documento de ${isContract ? "contrato" : "descargo"} en alquiler coworking`,
      });
    } catch {
      // Ignorar fallo de log
    }

    revalidatePath("/erp/coworking");
    revalidatePath(`/erp/coworking/${rentalId}`);

    return { success: true, remainingDocs: filteredDocs };
  } catch (err: any) {
    return { error: err.message || "Error al eliminar documento." };
  }
}

/**
 * Cambia el estado del alquiler (Iniciar, Finalizar/Completar, Cancelar).
 * Exige contrato y descargo de responsabilidad para sillones y clínica al completar.
 */
export async function changeCoworkingStatusAction(
  rentalId: string,
  newStatus: CoworkingRentalStatus
): Promise<{ success?: boolean; error?: string; missingDocs?: boolean }> {
  try {
    const user = await assertWritePermission("/erp/coworking");
    const supabase = createAdminClient();

    const { data: rental, error: fetchErr } = await supabase
      .from("coworking_rentals")
      .select("*")
      .eq("id", rentalId)
      .single();

    if (fetchErr || !rental) {
      return { error: "Reserva de alquiler no encontrada." };
    }

    // Regla estricta: al COMPLETAR (finalizado) sillones o clínica completa, exigir contrato y descargo
    if (newStatus === "finalizado") {
      const isClinicalSpace =
        rental.resource_type === "puesto_trabajo" || rental.resource_type === "clinica_completa";

      if (isClinicalSpace) {
        const hasContract = hasCoworkingDocuments(rental.contract_url);
        const hasWaiver = hasCoworkingDocuments(rental.waiver_url);

        if (!hasContract || !hasWaiver) {
          const missing: string[] = [];
          if (!hasContract) missing.push("Contrato de Arrendamiento");
          if (!hasWaiver) missing.push("Descargo de Responsabilidad firmado por el Paciente");

          return {
            error: `Para completar el alquiler de sillones dentales o clínica completa es obligatorio adjuntar: ${missing.join(" y ")}. Por favor carga los documentos antes de finalizar.`,
            missingDocs: true,
          };
        }
      }
    }

    const { error: updateErr } = await supabase
      .from("coworking_rentals")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rentalId);

    if (updateErr) {
      return { error: updateErr.message };
    }

    try {
      await logAudit({
        user_id: user.id,
        user_email: user.email ?? "unknown",
        action: "update",
        resource: "appointment",
        resource_id: rentalId,
        description: `Estado de alquiler coworking cambiado de ${rental.status} a ${newStatus}`,
        metadata: {
          previous_status: rental.status,
          new_status: newStatus,
          doctor_name: rental.doctor_name,
        },
      });
    } catch {
      // Ignorar fallo de log
    }

    revalidatePath("/erp/coworking");
    revalidatePath(`/erp/coworking/${rentalId}`);

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Error al actualizar estado del alquiler." };
  }
}
