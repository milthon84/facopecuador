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
