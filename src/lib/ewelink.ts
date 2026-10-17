import crypto from "crypto";

export interface DoorSettingsDef {
  id?: string;
  device_id: string;
  device_name: string;
  connection_mode: "webhook" | "api";
  webhook_url?: string | null;
  app_id?: string | null;
  app_secret?: string | null;
  email?: string | null;
  password?: string | null;
  region: string;
  is_enabled: boolean;
  auto_close_seconds: number;
}

/**
 * Ejecuta la apertura de la puerta enviando el comando a eWeLink (por Webhook o API CoolKit).
 */
export async function triggerDoorOpen(settings: DoorSettingsDef): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  needConfig?: boolean;
}> {
  if (!settings.is_enabled) {
    return { success: false, error: "El dispositivo de apertura de puerta está deshabilitado." };
  }

  // 1. MODO WEBHOOK (El método más rápido y recomendado para eWeLink / IFTTT)
  if (settings.connection_mode === "webhook") {
    const webhookUrl = settings.webhook_url?.trim();
    if (!webhookUrl) {
      return {
        success: false,
        needConfig: true,
        error: "Debes configurar la URL de Webhook de eWeLink o IFTTT para abrir la puerta.",
      };
    }

    try {
      // Intentar primero con POST
      let response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open",
          deviceId: settings.device_id,
          timestamp: Date.now(),
        }),
        cache: "no-store",
      });

      // Si el webhook solo acepta GET, intentar con GET
      if (!response.ok && (response.status === 405 || response.status === 404)) {
        response = await fetch(webhookUrl, {
          method: "GET",
          cache: "no-store",
        });
      }

      if (!response.ok) {
        throw new Error(`El Webhook respondió con estado HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        message: `¡Puerta abierta! Comando enviado a ${settings.device_name} (${settings.device_id}).`,
      };
    } catch (err: any) {
      console.error("Error al ejecutar Webhook de eWeLink:", err);
      return {
        success: false,
        error: `No se pudo conectar con el Webhook de eWeLink: ${err.message}`,
      };
    }
  }

  // 2. MODO API DIRECTA COOLKIT / EWELINK
  if (settings.connection_mode === "api") {
    const { app_id, app_secret, email, password, region = "us", device_id } = settings;

    if (!email || !password) {
      return {
        success: false,
        needConfig: true,
        error: "Faltan credenciales de eWeLink (correo y contraseña).",
      };
    }

    if (!app_id || !app_secret) {
      return {
        success: false,
        needConfig: true,
        error: "Faltan App ID y App Secret de eWeLink Developer Platform.",
      };
    }

    try {
      const baseUrl = `https://${region}-apia.coolkit.cc/v2`;
      const nonce = crypto.randomBytes(4).toString("hex");

      // Payload login
      const loginBody = JSON.stringify({
        email: email.trim(),
        password: password.trim(),
      });

      const sign = crypto
        .createHmac("sha256", app_secret.trim())
        .update(loginBody)
        .digest("base64");

      const loginRes = await fetch(`${baseUrl}/user/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CK-Appid": app_id.trim(),
          "X-CK-Nonce": nonce,
          Authorization: `Sign ${sign}`,
        },
        body: loginBody,
        cache: "no-store",
      });

      const loginData = await loginRes.json();

      if (loginData.error !== 0 || !loginData.data?.at) {
        throw new Error(
          loginData.msg || loginData.error === 400 ? "Credenciales de eWeLink inválidas." : `Error de login eWeLink: ${loginData.msg || loginData.error}`
        );
      }

      const accessToken = loginData.data.at;

      // Enviar comando para encender relé (Switch: on)
      const statusNonce = crypto.randomBytes(4).toString("hex");
      const switchOnBody = JSON.stringify({
        type: 1,
        id: device_id,
        params: { switch: "on" },
      });

      const switchRes = await fetch(`${baseUrl}/device/thing/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CK-Appid": app_id.trim(),
          "X-CK-Nonce": statusNonce,
          Authorization: `Bearer ${accessToken}`,
        },
        body: switchOnBody,
        cache: "no-store",
      });

      const switchData = await switchRes.json();

      if (switchData.error !== 0) {
        throw new Error(switchData.msg || `Error activando el dispositivo: código ${switchData.error}`);
      }

      // Si no tiene Inching configurado por hardware, apagar después de auto_close_seconds
      if (settings.auto_close_seconds > 0) {
        setTimeout(async () => {
          try {
            const offNonce = crypto.randomBytes(4).toString("hex");
            await fetch(`${baseUrl}/device/thing/status`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-CK-Appid": app_id.trim(),
                "X-CK-Nonce": offNonce,
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                type: 1,
                id: device_id,
                params: { switch: "off" },
              }),
            });
          } catch (e) {
            console.warn("No se pudo enviar comando de apagado automático:", e);
          }
        }, settings.auto_close_seconds * 1000);
      }

      return {
        success: true,
        message: `¡Puerta abierta! Dispositivo ${device_id} activado con éxito.`,
      };
    } catch (err: any) {
      console.error("Error en conexión con eWeLink API:", err);
      return {
        success: false,
        error: `Error al abrir puerta vía eWeLink: ${err.message}`,
      };
    }
  }

  return { success: false, error: "Modo de conexión no soportado." };
}
