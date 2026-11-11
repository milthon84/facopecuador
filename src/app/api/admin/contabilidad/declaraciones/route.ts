import { getSessionUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { warmLocalStorageCache } from "@/lib/storage-cache-server";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period");
    const year = searchParams.get("year");

    const supabase = createAdminClient();
    let query = supabase
      .from("tax_declaration_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (period && period !== "all") {
      query = query.eq("period", period);
    } else if (year && year !== "all") {
      query = query.eq("year", Number(year));
    }

    const { data, error } = await query;

    if (error) {
      if (
        error.code === "42P01" ||
        error.message.includes('relation "public.tax_declaration_documents" does not exist')
      ) {
        return NextResponse.json({ success: true, documents: [], tableMissing: true });
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
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Sesión no válida o expirada. Por favor recarga la página." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const period = (formData.get("period") as string)?.trim();
    const documentType = (formData.get("document_type") as string)?.trim() || "iva_104";
    const title = (formData.get("title") as string)?.trim();
    const notes = (formData.get("notes") as string)?.trim() || null;
    const file = formData.get("documentFile") as File | null;

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { success: false, error: "El período es obligatorio y debe tener formato YYYY-MM (ej: 2026-11)." },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { success: false, error: "El título o descripción del documento es obligatorio." },
        { status: 400 }
      );
    }

    if (!file || file.size === 0) {
      return NextResponse.json(
        { success: false, error: "Debes adjuntar un archivo (PDF, XML, ZIP, Imagen, etc.)." },
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

    const [yearStr, monthStr] = period.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);

    const originalName = file.name || "documento.pdf";
    const cleanExt = originalName.split(".").pop()?.toLowerCase() || "pdf";
    const baseCleanName = originalName
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .substring(0, 50);

    const arrayBuffer = await file.arrayBuffer();
    const uploadBuffer = Buffer.from(arrayBuffer);
    const contentType = file.type || "application/octet-stream";

    const storagePath = `${period}/${Date.now()}_${baseCleanName}.${cleanExt}`;

    const supabase = createAdminClient();

    // Intentar subir a 'tax-declarations', o fallback a 'payment-proofs'
    let targetBucket = "tax-declarations";
    let uploadRes = await supabase.storage
      .from(targetBucket)
      .upload(storagePath, uploadBuffer, {
        contentType,
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadRes.error) {
      // Si el bucket no existe en storage, intentamos crearlo
      if (
        uploadRes.error.message.includes("Bucket not found") ||
        uploadRes.error.message.includes("not found")
      ) {
        try {
          await supabase.storage.createBucket("tax-declarations", {
            public: true,
            fileSizeLimit: 26214400,
          });
          uploadRes = await supabase.storage
            .from("tax-declarations")
            .upload(storagePath, uploadBuffer, {
              contentType,
              cacheControl: "31536000",
              upsert: true,
            });
        } catch {
          // Fallback a payment-proofs
          targetBucket = "payment-proofs";
          uploadRes = await supabase.storage
            .from(targetBucket)
            .upload(`declaraciones/${storagePath}`, uploadBuffer, {
              contentType,
              cacheControl: "31536000",
              upsert: true,
            });
        }
      } else {
        // Fallback inmediato a payment-proofs
        targetBucket = "payment-proofs";
        uploadRes = await supabase.storage
          .from(targetBucket)
          .upload(`declaraciones/${storagePath}`, uploadBuffer, {
            contentType,
            cacheControl: "31536000",
            upsert: true,
          });
      }
    }

    if (uploadRes.error) {
      console.error("Error al subir documento de declaración:", uploadRes.error);
      return NextResponse.json(
        { success: false, error: `Error al almacenar el archivo: ${uploadRes.error.message}` },
        { status: 500 }
      );
    }

    const actualStoragePath = uploadRes.data?.path || storagePath;

    // Cache local proactivo
    await warmLocalStorageCache(targetBucket, actualStoragePath, uploadBuffer);

    const { data: urlData } = supabase.storage.from(targetBucket).getPublicUrl(actualStoragePath);
    const fileUrl = urlData.publicUrl;

    const { data: insertedDoc, error: insertError } = await supabase
      .from("tax_declaration_documents")
      .insert({
        period,
        year,
        month,
        document_type: documentType,
        title,
        notes,
        file_url: fileUrl,
        storage_path: `${targetBucket}/${actualStoragePath}`,
        file_name: originalName,
        file_type: contentType,
        file_size: file.size,
        uploaded_by_id: user.id,
        uploaded_by_email: user.email,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error insertando en tax_declaration_documents:", insertError);
      if (
        insertError.code === "42P01" ||
        insertError.message.includes('relation "public.tax_declaration_documents" does not exist')
      ) {
        return NextResponse.json(
          {
            success: false,
            tableMissing: true,
            error:
              "La tabla en la base de datos aún no ha sido creada. Por favor ejecuta el script 'supabase/migration_tax_declarations.sql' en el SQL Editor de Supabase.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { success: false, error: `Error guardando registro en base de datos: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, document: insertedDoc });
  } catch (err: any) {
    console.error("Error in POST declarations:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("id");

    if (!documentId) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Obtener ruta de storage para borrarlo
    const { data: doc, error: fetchErr } = await supabase
      .from("tax_declaration_documents")
      .select("storage_path")
      .eq("id", documentId)
      .single();

    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    if (doc?.storage_path) {
      const parts = doc.storage_path.split("/");
      const bucket = parts[0];
      const filePath = parts.slice(1).join("/");
      if (bucket && filePath) {
        await supabase.storage.from(bucket).remove([filePath]);
      }
    }

    const { error: delErr } = await supabase
      .from("tax_declaration_documents")
      .delete()
      .eq("id", documentId);

    if (delErr) {
      return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
