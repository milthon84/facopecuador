"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeOwnPasswordAction } from "../usuarios/actions";
import { createClient } from "@/lib/supabase/client";
import { Lock, LogOut, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function CambiarContrasenaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    try {
      await fetch("/api/admin/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } catch { /* ignorar */ }
    await supabase.auth.signOut();
    window.location.replace("/erp/login");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      await changeOwnPasswordAction(password);
      setSuccess(true);
      
      // Esperar brevemente y redirigir
      setTimeout(() => {
        window.location.replace("/erp");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Error al actualizar la contraseña.");
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
          Cambio de Contraseña Obligatorio
        </h1>
        <p className="text-sm text-ink-600 text-center mb-6">
          El administrador ha restablecido tu contraseña. Por seguridad, debes definir una nueva antes de ingresar al sistema.
        </p>

        {success ? (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
            <CheckCircle2 className="shrink-0 text-green-600" size={24} />
            <div>
              <p className="font-semibold text-sm">¡Contraseña actualizada!</p>
              <p className="text-xs text-green-600/90 mt-0.5">Redirigiendo al panel principal...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
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
                  Actualizando contraseña...
                </>
              ) : (
                "Guardar y continuar"
              )}
            </button>
          </form>
        )}

        {/* Opción Salir / Cerrar Sesión */}
        <div className="mt-6 pt-4 border-t border-lilac-100 flex justify-center">
          <button
            onClick={handleLogout}
            disabled={loading}
            className="text-xs text-ink-500 hover:text-red-600 font-semibold transition-colors flex items-center gap-1.5"
          >
            <LogOut size={13} />
            Cerrar Sesión / Salir
          </button>
        </div>
      </div>
    </main>
  );
}
