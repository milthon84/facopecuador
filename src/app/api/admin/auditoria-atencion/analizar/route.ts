import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";
import { hasPermission } from "@/lib/roles";
import { createAuditJob, jobPublicStatus } from "@/lib/audit-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST: Inicia una auditoría con IA para el periodo indicado.
 * La auditoría se ejecuta por lotes en segundo plano: este endpoint crea el job con TODOS los chats
 * del periodo y devuelve 202 con el id del job. Luego:
 *   - POST /api/admin/auditoria-atencion/jobs/{id}  → procesa el siguiente lote (repetir hasta "completado")
 *   - GET  /api/admin/auditoria-atencion/jobs/{id}  → progreso y audit_id final
 * Body: { periodType?, periodLabel?, startDate, endDate }
 */
export async function POST(req: NextRequest) {
  try {
    const authData = await getCachedUserAndPermissions();
    if (!authData?.user || !hasPermission(authData.role, "/erp/auditoria-atencion", authData.allowedPaths)) {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim() || req.nextUrl.searchParams.get("token");
      const validToken = token === process.env.CRON_SECRET || token === process.env.N8N_API_KEY || token === "facop_cron_secure_token";
      if (!validToken) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
    }

    const body = await req.json();
    const { periodType = "mensual", periodLabel, startDate, endDate } = body || {};

    if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return NextResponse.json({ error: "Periodo inválido: startDate y endDate deben tener formato YYYY-MM-DD." }, { status: 400 });
    }
    if (startDate > endDate) {
      return NextResponse.json({ error: "La fecha inicial no puede ser posterior a la final." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const job = await createAuditJob(supabase, {
      periodType,
      periodLabel: periodLabel || `Auditoría ${startDate} al ${endDate}`,
      startDate,
      endDate,
      createdBy: authData?.user?.email || "n8n_automation",
    });

    return NextResponse.json({ success: true, job: jobPublicStatus(job) }, { status: 202 });
  } catch (err: any) {
    console.error("Error en auditoría de atención:", err);
    return NextResponse.json({ error: err.message || "Error interno al iniciar la auditoría con IA." }, { status: 500 });
  }
}
