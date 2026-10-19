import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const regionParam = url.searchParams.get("region");
  const returnTo = url.searchParams.get("state") || "/erp/bancos";
  const errorParam = url.searchParams.get("error");

  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const baseUrl = `${proto}://${host}`;

  const cleanReturnTo = returnTo.split("?")[0];

  if (errorParam) {
    const dest = new URL(cleanReturnTo, baseUrl);
    dest.searchParams.set("ewelink_error", `eWeLink rechazó la autorización: ${errorParam}`);
    return NextResponse.redirect(dest);
  }

  if (!code) {
    const dest = new URL(cleanReturnTo, baseUrl);
    dest.searchParams.set("ewelink_error", "No se recibió el código de autorización desde eWeLink.");
    return NextResponse.redirect(dest);
  }

  try {
    const supabase = createAdminClient();
    const { data: settings } = await supabase
      .from("door_settings")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!settings || !settings.app_id || !settings.app_secret) {
      throw new Error("No se encontró la configuración de App ID y App Secret en el sistema.");
    }

    const appId = settings.app_id.trim();
    const appSecret = settings.app_secret.trim();
    const region = regionParam || settings.region || "us";
    const redirectUrl = `${baseUrl}/api/ewelink/callback`;

    // 1. Intercambiar código por Access Token (at) y Refresh Token (rt)
    const tokenUrl = `https://${region}-apia.coolkit.cc/v2/user/oauth/token`;
    const tokenPayload = JSON.stringify({
      code,
      redirectUrl,
      grantType: "authorization_code",
    });

    const sign = crypto
      .createHmac("sha256", appSecret)
      .update(tokenPayload)
      .digest("base64");
    const nonce = crypto.randomBytes(4).toString("hex");

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-CK-Appid": appId,
        "X-CK-Nonce": nonce,
        Authorization: `Sign ${sign}`,
      },
      body: tokenPayload,
      cache: "no-store",
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error !== 0) {
      const msg = tokenData.msg || `Código ${tokenData.error}`;
      throw new Error(`eWeLink respondió: ${msg}`);
    }

    const dataObj = tokenData.data || tokenData;
    const at =
      dataObj.at ||
      dataObj.accessToken ||
      dataObj.access_token ||
      dataObj.token;
    const rt =
      dataObj.rt ||
      dataObj.refreshToken ||
      dataObj.refresh_token ||
      "";
    const user = dataObj.user || dataObj.userInfo || null;
    const finalRegion = dataObj.region || tokenData.region || region;

    if (!at) {
      throw new Error(
        `eWeLink respondió exitoso (código 0) pero sin token: ${JSON.stringify(dataObj)}`
      );
    }

    // 2. Guardar token en door_settings
    const oauthPayload = JSON.stringify({
      type: "oauth",
      at,
      rt,
      accessToken: at,
      refreshToken: rt,
      email: user?.email || settings.email || "",
      nickname: user?.nickname || "",
      updated_at: new Date().toISOString(),
    });

    await supabase
      .from("door_settings")
      .update({
        connection_mode: "api",
        password: oauthPayload,
        region: finalRegion,
        email: user?.email || settings.email || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id);

    await logAudit({
      user_id: user?.id || "system",
      user_email: user?.email || "ewelink_oauth",
      action: "update",
      resource: "door_access",
      description: `eWeLink vinculado exitosamente vía OAuth (Cuenta: ${user?.email || "eWeLink User"})`,
    });

    const successDest = new URL(cleanReturnTo, baseUrl);
    successDest.searchParams.set("ewelink_success", "true");
    successDest.searchParams.set("ewelink_email", user?.email || "");
    return NextResponse.redirect(successDest);
  } catch (err: any) {
    console.error("Error en callback de eWeLink:", err);
    const errDest = new URL(cleanReturnTo, baseUrl);
    errDest.searchParams.set("ewelink_error", err.message || "Error al vincular con eWeLink");
    return NextResponse.redirect(errDest);
  }
}
