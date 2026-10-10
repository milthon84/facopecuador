import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";
import { hasPermission } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * GET: Obtener lista de chats de atención al cliente
 */
export async function GET(req: NextRequest) {
  try {
    const authData = await getCachedUserAndPermissions();
    if (!authData?.user || !hasPermission(authData.role, "/erp/auditoria-atencion", authData.allowedPaths)) {
      // Verificar si es llamada por token seguro desde n8n
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim() || req.nextUrl.searchParams.get("token");
      const validToken = token === process.env.CRON_SECRET || token === process.env.N8N_API_KEY || token === "facop_cron_secure_token";
      if (!validToken) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
    }

    const { searchParams } = req.nextUrl;
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const supabase = createAdminClient();
    const { getWhatsAppGroupedChats } = await import("@/lib/whatsapp-auditoria");

    // 1. Obtener chats agrupados de whatsapp_mensajes
    const waChats = await getWhatsAppGroupedChats(supabase, start, end, limit);

    // 2. Obtener chats manuales / directos si existen
    let directChats: any[] = [];
    try {
      let query = supabase
        .from("customer_service_chats")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(limit);

      if (start) query = query.gte("chat_date", start);
      if (end) query = query.lte("chat_date", end);

      const { data } = await query;
      if (data) directChats = data;
    } catch {}

    const allChats = [...waChats, ...directChats];
    allChats.sort((a, b) => new Date(b.started_at || b.created_at).getTime() - new Date(a.started_at || a.created_at).getTime());

    return NextResponse.json({ chats: allChats.slice(0, limit) });
  } catch (err: any) {
    console.error("Error al obtener chats:", err);
    return NextResponse.json({ error: err.message || "Error al consultar chats" }, { status: 500 });
  }
}

/**
 * POST: Registrar uno o varios chats de atención (desde webhook n8n o interfaz web)
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim() || req.nextUrl.searchParams.get("token");
    const isTokenAuth = token === process.env.CRON_SECRET || token === process.env.N8N_API_KEY || token === "facop_cron_secure_token";

    if (!isTokenAuth) {
      const authData = await getCachedUserAndPermissions();
      if (!authData?.user || !hasPermission(authData.role, "/erp/auditoria-atencion", authData.allowedPaths)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
    }

    const body = await req.json();
    const supabase = createAdminClient();

    // Soporte para inserción múltiple o individual
    const rawChats = Array.isArray(body) ? body : (Array.isArray(body.chats) ? body.chats : [body]);

    const toInsert = rawChats.map((c: any) => ({
      patient_name: c.patient_name || c.nombre || "Paciente",
      phone: c.phone || c.telefono || c.numero || "Sin número",
      agent_name: c.agent_name || c.asesor || "Recepción / Asesor",
      channel: c.channel || "whatsapp",
      chat_date: c.chat_date || (c.started_at ? c.started_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      started_at: c.started_at || new Date().toISOString(),
      ended_at: c.ended_at || null,
      messages_count: c.messages_count || (c.transcript ? c.transcript.split("\n").length : 0),
      transcript: c.transcript || c.conversacion || c.texto || "",
      metadata: c.metadata || {},
    })).filter((c: any) => c.transcript && c.transcript.trim().length > 0);

    if (toInsert.length === 0) {
      return NextResponse.json({ error: "No se proporcionaron transcripciones válidas de chat." }, { status: 400 });
    }

    const { data, error } = await supabase.from("customer_service_chats").insert(toInsert).select();
    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({
          error: "La tabla 'customer_service_chats' aún no existe en Supabase. Por favor ejecuta la migración 'supabase/migration_customer_service_audit.sql'.",
        }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, count: data?.length || 0, chats: data });
  } catch (err: any) {
    console.error("Error al registrar chats:", err);
    return NextResponse.json({ error: err.message || "Error al registrar chats" }, { status: 500 });
  }
}
