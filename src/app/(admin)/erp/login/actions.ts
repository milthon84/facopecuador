"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { translateAuthError } from "@/lib/error-translations";

export async function requestPasswordResetAction(
  email: string,
  origin: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!email || !email.trim()) {
      return { success: false, error: "Por favor ingresa tu correo electrónico." };
    }

    const supabase = createAdminClient();
    const redirectTo = `${origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (error) {
      console.error("Error devuelto por Supabase Auth:", error);
      return { success: false, error: translateAuthError(error.message) };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error en requestPasswordResetAction:", err);
    return {
      success: false,
      error: translateAuthError(err?.message) || "No se pudo enviar el correo de recuperación.",
    };
  }
}

function getUserIdFromToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payloadJson = Buffer.from(parts[1], "base64").toString("utf-8");
      const payload = JSON.parse(payloadJson);
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        console.error("Token de recuperación caducado por exp:", payload.exp);
        return null;
      }
      return payload.sub || null;
    }
  } catch (err) {
    console.error("Error al decodificar token de recuperación:", err);
  }
  return null;
}

export async function updatePasswordServerAction(
  accessToken: string | null,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: "La contraseña debe tener al menos 8 caracteres." };
    }

    const supabase = createAdminClient();
    let targetUserId: string | null = null;

    if (accessToken) {
      const { data: { user }, error: userErr } = await supabase.auth.getUser(accessToken);
      if (user && !userErr) {
        targetUserId = user.id;
      } else {
        targetUserId = getUserIdFromToken(accessToken);
      }
    }

    if (!targetUserId) {
      return {
        success: false,
        error: "La sesión de recuperación no está activa o el enlace ha caducado. Por favor solicita un nuevo enlace desde la pantalla de login.",
      };
    }

    const { error: updateErr } = await supabase.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
      user_metadata: { require_password_change: false },
    });

    if (updateErr) {
      return { success: false, error: translateAuthError(updateErr.message) };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error en updatePasswordServerAction:", err);
    return {
      success: false,
      error: translateAuthError(err?.message || String(err)),
    };
  }
}
