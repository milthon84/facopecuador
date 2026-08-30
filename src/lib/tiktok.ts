/**
 * Utilidades para interactuar con la Content Posting API de TikTok (v2)
 */

interface PublishTikTokParams {
  title: string;
  content: string;
  videoUrl: string | null;
}

interface PublishTikTokResult {
  tiktokPostId?: string;
  error?: string;
}

/**
 * Publica un video publicitario en la cuenta vinculada de TikTok a través de TikTok Content Posting API v2
 */
export async function publishToTikTok({
  title,
  content,
  videoUrl,
}: PublishTikTokParams): Promise<PublishTikTokResult> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;

  if (!accessToken) {
    return {
      error: "Falta el token de acceso de TikTok (TIKTOK_ACCESS_TOKEN en .env.local).",
    };
  }

  if (!videoUrl) {
    return {
      error: "TikTok requiere obligatoriamente un archivo de video (MP4/MOV). No se puede publicar solo texto o imagen estática.",
    };
  }

  const caption = `${title}\n\n${content}`.slice(0, 2000); // Límite de 2000 caracteres en TikTok

  try {
    // Inicializar la publicación de video en TikTok (PULL_FROM_URL)
    const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: caption,
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false,
          video_cover_timestamp_ms: 500,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl,
        },
      }),
    });

    const initData = await initRes.json();

    if (initData.error && initData.error.code !== "ok") {
      console.error("TikTok API Init Error:", initData.error);
      return {
        error: `Error en TikTok API: ${initData.error.message || JSON.stringify(initData.error)}`,
      };
    }

    const publishId = initData.data?.publish_id;
    if (publishId) {
      return {
        tiktokPostId: `https://www.tiktok.com/@facop/video/${publishId}`,
      };
    }

    return {
      error: "TikTok inició la solicitud pero no devolvió el ID de publicación.",
    };
  } catch (err: any) {
    console.error("TikTok publish exception:", err);
    return {
      error: `Excepción de conexión con TikTok API: ${err.message || err}`,
    };
  }
}
