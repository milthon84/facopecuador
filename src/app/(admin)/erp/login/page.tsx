"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Lock, KeyRound, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { translateAuthError } from "@/lib/error-translations";
import { requestPasswordResetAction } from "./actions";

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  // Estados para Recuperación de Contraseña
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail]           = useState("");
  const [resetLoading, setResetLoading]       = useState(false);
  const [resetSuccess, setResetSuccess]       = useState(false);
  const [resetError, setResetError]           = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });

      if (err || !data.user) {
        setLoading(false);
        setError(translateAuthError(err?.message));
        // Registrar intento fallido en segundo plano (non-blocking)
        fetch("/api/admin/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "login_failed",
            user_email: email,
            user_role: null,
          }),
        }).catch(() => {});
        return;
      }

      // Registrar login exitoso en segundo plano (non-blocking)
      fetch("/api/admin/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login" }),
      }).catch(() => {});

      // Redirección inmediata respetando el parámetro redirect si existe
      const params = new URLSearchParams(window.location.search);
      const targetUrl = params.get("redirect") || "/erp";
      window.location.replace(targetUrl);
    } catch (err: any) {
      console.error("Error al iniciar sesión:", err);
      setError(err?.message || "Ocurrió un error inesperado al iniciar sesión.");
      setLoading(false);
    }
  }

  async function handleSendResetEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setResetError("Por favor ingresa tu correo electrónico.");
      return;
    }
    setResetLoading(true);
    setResetError(null);
    setResetSuccess(false);

    try {
      const res = await requestPasswordResetAction(resetEmail, window.location.origin);
      if (!res.success) {
        setResetError(res.error || "Error al solicitar el correo de recuperación.");
      } else {
        setResetSuccess(true);
      }
    } catch (err: any) {
      console.error("Error al solicitar restablecimiento de clave:", err);
      setResetError(err?.message || "Ocurrió un error al enviar el correo de recuperación.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-lilac-50 via-white to-gold-50 px-4">
      <div className="card w-full max-w-md p-8 shadow-xl relative overflow-hidden">
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="Logo" className="h-14 w-auto object-contain rounded-md" />
        </div>
        <h1 className="text-xl font-bold text-center mb-1">Gestión Clínica</h1>
        <p className="text-sm text-ink-600 text-center mb-6">Ingresa tus credenciales para acceder</p>
        
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Contraseña</label>
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setResetSuccess(false);
                  setResetError(null);
                  setShowForgotModal(true);
                }}
                className="text-xs text-lilac-700 hover:text-lilac-900 font-semibold transition"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>

      {/* Modal para Solicitar Recuperación de Contraseña */}
      {showForgotModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setShowForgotModal(false)}
        >
          <div 
            className="bg-white border border-lilac-100 rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-lilac-50 flex items-center justify-center text-lilac-700">
                <KeyRound size={24} />
              </div>
            </div>

            <h3 className="text-lg font-bold text-ink-950 text-center mb-1">Recuperar Contraseña</h3>
            <p className="text-xs text-ink-600 text-center mb-5 leading-relaxed">
              Ingresa tu dirección de correo electrónico y te enviaremos un enlace seguro para restablecer tu clave.
            </p>

            {resetSuccess ? (
              <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-2xl text-xs space-y-2 mb-4">
                <div className="flex items-center gap-2 font-bold text-sm text-green-900">
                  <CheckCircle2 size={18} className="text-green-600" /> Correo Enviado
                </div>
                <p className="text-green-800">
                  Revisa tu bandeja de entrada en <strong>{resetEmail}</strong>. Haz clic en el enlace para restablecer tu clave.
                </p>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full mt-2 py-2 bg-green-700 text-white rounded-xl font-bold hover:bg-green-800 transition"
                >
                  Entendido
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendResetEmail} className="space-y-4">
                <div>
                  <label className="label text-xs">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    disabled={resetLoading}
                    className="input text-xs"
                    placeholder="ejemplo@correo.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />
                </div>

                {resetError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-center gap-2 text-xs">
                    <AlertCircle size={14} className="shrink-0 text-red-600" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={resetLoading}
                    onClick={() => setShowForgotModal(false)}
                    className="w-full py-2.5 text-xs font-semibold rounded-xl border border-lilac-200 text-ink-700 hover:bg-lilac-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="btn-primary w-full py-2.5 text-xs font-bold"
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 size={13} className="animate-spin" /> Enviando...
                      </>
                    ) : (
                      "Enviar Enlace"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
