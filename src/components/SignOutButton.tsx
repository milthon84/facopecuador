"use client";

import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export default function SignOutButton() {
  async function logout() {
    const supabase = createClient();

    // Registrar logout antes de invalidar sesión
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

  return (
    <button
      onClick={logout}
      className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-gold-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
    >
      <LogOut size={14} />
      <span className="hidden sm:inline">Salir</span>
    </button>
  );
}
