import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import CoworkingDetailClient from "./CoworkingDetailClient";
import { CoworkingRental, CoworkingRentalStatus } from "@/lib/coworking-types";

export const dynamic = "force-dynamic";

// Server Action: Actualizar datos del doctor y paciente
async function updateDoctorInfo(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/coworking");
  const id = formData.get("id") as string;
  const doctor_name = (formData.get("doctor_name") as string)?.trim();
  const doctor_document = (formData.get("doctor_document") as string)?.trim() || null;
  const doctor_phone = (formData.get("doctor_phone") as string)?.trim() || null;
  const doctor_email = (formData.get("doctor_email") as string)?.trim() || null;
  const doctor_specialty = (formData.get("doctor_specialty") as string)?.trim() || null;
  const doctor_registration_number = (formData.get("doctor_registration_number") as string)?.trim() || null;
  const patient_name = (formData.get("patient_name") as string)?.trim() || null;
  const patient_document = (formData.get("patient_document") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

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
  return { success: true };
}

// Server Action: Subir Contrato o Descargo de Responsabilidad
async function uploadDocument(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/coworking");
  const id = formData.get("id") as string;
  const type = formData.get("type") as "contract" | "waiver";
  const file = formData.get("file") as File;

  if (!file || file.size === 0) {
    return { error: "No se seleccionó ningún archivo." };
  }

  if (file.size > 20 * 1024 * 1024) {
    return { error: "El archivo es demasiado grande (máximo 20MB)." };
  }

  const supabase = createAdminClient();
  try {
    const rawBytes = Buffer.from(await file.arrayBuffer());
    let uploadBuffer: Buffer = rawBytes;
    let contentType = file.type || "application/octet-stream";
    let fileExt = file.name.split(".").pop()?.toLowerCase() || "pdf";

    if (contentType.startsWith("image/")) {
      try {
        const { optimizeImageForWeb } = await import("@/lib/image-optimizer");
        const optimized = await optimizeImageForWeb(rawBytes, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 85,
          format: "webp",
        });
        uploadBuffer = optimized.buffer;
        contentType = optimized.contentType;
        fileExt = optimized.extension;
      } catch (optErr) {
        console.warn("No se pudo optimizar imagen del documento:", optErr);
      }
    }

    const timestamp = Date.now();
    const folder = type === "contract" ? "contratos" : "descargos";
    const fileName = `coworking/${folder}/${id}_${timestamp}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("patient-documents")
      .upload(fileName, uploadBuffer, {
        contentType,
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) {
      return { error: `Error de subida: ${uploadError.message}` };
    }

    try {
      const { warmLocalStorageCache } = await import("@/lib/storage-cache-server");
      await warmLocalStorageCache("patient-documents", fileName, uploadBuffer);
    } catch {
      // Cache opcional
    }

    const { data: urlData } = supabase.storage.from("patient-documents").getPublicUrl(fileName);
    const publicUrl = urlData?.publicUrl || null;

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (type === "contract") {
      updatePayload.contract_url = publicUrl;
      updatePayload.contract_uploaded_at = new Date().toISOString();
    } else {
      updatePayload.waiver_url = publicUrl;
      updatePayload.waiver_uploaded_at = new Date().toISOString();
    }

    const { error: dbError } = await supabase
      .from("coworking_rentals")
      .update(updatePayload)
      .eq("id", id);

    if (dbError) {
      return { error: dbError.message };
    }

    return { success: true, url: publicUrl || undefined };
  } catch (err: any) {
    return { error: err.message || "Error procesando archivo." };
  }
}

// Server Action: Eliminar documento
async function removeDocument(type: "contract" | "waiver") {
  "use server";
  await assertWritePermission("/erp/coworking");
  return { success: true };
}

// Server Action: Cambiar estado
async function changeStatus(id: string, newStatus: CoworkingRentalStatus) {
  "use server";
  await assertWritePermission("/erp/coworking");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("coworking_rentals")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  return { success: true };
}

export default async function CoworkingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await assertPermission("/erp/coworking");
  const canEdit = await hasWritePermission("/erp/coworking");
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: rawRental, error } = await supabase
    .from("coworking_rentals")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !rawRental) notFound();
  const rental = rawRental as CoworkingRental;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/erp/coworking?date=${rental.rental_date}`}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0 shadow-xs"
          title="Volver a la Agenda de Coworking"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink-900 tracking-tight">Detalle de Reserva de Coworking</h1>
          <p className="text-xs text-ink-500 font-mono">ID: {rental.id.slice(0, 8)} · Check-in, documentación y facturación</p>
        </div>
      </div>

      <CoworkingDetailClient
        rental={rental}
        canEdit={canEdit}
        updateDoctorInfo={updateDoctorInfo}
        uploadDocument={uploadDocument}
        removeDocument={async (type) => {
          "use server";
          await assertWritePermission("/erp/coworking");
          const s = createAdminClient();
          const patch = type === "contract"
            ? { contract_url: null, contract_uploaded_at: null }
            : { waiver_url: null, waiver_uploaded_at: null };
          await s.from("coworking_rentals").update(patch).eq("id", id);
          return { success: true };
        }}
        changeStatus={async (newStatus) => changeStatus(rental.id, newStatus)}
      />
    </div>
  );
}
