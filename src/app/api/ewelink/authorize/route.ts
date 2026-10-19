import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { data: settings } = await supabase
      .from("door_settings")
      .select("id, app_id, app_secret, region")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const url = new URL(req.url);
    const appId = (url.searchParams.get("app_id") || settings?.app_id || "").trim();
    const appSecret = (url.searchParams.get("app_secret") || settings?.app_secret || "").trim();
    const returnTo = url.searchParams.get("return_to") || "/erp/bancos";

    if (!appId || !appSecret) {
      const errUrl = new URL(returnTo, req.url);
      errUrl.searchParams.set("ewelink_error", "Falta configurar el App ID y App Secret en la ventana de configuración.");
      return NextResponse.redirect(errUrl);
    }

    // Si se enviaron por query params y no estaban en la BD o eran diferentes, actualizarlos
    if (appId !== settings?.app_id || appSecret !== settings?.app_secret) {
      if (settings) {
        await supabase
          .from("door_settings")
          .update({
            app_id: appId,
            app_secret: appSecret,
            updated_at: new Date().toISOString(),
          })
          .eq("id", settings.id);
      }
    }

    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
    const redirectUrl = `${proto}://${host}/api/ewelink/callback`;

    const seq = Date.now().toString();
    const nonce = crypto.randomBytes(4).toString("hex");
    const sign = crypto
      .createHmac("sha256", appSecret)
      .update(`${appId}_${seq}`)
      .digest("base64");

    const authUrl = `https://c2ccdn.coolkit.cc/oauth/index.html?clientId=${encodeURIComponent(
      appId
    )}&redirectUrl=${encodeURIComponent(
      redirectUrl
    )}&grantType=authorization_code&state=${encodeURIComponent(returnTo)}&nonce=${nonce}&seq=${seq}&authorization=${encodeURIComponent(
      sign
    )}`;

    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    console.error("Error en /api/ewelink/authorize:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
