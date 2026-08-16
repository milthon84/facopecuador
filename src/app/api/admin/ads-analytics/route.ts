import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let targetUrl = searchParams.get("url")?.trim();

  if (!targetUrl || !targetUrl.startsWith("http")) {
    try {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("web_settings")
        .select("value")
        .eq("key", "ads_config")
        .maybeSingle();

      if (data?.value?.url && typeof data.value.url === "string" && data.value.url.startsWith("http")) {
        targetUrl = data.value.url.trim();
      }
    } catch {}
  }

  if (!targetUrl || !targetUrl.startsWith("http")) {
    targetUrl = process.env.ADS_API_URL || process.env.NEXT_PUBLIC_ADS_API_URL || "";
  }

  if (!targetUrl || !targetUrl.startsWith("http")) {
    return NextResponse.json(
      { error: "URL de Apps Script / Meta no configurada en el sistema. Inicie sesión como Administrador para ingresar la URL." },
      { status: 400 }
    );
  }

  try {
    // Realizamos la petición desde el servidor (Node.js) para evitar bloqueo de CORS en el navegador
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "FACOP-Ads-Analytics/1.0",
      },
      cache: "no-store",
      redirect: "follow",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `El servidor de Apps Script respondió con estado HTTP ${res.status}` },
        { status: res.status }
      );
    }

    const text = await res.text();

    try {
      const data = JSON.parse(text);
      return NextResponse.json({ success: true, data });
    } catch (parseErr) {
      // Si Google Apps Script devolvió una página HTML de Login o Permisos
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return NextResponse.json(
          {
            error:
              "Google Apps Script devolvió una página HTML en lugar de JSON. Verifica la configuración de publicación de tu Aplicación Web: en 'Quién tiene acceso' debes seleccionar 'Cualquier persona' (Anyone).",
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "La respuesta obtenida desde la URL no es un formato JSON válido." },
        { status: 400 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: `Error de conexión servidor a servidor: ${err.message || err}` },
      { status: 500 }
    );
  }
}
