"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { triggerDoorOpen, type DoorSettingsDef } from "@/lib/ewelink";
import { revalidatePath } from "next/cache";

export async function getDoorSettingsAction(): Promise<{
  success: boolean;
  settings?: DoorSettingsDef;
  error?: string;
  canEdit?: boolean;
}> {
  try {
    const sessionSupabase = createClient();
    const { data: { user } } = await sessionSupabase.auth.getUser();

    if (!user) return { success: false, error: "No autenticado" };

    const supabase = createAdminClient();
    const { data } = await supabase
      .from("door_settings")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const role = (user.app_metadata?.role as string) ?? "recepcionista";
    let canEdit = role === "admin";
    if (role !== "admin") {
      const { data: perm } = await supabase
        .from("role_permissions")
        .select("path")
        .eq("role_name", role)
        .eq("path", "/erp/puerta/modificar")
        .maybeSingle();
      canEdit = !!perm;
    }

    const settings: DoorSettingsDef = data || {
      device_id: "1002906ff1",
      device_name: "Puerta Principal",
      connection_mode: "webhook",
      webhook_url: null,
      app_id: null,
      app_secret: null,
      email: null,
      password: null,
      region: "us",
      is_enabled: true,
      auto_close_seconds: 3,
    };

    // Ocultar contraseña para el cliente y detectar si está conectado vía OAuth
    let is_oauth_configured = false;
    if (settings.password && settings.password.startsWith('{"type":"oauth"')) {
      try {
        const parsed = JSON.parse(settings.password);
        if (parsed.at) {
          is_oauth_configured = true;
          if (parsed.email && !settings.email) {
            settings.email = parsed.email;
          }
        }
      } catch (e) {}
    }

    settings.is_oauth_configured = is_oauth_configured;

    if (settings.password) {
      settings.password = is_oauth_configured ? "[CONECTADO_VIA_OAUTH]" : "••••••••";
    }

    return {
      success: true,
      settings,
      canEdit,
    };
  } catch (err: any) {
    console.error("Error en getDoorSettingsAction:", err);
    return { success: false, error: err.message };
  }
}

export async function updateDoorSettingsAction(formData: {
  device_id: string;
  device_name: string;
  connection_mode: "webhook" | "api";
  webhook_url?: string;
  app_id?: string;
  app_secret?: string;
  email?: string;
  password?: string;
  region: string;
  is_enabled: boolean;
  auto_close_seconds: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const sessionSupabase = createClient();
    const { data: { user } } = await sessionSupabase.auth.getUser();

    if (!user) return { success: false, error: "No autenticado" };

    const supabase = createAdminClient();
    const role = (user.app_metadata?.role as string) ?? "recepcionista";

    if (role !== "admin") {
      const { data: perm } = await supabase
        .from("role_permissions")
        .select("path")
        .eq("role_name", role)
        .eq("path", "/erp/puerta/modificar")
        .maybeSingle();

      if (!perm) {
        return { success: false, error: "Tu rol no tiene permiso para cambiar la configuración de la puerta." };
      }
    }

    const { data: existing } = await supabase
      .from("door_settings")
      .select("id, password")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const updatePayload: any = {
      device_id: formData.device_id.trim() || "1002906ff1",
      device_name: formData.device_name.trim() || "Puerta Principal",
      connection_mode: formData.connection_mode,
      webhook_url: formData.webhook_url?.trim() || null,
      app_id: formData.app_id?.trim() || null,
      email: formData.email?.trim() || null,
      region: formData.region || "us",
      is_enabled: formData.is_enabled,
      auto_close_seconds: Number(formData.auto_close_seconds) || 3,
      updated_at: new Date().toISOString(),
    };

    // Solo actualizar password si se ingresó uno nuevo (y no contiene caracteres de bala • ni la marca de oauth)
    if (formData.password && !formData.password.includes("•") && formData.password !== "[CONECTADO_VIA_OAUTH]") {
      updatePayload.password = formData.password.trim();
    }

    // Solo actualizar app_secret si se ingresó uno nuevo
    if (formData.app_secret && !formData.app_secret.includes("•")) {
      updatePayload.app_secret = formData.app_secret.trim();
    }

    if (existing?.id) {
      await supabase
        .from("door_settings")
        .update(updatePayload)
        .eq("id", existing.id);
    } else {
      await supabase
        .from("door_settings")
        .insert(updatePayload);
    }

    await logAudit({
      user_id: user.id,
      user_email: user.email,
      action: "update",
      resource: "door_access",
      description: `Configuración de puerta actualizada (Dispositivo: ${updatePayload.device_id}, Modo: ${updatePayload.connection_mode})`,
    });

    revalidatePath("/erp");
    return { success: true };
  } catch (err: any) {
    console.error("Error en updateDoorSettingsAction:", err);
    return { success: false, error: err.message };
  }
}

export async function openDoorAction(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  needConfig?: boolean;
}> {
  try {
    const sessionSupabase = createClient();
    const { data: { user } } = await sessionSupabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Debes iniciar sesión para abrir la puerta." };
    }

    const supabase = createAdminClient();
    const role = (user.app_metadata?.role as string) ?? "recepcionista";
    if (role !== "admin") {
      const { data: perms } = await supabase
        .from("role_permissions")
        .select("path")
        .eq("role_name", role)
        .in("path", ["/erp/puerta", "/erp/puerta/modificar"]);

      if (!perms || perms.length === 0) {
        return { success: false, error: "Tu rol no tiene permiso para abrir la puerta." };
      }
    }
    const { data: rawSettings } = await supabase
      .from("door_settings")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const settings: DoorSettingsDef = rawSettings || {
      device_id: "1002906ff1",
      device_name: "Puerta Principal",
      connection_mode: "webhook",
      webhook_url: null,
      region: "us",
      is_enabled: true,
      auto_close_seconds: 3,
    };

    // Si está en modo webhook y no hay URL, o modo api y no hay credenciales
    if (
      (settings.connection_mode === "webhook" && !settings.webhook_url?.trim()) ||
      (settings.connection_mode === "api" && (!settings.email || !settings.password))
    ) {
      return {
        success: false,
        needConfig: true,
        error: "Falta configurar el Webhook o las credenciales de eWeLink para el dispositivo " + settings.device_id,
      };
    }

    const result = await triggerDoorOpen(settings);

    if (result.success) {
      await logAudit({
        user_id: user.id,
        user_email: user.email,
        action: "create",
        resource: "door_access",
        description: `Apertura manual de puerta (${settings.device_name} - ${settings.device_id}) ejecutada por ${user.email}`,
        metadata: {
          device_id: settings.device_id,
          mode: settings.connection_mode,
        },
      });
    }

    return result;
  } catch (err: any) {
    console.error("Error en openDoorAction:", err);
    return { success: false, error: err.message || "Error al procesar la apertura de puerta." };
  }
}

export async function testDoorSettingsAction(formData: {
  device_id: string;
  device_name: string;
  connection_mode: "webhook" | "api";
  webhook_url?: string;
  app_id?: string;
  app_secret?: string;
  email?: string;
  password?: string;
  region: string;
  is_enabled: boolean;
  auto_close_seconds: number;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const sessionSupabase = createClient();
    const { data: { user } } = await sessionSupabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Debes iniciar sesión para realizar la prueba." };
    }

    const supabase = createAdminClient();
    const role = (user.app_metadata?.role as string) ?? "recepcionista";
    if (role !== "admin") {
      const { data: perm } = await supabase
        .from("role_permissions")
        .select("path")
        .eq("role_name", role)
        .eq("path", "/erp/puerta/modificar")
        .maybeSingle();

      if (!perm) {
        return { success: false, error: "Tu rol no tiene permiso para probar la configuración." };
      }
    }

    let effectivePassword = formData.password?.trim();
    let effectiveSecret = formData.app_secret?.trim();

    // Si los campos sensibles vienen vacíos, enmascarados o con la marca de OAuth, intentar obtenerlos de la BD
    if (
      !effectivePassword ||
      effectivePassword.includes("•") ||
      effectivePassword === "[CONECTADO_VIA_OAUTH]" ||
      !effectiveSecret ||
      effectiveSecret.includes("•")
    ) {
      const { data: existing } = await supabase
        .from("door_settings")
        .select("password, app_secret")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!effectivePassword || effectivePassword.includes("•") || effectivePassword === "[CONECTADO_VIA_OAUTH]") {
        effectivePassword = existing?.password || "";
      }
      if (!effectiveSecret || effectiveSecret.includes("•")) {
        effectiveSecret = existing?.app_secret || "";
      }
    }

    const settings: DoorSettingsDef = {
      device_id: formData.device_id.trim() || "1002906ff1",
      device_name: formData.device_name.trim() || "Puerta Principal",
      connection_mode: formData.connection_mode,
      webhook_url: formData.webhook_url?.trim() || null,
      app_id: formData.app_id?.trim() || null,
      app_secret: effectiveSecret || null,
      email: formData.email?.trim() || null,
      password: effectivePassword || null,
      region: formData.region || "us",
      is_enabled: true,
      auto_close_seconds: Number(formData.auto_close_seconds) || 3,
    };

    if (
      (settings.connection_mode === "webhook" && !settings.webhook_url?.trim()) ||
      (settings.connection_mode === "api" && (!settings.password || !settings.app_id || !settings.app_secret))
    ) {
      return {
        success: false,
        error: "Falta configurar los campos obligatorios o conectar tu cuenta de eWeLink antes de probar.",
      };
    }

    return await triggerDoorOpen(settings);
  } catch (err: any) {
    console.error("Error en testDoorSettingsAction:", err);
    return { success: false, error: err.message || "Error al probar la puerta." };
  }
}

export async function disconnectEWeLinkAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const sessionSupabase = createClient();
    const { data: { user } } = await sessionSupabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

    const supabase = createAdminClient();
    const { data: existing } = await supabase
      .from("door_settings")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("door_settings")
        .update({
          password: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
    revalidatePath("/erp");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

