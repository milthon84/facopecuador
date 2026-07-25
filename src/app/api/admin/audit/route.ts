/**
 * POST /api/admin/audit
 * Registra eventos de sesión (login/logout) desde el cliente.
 * Usa service_role para bypassar RLS.
 */
import { NextRequest, NextResponse } from "next/server";
import { logAudit, getIpFromRequest } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    let user = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data?.user || null;
    } catch (uErr) {
      // ignora fallo de red temporal en consulta de usuario
    }

    const body = await req.json();
    const { action, user_email, user_role } = body;

    if (!action) {
      return NextResponse.json({ error: "action requerido" }, { status: 400 });
    }

    await logAudit({
      user_id: user?.id ?? body.user_id ?? null,
      user_email: user?.email ?? user_email ?? null,
      user_role: (user?.app_metadata?.role) ?? user_role ?? null,
      action: action === "logout" ? "logout" : "login",
      resource: "session",
      description: action === "logout"
        ? `Cierre de sesión: ${user?.email ?? user_email ?? "desconocido"}`
        : `Inicio de sesión: ${user?.email ?? user_email ?? "desconocido"}`,
      ip_address: getIpFromRequest(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[audit/route] Error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
