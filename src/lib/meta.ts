/**
 * Utilidades para interactuar con la Graph API de Meta (Facebook e Instagram)
 */

interface PublishParams {
  title: string;
  content: string;
  imageUrl: string | null;
  videoUrl: string | null;
  publishFacebook: boolean;
  publishInstagram: boolean;
  category?: string;
}

interface PublishResult {
  facebookPostId?: string;
  instagramPostId?: string;
  errors?: string[];
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Publica un artículo en la página de Facebook y/o cuenta comercial de Instagram configuradas.
 * Selecciona dinámicamente entre la cuenta de Clínica Quito y FACOP Ecuador según la categoría.
 */
export async function publishToMeta({
  title,
  content,
  imageUrl,
  videoUrl,
  publishFacebook,
  publishInstagram,
  category,
}: PublishParams): Promise<PublishResult> {
  const isEcuadorBrand = category === "cursos" || category === "coworking";

  const pageId = isEcuadorBrand
    ? (process.env.META_ECUADOR_PAGE_ID || process.env.META_PAGE_ID)
    : process.env.META_PAGE_ID;

  const pageAccessToken = isEcuadorBrand
    ? (process.env.META_ECUADOR_PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN)
    : process.env.META_PAGE_ACCESS_TOKEN;

  const instagramAccountId = isEcuadorBrand
    ? (process.env.META_ECUADOR_INSTAGRAM_BUSINESS_ACCOUNT_ID || process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID)
    : process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID;

  const result: PublishResult = {};
  const errors: string[] = [];

  const postText = `${title}\n\n${content}`;

  // 1. PUBLICACIÓN EN FACEBOOK PAGE
  if (publishFacebook) {
    if (!pageId || !pageAccessToken) {
      errors.push(
        "Faltan credenciales de Facebook (META_PAGE_ID o META_PAGE_ACCESS_TOKEN) en el servidor."
      );
    } else {
      try {
        let res;
        if (videoUrl) {
          // Publicar con video en la página como publicación orgánica pública
          res = await fetch(`https://graph.facebook.com/v20.0/${pageId}/videos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file_url: videoUrl,
              description: postText,
              published: true,
              access_token: pageAccessToken,
            }),
          });
        } else if (imageUrl) {
          // Publicar con imagen como foto orgánica en el muro público de la página
          res = await fetch(`https://graph.facebook.com/v20.0/${pageId}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: imageUrl,
              caption: postText,
              published: true,
              access_token: pageAccessToken,
            }),
          });
        } else {
          // Publicar feed de texto simple orgánico en el muro
          res = await fetch(`https://graph.facebook.com/v20.0/${pageId}/feed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: postText,
              published: true,
              access_token: pageAccessToken,
            }),
          });
        }

        const data = await res.json();
        if (data.error) {
          console.error("Meta API Facebook error:", data.error);
          errors.push(
            `Error en Facebook: ${data.error.message || JSON.stringify(data.error)}`
          );
        } else {
          const fbPostId = data.post_id || data.id;
          try {
            const fbPermalinkRes = await fetch(
              `https://graph.facebook.com/v20.0/${fbPostId}?fields=permalink_url&access_token=${pageAccessToken}`
            );
            const fbPermalinkData = await fbPermalinkRes.json();
            if (fbPermalinkData.permalink_url) {
              result.facebookPostId = fbPermalinkData.permalink_url;
            } else {
              result.facebookPostId = `https://facebook.com/${fbPostId}`;
            }
          } catch (err) {
            result.facebookPostId = `https://facebook.com/${fbPostId}`;
          }
        }
      } catch (err: any) {
        console.error("Facebook publish exception:", err);
        errors.push(
          `Error de conexión al publicar en Facebook: ${err.message || err}`
        );
      }
    }
  }

  // 2. PUBLICACIÓN EN INSTAGRAM BUSINESS ACCOUNT
  if (publishInstagram) {
    if (!instagramAccountId || !pageAccessToken) {
      errors.push(
        "Faltan credenciales de Instagram (META_INSTAGRAM_BUSINESS_ACCOUNT_ID o META_PAGE_ACCESS_TOKEN) en el servidor."
      );
    } else if (!imageUrl && !videoUrl) {
      errors.push(
        "Instagram requiere una imagen o un video. No se puede publicar texto sin elementos multimedia."
      );
    } else {
      try {
        let containerRes;
        if (videoUrl) {
          // A. Crear contenedor de video (REELS)
          containerRes = await fetch(
            `https://graph.facebook.com/v20.0/${instagramAccountId}/media`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                media_type: "REELS",
                video_url: videoUrl,
                caption: postText,
                access_token: pageAccessToken,
              }),
            }
          );
        } else {
          // A. Crear contenedor de imagen
          containerRes = await fetch(
            `https://graph.facebook.com/v20.0/${instagramAccountId}/media`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image_url: imageUrl,
                caption: postText,
                access_token: pageAccessToken,
              }),
            }
          );
        }

        const containerData = await containerRes.json();
        if (containerData.error) {
          console.error("Meta API Instagram Container error:", containerData.error);
          errors.push(
            `Error de contenedor en Instagram: ${
              containerData.error.message || JSON.stringify(containerData.error)
            }`
          );
        } else {
          const creationId = containerData.id;

          // B. Polling universal de estado del contenedor (tanto para imágenes como para videos)
          let publishData: any = null;
          let success = false;
          let isReady = false;
          for (let attempt = 1; attempt <= 12; attempt++) {
            try {
              const statusRes = await fetch(
                `https://graph.facebook.com/v20.0/${creationId}?fields=status_code,status&access_token=${pageAccessToken}`
              );
              const statusData = await statusRes.json();
              const statusCode = statusData.status_code;

              if (statusCode === "FINISHED") {
                isReady = true;
                break;
              } else if (statusCode === "ERROR") {
                console.error("Meta API Instagram status ERROR:", statusData);
                errors.push("Instagram no pudo procesar la imagen/video. Verifica que el archivo sea accesible públicamente.");
                break;
              } else if (statusCode === "EXPIRED") {
                errors.push("El recurso multimedia en Instagram expiró.");
                break;
              }

              console.log(`Instagram procesando recurso multimedia (${statusCode || "IN_PROGRESS"}) (intento ${attempt}/12). Esperando 2.5s...`);
              await delay(2500);
            } catch (pollErr: any) {
              console.error("Error al consultar estado de contenedor en Instagram:", pollErr);
            }
          }

          if (!isReady && errors.length === 0) {
            errors.push("El recurso en Instagram tardó demasiado tiempo en estar disponible.");
          }

          // C. Publicar en Instagram únicamente cuando el estado esté en FINISHED
          if (isReady) {
            for (let attempt = 1; attempt <= 5; attempt++) {
              const publishRes = await fetch(
                `https://graph.facebook.com/v20.0/${instagramAccountId}/media_publish`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    creation_id: creationId,
                    access_token: pageAccessToken,
                  }),
                }
              );

              publishData = await publishRes.json();

              if (publishData.error) {
                const code = publishData.error.code;
                const msg = publishData.error.message || "";
                const isProcessing =
                  code === 22070 || msg.toLowerCase().includes("processing") || msg.toLowerCase().includes("not available");

                if (isProcessing && attempt < 5) {
                  console.log(
                    `El recurso de Instagram se está procesando aún. Reintentando en 3s (intento ${attempt}/5)...`
                  );
                  await delay(3000);
                  continue;
                } else {
                  console.error("Meta API Instagram Publish error:", publishData.error);
                  errors.push(
                    `Error de publicación en Instagram: ${
                      publishData.error.message || JSON.stringify(publishData.error)
                    }`
                  );
                  break;
                }
              } else {
                const mediaId = publishData.id;
                try {
                  const igPermalinkRes = await fetch(
                    `https://graph.facebook.com/v20.0/${mediaId}?fields=permalink&access_token=${pageAccessToken}`
                  );
                  const igPermalinkData = await igPermalinkRes.json();
                  if (igPermalinkData.permalink) {
                    result.instagramPostId = igPermalinkData.permalink;
                  } else {
                    result.instagramPostId = `https://instagram.com/p/${mediaId}`;
                  }
                } catch (err) {
                  result.instagramPostId = `https://instagram.com/p/${mediaId}`;
                }
                success = true;
                break;
              }
            }
          }
        }
      } catch (err: any) {
        console.error("Instagram publish exception:", err);
        errors.push(
          `Error de conexión al publicar en Instagram: ${err.message || err}`
        );
      }
    }
  }

  if (errors.length > 0) {
    result.errors = errors;
  }

  return result;
}

interface DeleteParams {
  facebookPostId?: string | null;
  instagramPostId?: string | null;
  category?: string;
}

/**
 * Eliminación / despublicación de un post en Facebook e Instagram Graph API
 */
export async function deleteFromMeta({
  facebookPostId,
  instagramPostId,
  category,
}: DeleteParams): Promise<{ errors?: string[] }> {
  const isEcuadorBrand = category === "cursos" || category === "coworking";
  const pageAccessToken = isEcuadorBrand
    ? (process.env.META_ECUADOR_PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN)
    : process.env.META_PAGE_ACCESS_TOKEN;

  const errors: string[] = [];

  if (!pageAccessToken) {
    return {};
  }

  // 1. Despublicar de Facebook Page
  if (facebookPostId) {
    try {
      let fbId = facebookPostId;
      if (fbId.includes("facebook.com")) {
        try {
          const urlObj = new URL(fbId.startsWith("http") ? fbId : `https://${fbId}`);
          const pathSegments = urlObj.pathname.split("/").filter(Boolean);
          if (pathSegments.includes("posts") && pathSegments.length >= 3) {
            const pageId = pathSegments[0];
            const postId = pathSegments[pathSegments.length - 1];
            fbId = `${pageId}_${postId}`;
          } else {
            fbId = pathSegments[pathSegments.length - 1];
          }
        } catch {
          // fallback si no parsea URL
        }
      }

      console.log(`Eliminando publicación en Facebook Graph API con ID: ${fbId}`);
      const res = await fetch(`https://graph.facebook.com/v20.0/${fbId}?access_token=${pageAccessToken}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error && !data.error.message?.includes("does not exist")) {
        console.error("Meta API Facebook Delete Error:", data.error);
        errors.push(`Error en Facebook al despublicar: ${data.error.message || JSON.stringify(data.error)}`);
      } else {
        console.log("Publicación despublicada / eliminada exitosamente de Facebook");
      }
    } catch (err: any) {
      console.error("Excepción al eliminar de Facebook:", err);
      errors.push(`Excepción al despublicar de Facebook: ${err.message || err}`);
    }
  }

  // 2. Despublicar de Instagram Business Account
  if (instagramPostId) {
    try {
      let igId = instagramPostId;
      if (igId.includes("instagram.com")) {
        try {
          const urlObj = new URL(igId.startsWith("http") ? igId : `https://${igId}`);
          const pathSegments = urlObj.pathname.split("/").filter(Boolean);
          igId = pathSegments[pathSegments.length - 1];
        } catch {
          // fallback
        }
      }

      console.log(`Eliminando publicación en Instagram Graph API con ID: ${igId}`);
      const res = await fetch(`https://graph.facebook.com/v20.0/${igId}?access_token=${pageAccessToken}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error && !data.error.message?.includes("does not exist")) {
        console.error("Meta API Instagram Delete Error:", data.error);
        errors.push(`Error en Instagram al despublicar: ${data.error.message || JSON.stringify(data.error)}`);
      } else {
        console.log("Publicación despublicada / eliminada exitosamente de Instagram");
      }
    } catch (err: any) {
      console.error("Excepción al eliminar de Instagram:", err);
      errors.push(`Excepción al despublicar de Instagram: ${err.message || err}`);
    }
  }

  return { errors: errors.length > 0 ? errors : undefined };
}
