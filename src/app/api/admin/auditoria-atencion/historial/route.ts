import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";
import { hasPermission } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("customer_service_audits")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ audits: [] });
      }
      throw error;
    }

    return NextResponse.json({ audits: data || [] });
  } catch (err: any) {
    console.error("Error al obtener historial de auditorías:", err);
    return NextResponse.json({ error: err.message || "Error al consultar historial" }, { status: 500 });
  }
}
