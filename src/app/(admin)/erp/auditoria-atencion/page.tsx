import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";
import { hasPermission, getFirstAllowedPath } from "@/lib/roles";
import { redirect } from "next/navigation";
import AuditoriaAtencionClient from "./AuditoriaAtencionClient";
import { ShieldAlert } from "lucide-react";
import { ecuadorDateOf } from "@/lib/ecuador-time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AuditoriaAtencionPage() {
  const authData = await getCachedUserAndPermissions();
  const { role, allowedPaths } = authData;

  const hasAccess =
    hasPermission(role, "/erp/auditoria-atencion", allowedPaths) ||
    role === "admin";

  if (!hasAccess) {
    const firstAllowed = getFirstAllowedPath(role, allowedPaths);
    if (firstAllowed !== "/erp/auditoria-atencion") {
      redirect(firstAllowed);
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-xl font-bold text-ink-900 mb-2">Acceso Denegado</h1>
        <p className="text-sm text-ink-600 max-w-md">
          No tienes permisos asignados para ver el módulo de Auditoría de Atención al Cliente.
        </p>
      </div>
    );
  }

  const supabase = createAdminClient();

  // Consultar chats agrupados de WhatsApp e historial de auditorías
  let initialChats: any[] = [];
  let initialAudits: any[] = [];

  // Mes actual en hora Ecuador (carga inicial; el cliente vuelve a consultar al cambiar el periodo)
  const todayEc = ecuadorDateOf(new Date());
  const monthStart = `${todayEc.slice(0, 7)}-01`;
  const lastDay = new Date(Date.UTC(Number(todayEc.slice(0, 4)), Number(todayEc.slice(5, 7)), 0)).getUTCDate();
  const monthEnd = `${todayEc.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;

  try {
    const { getWhatsAppGroupedChats } = await import("@/lib/whatsapp-auditoria");
    const [waChats, directChatsRes, auditsRes] = await Promise.all([
      getWhatsAppGroupedChats(supabase, monthStart, monthEnd),
      supabase
        .from("customer_service_chats")
        .select("*")
        .gte("chat_date", monthStart)
        .lte("chat_date", monthEnd)
        .order("started_at", { ascending: false })
        .limit(5000),
      supabase
        .from("customer_service_audits")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const directChats = directChatsRes.data || [];
    initialChats = [...waChats, ...directChats];
    initialAudits = auditsRes.data || [];
  } catch (err) {
    console.warn("Error al cargar chats o auditorías:", err);
  }

  return (
    <AuditoriaAtencionClient
      initialChats={initialChats}
      initialAudits={initialAudits}
    />
  );
}
