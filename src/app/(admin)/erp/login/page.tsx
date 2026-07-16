"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Lock } from "lucide-react";
import { translateAuthError } from "@/lib/error-translations";

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });

    if (err || !data.user) {
      setLoading(false);
      setError(translateAuthError(err?.message));
      // Registrar intento fallido
      try {
        await fetch("/api/admin/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "login_failed",
            user_email: email,
            user_role: null,
          }),
        });
      } catch { /* ignorar */ }
      return;
    }

    // Registrar login exitoso
    try {
      await fetch("/api/admin/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login" }),
      });
    } catch { /* ignorar */ }

    // Hard navigation: garantiza ciclo SSR completo con cookie activa
    window.location.replace("/erp");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-lilac-50 via-white to-gold-50 px-4">
      <div className="card w-full max-w-md p-8">
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
            <label className="label">Contraseña</label>
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
    </main>
  );
}
