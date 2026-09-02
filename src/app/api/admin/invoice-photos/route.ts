import { getSessionUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser(req);
    const supabase = createAdminClient();

    if (!user) {
      return NextResponse.json({ success: false, error: "Sesión no válida o expirada." }, { status: 401 });
    }

    const formData = await req.formData();
    const invoiceId = formData.get("invoiceId") as string;
    const title = (formData.get("title") as string)?.trim() || "Comprobante / Imagen de Factura";
    const imageFile = formData.get("imageFile") as File | null;

    if (!invoiceId) {
      return NextResponse.json({ success: false, error: "El ID de la factura es obligatorio." }, { status: 400 });
    }

    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json({ success: false, error: "Debes seleccionar un archivo de imagen válido." }, { status: 400 });
    }

    // 1. Garantizar bucket 'invoice-photos'
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const exists = buckets?.some((b) => b.name === "invoice-photos" || b.id === "invoice-photos");
      if (!exists) {
        await supabase.storage.createBucket("invoice-photos", { public: true });
      }
    } catch (bucketErr) {
      console.warn("No se pudo verificar/crear bucket invoice-photos automáticamente:", bucketErr);
    }

    // 2. Subir imagen a Supabase Storage
    const fileExt = imageFile.name.split(".").pop() || "jpg";
    const fileName = `${invoiceId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("invoice-photos")
      .upload(fileName, buffer, {
        contentType: imageFile.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Error al subir imagen de factura:", uploadError);
      return NextResponse.json({ 
        success: false, 
        error: `Error al guardar archivo en Storage: ${uploadError.message}` 
      }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("invoice-photos").getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    // 3. Guardar en invoice_photos y respaldar en invoices
    let insertedPhoto: any = null;
    const { data: inserted, error: insertError } = await supabase
      .from("invoice_photos")
      .insert({
        invoice_id: invoiceId,
        title,
        image_url: imageUrl,
        storage_path: fileName,
      })
      .select("*")
      .single();

    if (insertError) {
      console.warn("No se pudo insertar en invoice_photos, actualizando invoices directamente:", insertError.message);
      insertedPhoto = {
        id: `inv-img-${Date.now()}`,
        invoice_id: invoiceId,
        title,
        image_url: imageUrl,
        storage_path: fileName,
        created_at: new Date().toISOString()
      };
    } else {
      insertedPhoto = inserted;
    }

    // Respaldar referencia en la tabla invoices si está vacía
    try {
      const { data: currentInv } = await supabase.from("invoices").select("payment_reference").eq("id", invoiceId).maybeSingle();
      if (!currentInv?.payment_reference) {
        await supabase.from("invoices").update({ payment_reference: imageUrl }).eq("id", invoiceId);
      }
    } catch (uErr) {
      console.warn("No se pudo actualizar payment_reference en invoices:", uErr);
    }

    try {
      revalidatePath(`/erp/facturacion/${invoiceId}`);
    } catch (rErr) {
      console.error("Error revalidando ruta:", rErr);
    }

    return NextResponse.json({ success: true, photo: insertedPhoto });
  } catch (err: any) {
    console.error("Excepción en POST /api/admin/invoice-photos:", err);
    return NextResponse.json({ 
      success: false, 
      error: err.message || "Error inesperado al subir la imagen de factura." 
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
    const invoiceId = searchParams.get("invoiceId");

    if (!photoId || !invoiceId) {
      return NextResponse.json({ success: false, error: "Parámetros requeridos faltantes" }, { status: 400 });
    }

    if (!photoId.startsWith("pay-") && !photoId.startsWith("inv-")) {
      const { data: photo } = await supabase
        .from("invoice_photos")
        .select("storage_path")
        .eq("id", photoId)
        .single();

      if (photo?.storage_path) {
        await supabase.storage.from("invoice-photos").remove([photo.storage_path]);
      }

      await supabase.from("invoice_photos").delete().eq("id", photoId);
    }

    try {
      revalidatePath(`/erp/facturacion/${invoiceId}`);
    } catch (rErr) {
      console.error("Error revalidando ruta:", rErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Excepción en DELETE /api/admin/invoice-photos:", err);
    return NextResponse.json({ success: false, error: err.message || "Error al eliminar la imagen." }, { status: 500 });
  }
}
