import { createAdminClient } from "./supabase/admin";
import type { UserRole } from "./roles";

export interface AuditEntry {
  user_id?: string | null;
  user_email?: string | null;
  user_role?: UserRole | string | null;
  action: "login" | "logout" | "create" | "update" | "delete" | "cancel" | "export" | "import" | "view";
  resource:
    | "session"
    | "appointment"
    | "patient"
    | "inventory_transaction"
    | "dental_consultation"
    | "invoice"
    | "user_profile"
    | "inventory_product"
    | "system_role"
    | "monthly_closure";
  resource_id?: string | null;
  description: string;
  metadata?: Record<string, any> | null;
  ip_address?: string | null;
}

/**
 * Registra una entrada de auditoría.
 * Usa el cliente admin para bypassar RLS.
 * No lanza excepciones: falla silenciosamente para no interrumpir el flujo.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("audit_logs").insert({
      user_id: entry.user_id ?? null,
      user_email: entry.user_email ?? null,
      user_role: entry.user_role ?? null,
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resource_id ?? null,
      description: entry.description,
      metadata: entry.metadata ?? null,
      ip_address: entry.ip_address ?? null,
    });
    if (error) {
      console.error("[audit] Error al registrar:", error.message);
    }
  } catch (err) {
    console.error("[audit] Excepción al registrar:", err);
  }
}

/**
 * Helper para obtener IP del request en API routes de Next.js.
 */
export function getIpFromRequest(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? null;
}
