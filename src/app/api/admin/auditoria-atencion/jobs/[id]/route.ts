import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";
import { hasPermission } from "@/lib/roles";
import { processNextBatch, jobPublicStatus } from "@/lib/audit-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

async function assertAccess(req: NextRequest): Promise<boolean> {
  const authData = await getCachedUserAndPermissions();
  if (authData?.user && hasPermission(authData.role, "/erp/auditoria-atencion", authData.allowedPaths)) return true;
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim() || req.nextUrl.searchParams.get("token");
  return token === process.env.CRON_SECRET || token === process.env.N8N_API_KEY || token === "facop_cron_secure_token";
}

/**
 * GET: Estado actual del job (progreso por lotes, estado, audit_id al completar).
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    if (!(await assertAccess(req))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("customer_service_audit_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });

    return NextResponse.json({ job: jobPublicStatus(data) });
  } catch (err: any) {
    console.error("Error al consultar job de auditoría:", err);
    return NextResponse.json({ error: err.message || "Error al consultar el job." }, { status: 500 });
  }
}

/**
 * POST: Procesa el siguiente lote pendiente del job con la IA.
 * Llamarlo repetidamente hasta que el estado sea "completado".
 * Si un lote falla, el job queda en "error" y se reintenta desde el mismo lote.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    if (!(await assertAccess(req))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await context.params;
    const supabase = createAdminClient();
    const job = await processNextBatch(supabase, id);

    return NextResponse.json({ success: true, job: jobPublicStatus(job) });
  } catch (err: any) {
    console.error("Error al procesar lote de auditoría:", err);
    return NextResponse.json({ error: err.message || "Error al procesar el lote." }, { status: 500 });
  }
}
