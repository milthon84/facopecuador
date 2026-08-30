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
export async function savePostAction(formData: FormData): Promise<{ success: boolean; error?: string; publishWarning?: string }> {
  try {
    await assertWritePermission("/erp/publicidad");

    const id = formData.get("id") as string | null;
    const title = (formData.get("title") as string)?.trim();
    const content = (formData.get("content") as string)?.trim();
    const status = formData.get("status") as "draft" | "published";
    const category = formData.get("category") as string;
    const expiresAtInput = (formData.get("expires_at") as string)?.trim();
    
    const imageFile = formData.get("imageFile") as File | null;
    let imageUrl = formData.get("existingImageUrl") as string | null;

    const videoFile = formData.get("videoFile") as File | null;
    let videoUrl = formData.get("existingVideoUrl") as string | null;

    if (!title || !content) {
      return { success: false, error: "El título y el contenido son obligatorios" };
    }

    if (!["cursos", "clinica", "coworking"].includes(category)) {
      return { success: false, error: "Debes seleccionar un destino válido para el artículo" };
    }

    // Fecha de expiración: si no se especifica, por defecto 2 meses desde hoy
    let expiresAt: string;
    if (expiresAtInput) {
      const parsed = new Date(`${expiresAtInput}T23:59:59`);
      if (isNaN(parsed.getTime())) {
        return { success: false, error: "La fecha de expiración no es válida" };
      }
      expiresAt = parsed.toISOString();
    } else {
      const fallback = new Date();
      fallback.setMonth(fallback.getMonth() + 2);
      expiresAt = fallback.toISOString();
    }

    const slug = slugify(title);
    const supabase = createAdminClient();

    // Procesar archivo de imagen si fue seleccionado
    if (imageFile && imageFile.size > 0) {
      try {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Date.now()}_img.${fileExt}`;
        const arrayBuffer = await imageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabase.storage
          .from("web-assets")
          .upload(fileName, buffer, {
            contentType: imageFile.type || "image/jpeg",
            upsert: true,
          });

        if (!uploadError) {
          const { data } = supabase.storage.from("web-assets").getPublicUrl(fileName);
          imageUrl = data.publicUrl;
        } else {
          console.error("Error al subir archivo de imagen:", uploadError.message);
          return { success: false, error: `Error al subir la imagen de portada: ${uploadError.message}` };
        }
      } catch (err: any) {
        console.error("Excepción al subir archivo de imagen:", err);
        return { success: false, error: `Excepción al procesar la imagen: ${err?.message || err}` };
      }
    }

    // Procesar archivo de video si fue seleccionado
    if (videoFile && videoFile.size > 0) {
      // Límite de 100MB
      if (videoFile.size > 100 * 1024 * 1024) {
        return { success: false, error: "El archivo de video supera el límite de 100 MB permitido." };
      }
      try {
        const fileExt = videoFile.name.split(".").pop();
        const fileName = `${Date.now()}_vid.${fileExt}`;
        const arrayBuffer = await videoFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabase.storage
          .from("web-assets")
          .upload(fileName, buffer, {
            contentType: videoFile.type || "video/mp4",
            upsert: true,
          });

        if (!uploadError) {
          const { data } = supabase.storage.from("web-assets").getPublicUrl(fileName);
          videoUrl = data.publicUrl;
        } else {
          console.error("Error al subir archivo de video:", uploadError.message);
          return {
            success: false,
            error: `Error al subir el video a Supabase Storage: ${uploadError.message}. Verifica que el bucket 'web-assets' exista y esté configurado como público.`
          };
        }
      } catch (err: any) {
        console.error("Excepción al subir archivo de video:", err);
        return { success: false, error: `Excepción al procesar el archivo de video: ${err?.message || err}` };
      }
    }

    const publishFacebook = formData.get("publish_to_facebook") === "true";
    const publishInstagram = formData.get("publish_to_instagram") === "true";
    const publishTikTok = formData.get("publish_to_tiktok") === "true";

    let facebookPostId: string | null = null;
    let instagramPostId: string | null = null;
    let tiktokPostId: string | null = null;
    let publishWarning: string | null = null;

    if (id) {
      // Obtener IDs de publicación en redes sociales ya existentes
      const { data: existingPost } = await supabase
        .from("web_posts")
        .select("facebook_post_id, instagram_post_id, tiktok_post_id")
        .eq("id", id)
        .single();
      if (existingPost) {
        facebookPostId = existingPost.facebook_post_id;
        instagramPostId = existingPost.instagram_post_id;
        tiktokPostId = (existingPost as any).tiktok_post_id || null;
      }
    }

    const isExpiredOrDraft = status === "draft" || (expiresAtInput && new Date(`${expiresAtInput}T23:59:59`).getTime() < Date.now());

    // SI EL USUARIO DESMARCÓ FACEBOOK / INSTAGRAM / TIKTOK, O EL ANUNCIO EXPIRÓ / PASÓ A BORRADOR:
    const unpublishFacebook = id && facebookPostId && (!publishFacebook || isExpiredOrDraft);
    const unpublishInstagram = id && instagramPostId && (!publishInstagram || isExpiredOrDraft);
    const unpublishTikTok = id && tiktokPostId && (!publishTikTok || isExpiredOrDraft);

    if (unpublishFacebook || unpublishInstagram) {
      try {
        const { deleteFromMeta } = await import("@/lib/meta");
        const deleteRes = await deleteFromMeta({
          facebookPostId: unpublishFacebook ? facebookPostId : null,
          instagramPostId: unpublishInstagram ? instagramPostId : null,
          category,
        });

        if (deleteRes.errors && deleteRes.errors.length > 0) {
          publishWarning = `Despublicado de Meta con advertencias: ${deleteRes.errors.join(". ")}`;
        }
      } catch (err: any) {
        console.error("Error al despublicar de Meta:", err);
      }

      if (unpublishFacebook) facebookPostId = null;
      if (unpublishInstagram) instagramPostId = null;
    }

    if (unpublishTikTok) {
      tiktokPostId = null;
    }

    // SI EL ANUNCIO ESTÁ PUBLICADO Y VIGENTE, Y SE MARCÓ PUBLICAR EN REDES SOCIALES:
    if (status === "published" && !isExpiredOrDraft) {
      const shouldPublishFacebook = publishFacebook && !facebookPostId;
      const shouldPublishInstagram = publishInstagram && !instagramPostId;

      if (shouldPublishFacebook || shouldPublishInstagram) {
        try {
          const { publishToMeta } = await import("@/lib/meta");
          const publishResult = await publishToMeta({
            title,
            content,
            imageUrl,
            videoUrl,
            publishFacebook: shouldPublishFacebook,
            publishInstagram: shouldPublishInstagram,
            category,
          });

          if (publishResult.facebookPostId) {
            facebookPostId = publishResult.facebookPostId;
          }
          if (publishResult.instagramPostId) {
            instagramPostId = publishResult.instagramPostId;
          }
          if (publishResult.errors && publishResult.errors.length > 0) {
            publishWarning = (publishWarning ? publishWarning + ". " : "") + publishResult.errors.join(". ");
          }
        } catch (err: any) {
          console.error("Error al publicar en Meta:", err);
          publishWarning = (publishWarning ? publishWarning + ". " : "") + `No se pudo conectar con Meta: ${err.message || err}`;
        }
      }

      // Publicación en TikTok
      const shouldPublishTikTok = publishTikTok && !tiktokPostId;
      if (shouldPublishTikTok) {
        try {
          const { publishToTikTok } = await import("@/lib/tiktok");
          const ttResult = await publishToTikTok({
            title,
            content,
            videoUrl,
          });

          if (ttResult.tiktokPostId) {
            tiktokPostId = ttResult.tiktokPostId;
          } else if (ttResult.error) {
            publishWarning = (publishWarning ? publishWarning + ". " : "") + `TikTok: ${ttResult.error}`;
          }
        } catch (err: any) {
          console.error("Error al publicar en TikTok:", err);
          publishWarning = (publishWarning ? publishWarning + ". " : "") + `No se pudo conectar con TikTok: ${err.message || err}`;
        }
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
      video_url: videoUrl,
      facebook_post_id: facebookPostId,
      instagram_post_id: instagramPostId,
      tiktok_post_id: tiktokPostId,
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
        return { success: false, error: `Error al actualizar el artículo en la base de datos: ${error.message}` };
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
        return { success: false, error: `Error al crear el artículo en la base de datos: ${error.message}` };
      }
    }

    revalidatePath("/");
    revalidatePath("/erp/publicidad");
    return { success: true, publishWarning: publishWarning || undefined };
  } catch (err: any) {
    console.error("Error general en savePostAction:", err);
    return { success: false, error: err?.message || "Ocurrió un error inesperado al procesar la solicitud." };
  }
}

// Eliminar artículo (Post)
export async function deletePostAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertWritePermission("/erp/publicidad");

    const supabase = createAdminClient();

    // Despublicar de Meta antes de eliminar de la base de datos
    const { data: post } = await supabase
      .from("web_posts")
      .select("facebook_post_id, instagram_post_id, category")
      .eq("id", id)
      .single();

    if (post && (post.facebook_post_id || post.instagram_post_id)) {
      try {
        const { deleteFromMeta } = await import("@/lib/meta");
        await deleteFromMeta({
          facebookPostId: post.facebook_post_id,
          instagramPostId: post.instagram_post_id,
          category: post.category,
        });
      } catch (err: any) {
        console.error("Error despublicando de Meta al borrar anuncio:", err);
      }
    }

    const { error } = await supabase
      .from("web_posts")
      .delete()
      .eq("id", id);

    if (error) {
      return { success: false, error: `Error al eliminar el artículo: ${error.message}` };
    }

    revalidatePath("/");
    revalidatePath("/erp/publicidad");
    return { success: true };
  } catch (err: any) {
    console.error("Error general en deletePostAction:", err);
    return { success: false, error: err?.message || "Ocurrió un error inesperado al eliminar el artículo." };
  }
}

// Cambiar rápidamente estado (Publicado <-> Borrador)
export async function togglePostStatusAction(id: string, currentStatus: string): Promise<{ success: boolean; error?: string; newStatus?: string }> {
  try {
    await assertWritePermission("/erp/publicidad");

    const newStatus = currentStatus === "published" ? "draft" : "published";
    const supabase = createAdminClient();

    let facebookPostId: string | null | undefined = undefined;
    let instagramPostId: string | null | undefined = undefined;

    // Si se pasa a Borrador (draft), despublicar de Facebook e Instagram
    if (newStatus === "draft") {
      const { data: post } = await supabase
        .from("web_posts")
        .select("facebook_post_id, instagram_post_id, category")
        .eq("id", id)
        .single();

      if (post && (post.facebook_post_id || post.instagram_post_id)) {
        try {
          const { deleteFromMeta } = await import("@/lib/meta");
          await deleteFromMeta({
            facebookPostId: post.facebook_post_id,
            instagramPostId: post.instagram_post_id,
            category: post.category,
          });
        } catch (err: any) {
          console.error("Error despublicando de Meta al cambiar estado a borrador:", err);
        }
        facebookPostId = null;
        instagramPostId = null;
      }
    }

    const updateData: any = {
      status: newStatus,
      published_at: newStatus === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    if (facebookPostId === null) updateData.facebook_post_id = null;
    if (instagramPostId === null) updateData.instagram_post_id = null;

    const { error } = await supabase
      .from("web_posts")
      .update(updateData)
      .eq("id", id);

    if (error) {
      return { success: false, error: `Error al cambiar el estado: ${error.message}` };
    }

    revalidatePath("/");
    revalidatePath("/erp/publicidad");
    return { success: true, newStatus };
  } catch (err: any) {
    console.error("Error general en togglePostStatusAction:", err);
    return { success: false, error: err?.message || "Ocurrió un error al cambiar el estado." };
  }
}
