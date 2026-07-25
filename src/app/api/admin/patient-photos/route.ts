import { getSessionUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser(req);
    const supabase = createAdminClient();

    if (!user) {
      return NextResponse.json({ success: false, error: "Sesión no válida o expirada. Por favor recarga la página." }, { status: 401 });
    }

    const formData = await req.formData();
    const patientId = formData.get("patientId") as string;
    const title = (formData.get("title") as string)?.trim();
    const notes = (formData.get("notes") as string)?.trim() || null;
    const imageFile = formData.get("imageFile") as File | null;

    if (!patientId || !title) {
      return NextResponse.json({ success: false, error: "El asunto de la foto es obligatorio." }, { status: 400 });
    }

    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json({ success: false, error: "Debes seleccionar un archivo de imagen válido." }, { status: 400 });
    }

    // 1. Garantizar que el bucket 'patient-photos' exista en Supabase Storage
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const exists = buckets?.some((b) => b.name === "patient-photos" || b.id === "patient-photos");
      if (!exists) {
        await supabase.storage.createBucket("patient-photos", { public: true });
      }
    } catch (bucketErr) {
      console.warn("No se pudo verificar/crear el bucket automáticamente:", bucketErr);
    }

    // 2. Subir imagen a Supabase Storage
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
      return NextResponse.json({ 
        success: false, 
        error: `Error al guardar archivo en Supabase Storage: ${uploadError.message}` 
      }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("patient-photos").getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    // 3. Registrar en la base de datos
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
      if (insertError.code === "42P01" || insertError.message.includes("relation \"public.patient_photos\" does not exist")) {
        return NextResponse.json({
          success: false,
          error: "La tabla 'patient_photos' no existe aún en Supabase. Por favor ejecuta la migración 'supabase/migration_patient_photos.sql' en el Editor SQL de tu Supabase Dashboard."
        }, { status: 500 });
      }
      return NextResponse.json({ 
        success: false, 
        error: `Error al registrar foto en la base de datos: ${insertError.message}` 
      }, { status: 500 });
    }

    try {
      revalidatePath(`/erp/pacientes/${patientId}`);
    } catch (rErr) {
      console.error("Error revalidando ruta:", rErr);
    }

    return NextResponse.json({ success: true, photo: inserted });
  } catch (err: any) {
    console.error("Excepción en POST /api/admin/patient-photos:", err);
    return NextResponse.json({ 
      success: false, 
      error: err.message || "Ocurrió un error inesperado al procesar la imagen." 
    }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const photoId = searchParams.get("photoId");
    const patientId = searchParams.get("patientId");

    if (!photoId || !patientId) {
      return NextResponse.json({ success: false, error: "Parámetros requeridos faltantes" }, { status: 400 });
    }

    const { data: photo, error: fetchError } = await supabase
      .from("patient_photos")
      .select("storage_path")
      .eq("id", photoId)
      .single();

    if (fetchError || !photo) {
      return NextResponse.json({ success: false, error: "Foto no encontrada." }, { status: 404 });
    }

    if (photo.storage_path) {
      await supabase.storage.from("patient-photos").remove([photo.storage_path]);
    }

    const { error: deleteError } = await supabase
      .from("patient_photos")
      .delete()
      .eq("id", photoId);

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    try {
      revalidatePath(`/erp/pacientes/${patientId}`);
    } catch (rErr) {
      console.error("Error revalidando ruta:", rErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Excepción en DELETE /api/admin/patient-photos:", err);
    return NextResponse.json({ success: false, error: err.message || "Error al eliminar foto." }, { status: 500 });
  }
}
