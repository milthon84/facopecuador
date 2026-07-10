"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertWritePermission } from "@/lib/auth-action";
import { revalidatePath } from "next/cache";

// Helper para crear un slug amigable a partir del título
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .replace(/\s+/g, "-") // Reemplazar espacios con guiones
    .replace(/[^\w\-]+/g, "") // Eliminar caracteres especiales
    .replace(/\-\-+/g, "-") // Reemplazar guiones múltiples
    .replace(/^-+/, "") // Limpiar guión inicial
    .replace(/-+$/, ""); // Limpiar guión final
}

// Guardar o actualizar artículo (Post)
export async function savePostAction(formData: FormData) {
  await assertWritePermission("/erp/publicidad");

  const id = formData.get("id") as string | null;
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const status = formData.get("status") as "draft" | "published";
  const category = formData.get("category") as string;
  const expiresAtInput = (formData.get("expires_at") as string)?.trim();
  const imageFile = formData.get("imageFile") as File | null;
  let imageUrl = formData.get("existingImageUrl") as string | null;

  if (!title || !content) {
    throw new Error("El título y el contenido son obligatorios");
  }

  if (!["cursos", "clinica", "coworking"].includes(category)) {
    throw new Error("Debes seleccionar un destino válido para el artículo");
  }

  // Fecha de expiración: si no se especifica, por defecto 2 meses desde hoy
  let expiresAt: string;
  if (expiresAtInput) {
    const parsed = new Date(`${expiresAtInput}T23:59:59`);
    if (isNaN(parsed.getTime())) {
      throw new Error("La fecha de expiración no es válida");
    }
    expiresAt = parsed.toISOString();
  } else {
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() + 2);
    expiresAt = fallback.toISOString();
  }

  const slug = slugify(title);
  const supabase = createAdminClient();

  // Procesar archivo si fue seleccionado
  if (imageFile && imageFile.size > 0) {
    try {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from("web-assets")
        .upload(fileName, buffer, {
          contentType: imageFile.type,
        });

      if (!uploadError) {
        const { data } = supabase.storage.from("web-assets").getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      } else {
        console.error("Error al subir archivo de imagen:", uploadError.message);
      }
    } catch (err) {
      console.error("Excepción al subir archivo de imagen:", err);
    }
  }

  const postData: any = {
    title,
    slug,
    content,
    status,
    category,
    expires_at: expiresAt,
    image_url: imageUrl,
    published_at: status === "published" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    // Modo Edición
    const { error } = await supabase
      .from("web_posts")
      .update(postData)
      .eq("id", id);

    if (error) {
      throw new Error(`Error al actualizar el artículo: ${error.message}`);
    }
  } else {
    // Modo Creación
    const { error } = await supabase
      .from("web_posts")
      .insert({
        ...postData,
        created_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Error al crear el artículo: ${error.message}`);
    }
  }

  revalidatePath("/");
  revalidatePath("/erp/publicidad");
  return { success: true };
}

// Eliminar artículo (Post)
export async function deletePostAction(id: string) {
  await assertWritePermission("/erp/publicidad");

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("web_posts")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Error al eliminar el artículo: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/erp/publicidad");
  return { success: true };
}
