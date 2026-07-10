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

// 1. Guardar configuraciones del sitio
export async function saveWebSettingsAction(hero: any, about: any, contact: any) {
  await assertWritePermission("/erp/sitio-web");

  const supabase = createAdminClient();

  const updates = [
    { key: "hero", value: hero },
    { key: "about", value: about },
    { key: "contact", value: contact }
  ];

  for (const item of updates) {
    const { error } = await supabase
      .from("web_settings")
      .upsert(item, { onConflict: "key" });

    if (error) {
      throw new Error(`Error al guardar configuración ${item.key}: ${error.message}`);
    }
  }

  revalidatePath("/");
  revalidatePath("/erp/sitio-web");
  return { success: true };
}

// 2. Guardar o actualizar artículo (Post)
export async function savePostAction(formData: FormData) {
  await assertWritePermission("/erp/sitio-web");

  const id = formData.get("id") as string | null;
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const status = formData.get("status") as "draft" | "published";
  const imageFile = formData.get("imageFile") as File | null;
  let imageUrl = formData.get("existingImageUrl") as string | null;

  if (!title || !content) {
    throw new Error("El título y el contenido son obligatorios");
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
  revalidatePath("/erp/sitio-web");
  return { success: true };
}

// 3. Eliminar artículo (Post)
export async function deletePostAction(id: string) {
  await assertWritePermission("/erp/sitio-web");

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("web_posts")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Error al eliminar el artículo: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/erp/sitio-web");
  return { success: true };
}
