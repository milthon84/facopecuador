"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { translateAuthError } from "@/lib/error-translations";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      if (hash.includes("type=recovery") || hash.includes("access_token=") || search.includes("type=recovery") || search.includes("code=")) {
        setIsRecoverySession(true);
      }
    }

    // 1. Escuchar evento de recuperación de contraseña de Supabase
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setIsRecoverySession(true);
      }
      setCheckingSession(false);
    });

    // 2. Verificar si ya hay una sesión activa por el token en la URL
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsRecoverySession(true);
      }
      setCheckingSession(false);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: password,
        data: { require_password_change: false },
      });

      if (updateErr) {
        throw updateErr;
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.replace("/erp/login");
      }, 2000);
    } catch (err: any) {
      console.error("Error al actualizar contraseña:", err);
      setError(translateAuthError(err?.message || String(err)));
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-lilac-50 via-white to-gold-50 px-4 py-8">
      <div className="card w-full max-w-md p-8 shadow-xl relative overflow-hidden">
        {/* Header */}
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="Logo" className="h-14 w-auto object-contain rounded-md" />
        </div>

        <h1 className="text-xl font-bold text-ink-900 text-center mb-2 flex items-center justify-center gap-2">
          <Lock className="text-lilac-600" size={20} />
          Restablecer Contraseña
        </h1>
        <p className="text-sm text-ink-600 text-center mb-6">
          Ingresa tu nueva contraseña para actualizar el acceso a tu cuenta.
        </p>

        {checkingSession ? (
          <div className="py-8 flex flex-col items-center justify-center text-ink-600">
            <Loader2 className="animate-spin text-lilac-600 mb-2" size={28} />
            <p className="text-xs">Verificando enlace de recuperación...</p>
          </div>
        ) : success ? (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
            <CheckCircle2 className="shrink-0 text-green-600" size={24} />
            <div>
              <p className="font-semibold text-sm">¡Contraseña restablecida con éxito!</p>
              <p className="text-xs text-green-600/90 mt-0.5">Redirigiendo a la pantalla de inicio de sesión...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {!isRecoverySession && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs">
                Nota: Si accediste directamente, asegúrate de ingresar desde el enlace enviado a tu correo electrónico.
              </div>
            )}

            <div>
              <label className="label">Nueva contraseña</label>
              <input
                className="input"
                type="password"
                required
                disabled={loading}
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Confirmar nueva contraseña</label>
              <input
                className="input"
                type="password"
                required
                disabled={loading}
                minLength={8}
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-center gap-2 text-sm animate-in fade-in duration-200">
                <AlertCircle className="shrink-0 text-red-600" size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Actualizando clave...
                </>
              ) : (
                "Restablecer Contraseña"
              )}
            </button>
          </form>
        )}

        {/* Link Volver a Login */}
        <div className="mt-6 pt-4 border-t border-lilac-100 flex justify-center">
          <Link
            href="/erp/login"
            className="text-xs text-ink-500 hover:text-lilac-700 font-semibold transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft size={13} />
            Volver a Iniciar Sesión
          </Link>
        </div>
      </div>
    </main>
  );
}
