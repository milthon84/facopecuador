import { getSessionUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { warmLocalStorageCache } from "@/lib/storage-cache-server";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return NextResponse.json({ success: false, error: "patientId es requerido" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("patient_documents")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (error) {
      // Si la tabla no existe aún
      if (error.code === "42P01" || error.message.includes("relation \"public.patient_documents\" does not exist")) {
        return NextResponse.json({ success: true, documents: [] });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, documents: data || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser(req);
    const supabase = createAdminClient();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Sesión no válida o expirada. Por favor recarga la página." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const patientId = formData.get("patientId") as string;
    const title = (formData.get("title") as string)?.trim();
    const category = ((formData.get("category") as string)?.trim() || "consentimiento").toLowerCase();
    const notes = (formData.get("notes") as string)?.trim() || null;
    const file = formData.get("documentFile") as File | null;

    if (!patientId || !title) {
      return NextResponse.json(
        { success: false, error: "El título o asunto del documento es obligatorio." },
        { status: 400 }
      );
    }

    if (!file || file.size === 0) {
      return NextResponse.json(
        { success: false, error: "Debes seleccionar un archivo para subir (PDF, imagen o documento)." },
        { status: 400 }
      );
    }

    // Límite de tamaño: 25MB
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "El archivo es demasiado grande. El límite máximo es de 25 MB." },
        { status: 400 }
      );
    }

    const originalName = file.name || "documento.pdf";
    const cleanExt = originalName.split(".").pop()?.toLowerCase() || "pdf";
    const baseCleanName = originalName
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .substring(0, 40);

    const arrayBuffer = await file.arrayBuffer();
    const uploadBuffer = Buffer.from(arrayBuffer);
    const contentType = file.type || "application/octet-stream";

    const storagePath = `${patientId}/${Date.now()}_${baseCleanName}.${cleanExt}`;

    const { error: uploadError } = await supabase.storage
      .from("patient-documents")
      .upload(storagePath, uploadBuffer, {
        contentType,
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error al subir documento a Supabase storage:", uploadError);
      return NextResponse.json(
        {
          success: false,
          error: `Error al guardar archivo en Storage: ${uploadError.message}`,
        },
        { status: 500 }
      );
    }

    // Cache local proactivo
    await warmLocalStorageCache("patient-documents", storagePath, uploadBuffer);

    const { data: urlData } = supabase.storage.from("patient-documents").getPublicUrl(storagePath);
    const fileUrl = urlData.publicUrl;

    // Registrar en BD
    const { data: inserted, error: insertError } = await supabase
      .from("patient_documents")
      .insert({
        patient_id: patientId,
        title,
        category,
        file_url: fileUrl,
        storage_path: storagePath,
        file_name: originalName,
        file_type: contentType,
        file_size: file.size,
        notes,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Error al insertar documento en BD:", insertError);
      if (
        insertError.code === "42P01" ||
        insertError.message.includes('relation "public.patient_documents" does not exist')
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "La tabla 'patient_documents' no existe aún en Supabase. Por favor ejecuta la migración 'supabase/migration_patient_documents.sql' en el Editor SQL de tu Supabase Dashboard.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: `Error al registrar documento en la base de datos: ${insertError.message}`,
        },
        { status: 500 }
      );
    }

    try {
      revalidatePath(`/erp/pacientes/${patientId}`);
    } catch (rErr) {
      console.error("Error revalidando ruta:", rErr);
    }

    return NextResponse.json({ success: true, document: inserted });
  } catch (err: any) {
    console.error("Excepción en POST /api/admin/patient-documents:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Ocurrió un error inesperado al procesar el documento.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser(req);
    const supabase = createAdminClient();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");
    const patientId = searchParams.get("patientId");

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: "documentId es requerido." },
        { status: 400 }
      );
    }

    // 1. Obtener registro
    const { data: doc, error: fetchError } = await supabase
      .from("patient_documents")
      .select("id, storage_path, patient_id")
      .eq("id", documentId)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json(
        { success: false, error: "El documento no fue encontrado." },
        { status: 404 }
      );
    }

    // 2. Eliminar del storage si tiene storage_path
    if (doc.storage_path) {
      const { error: storageError } = await supabase.storage
        .from("patient-documents")
        .remove([doc.storage_path]);

      if (storageError) {
        console.warn("Advertencia: No se pudo eliminar archivo físico de storage:", storageError);
      }
    }

    // 3. Eliminar de la base de datos
    const { error: deleteError } = await supabase
      .from("patient_documents")
      .delete()
      .eq("id", documentId);

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: `Error al eliminar de la base de datos: ${deleteError.message}` },
        { status: 500 }
      );
    }

    const targetPatientId = patientId || doc.patient_id;
    if (targetPatientId) {
      try {
        revalidatePath(`/erp/pacientes/${targetPatientId}`);
      } catch (e) {}
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Excepción en DELETE /api/admin/patient-documents:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error al eliminar documento." },
      { status: 500 }
    );
  }
}
