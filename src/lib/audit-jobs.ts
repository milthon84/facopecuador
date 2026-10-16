import type { SupabaseClient } from "@supabase/supabase-js";
import { getWhatsAppGroupedChats } from "@/lib/whatsapp-auditoria";
import { getEffectiveAuditPrompt } from "@/lib/ia-audit-prompt";
import { resolveAiConfig, hasAnyAiKey, callAiForJson, type AiConfig } from "@/lib/ia-audit-runner";
import { ecuadorDateOf } from "@/lib/ecuador-time";

export const BATCH_SIZE = 5;

export interface AuditChatPayload {
  id: string;
  patient_name: string;
  phone: string;
  agent_name: string;
  chat_date: string;
  started_at: string;
  transcript: string;
}

export interface AuditJobRow {
  id: string;
  status: "pendiente" | "en_proceso" | "completado" | "error";
  period_label: string;
  period_type: string;
  start_date: string;
  end_date: string;
  total_chats: number;
  batch_size: number;
  batches_total: number;
  batches_done: number;
  chats_payload: AuditChatPayload[];
  batch_results: any[];
  model_used: string | null;
  audit_id: string | null;
  error_message: string | null;
  created_by: string | null;
}

export function jobPublicStatus(job: Partial<AuditJobRow>) {
  return {
    id: job.id,
    status: job.status,
    period_label: job.period_label,
    total_chats: job.total_chats ?? 0,
    batches_total: job.batches_total ?? 0,
    batches_done: job.batches_done ?? 0,
    audit_id: job.audit_id ?? null,
    model_used: job.model_used ?? null,
    error_message: job.error_message ?? null,
  };
}

/**
 * Reúne todos los chats del periodo (WhatsApp + customer_service_chats) en formato listo para la IA.
 */
async function collectPeriodChats(supabase: SupabaseClient, startDate: string, endDate: string): Promise<AuditChatPayload[]> {
  const waChats = await getWhatsAppGroupedChats(supabase, startDate, endDate);

  let directChats: any[] = [];
  try {
    const { data } = await supabase
      .from("customer_service_chats")
      .select("id, patient_name, phone, agent_name, chat_date, started_at, transcript")
      .gte("chat_date", startDate)
      .lte("chat_date", endDate)
      .order("started_at", { ascending: false });
    if (data) directChats = data;
  } catch {}

  const payload: AuditChatPayload[] = [
    ...waChats.map((c) => ({
      id: c.id,
      patient_name: c.patient_name,
      phone: c.phone,
      agent_name: c.agent_name,
      chat_date: c.chat_date,
      started_at: c.started_at,
      transcript: c.transcript,
    })),
    ...directChats.map((c: any) => ({
      id: String(c.id),
      patient_name: c.patient_name || "Paciente",
      phone: c.phone || "N/A",
      agent_name: c.agent_name || "Recepción",
      chat_date: c.chat_date || ecuadorDateOf(c.started_at || new Date()),
      started_at: c.started_at,
      transcript: c.transcript || "",
    })),
  ].filter((c) => c.transcript && c.transcript.trim().length > 0);

  // Descendente por inicio de conversación
  payload.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  return payload;
}

/**
 * Crea el job de auditoría con todos los chats del periodo, divididos en lotes.
 * No ejecuta la IA: el procesamiento se hace lote por lote mediante processNextBatch.
 */
export async function createAuditJob(
  supabase: SupabaseClient,
  params: { periodType: string; periodLabel: string; startDate: string; endDate: string; createdBy: string | null }
): Promise<AuditJobRow> {
  const payload = await collectPeriodChats(supabase, params.startDate, params.endDate);
  if (payload.length === 0) {
    throw new Error("No se encontraron conversaciones de WhatsApp en este periodo para auditar.");
  }

  const { data, error } = await supabase
    .from("customer_service_audit_jobs")
    .insert({
      status: "pendiente",
      period_label: params.periodLabel,
      period_type: params.periodType,
      start_date: params.startDate,
      end_date: params.endDate,
      total_chats: payload.length,
      batch_size: BATCH_SIZE,
      batches_total: Math.ceil(payload.length / BATCH_SIZE),
      batches_done: 0,
      chats_payload: payload,
      batch_results: [],
      created_by: params.createdBy,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "No se pudo crear el job de auditoría.");
  return data as AuditJobRow;
}

function buildBatchUserPrompt(batch: AuditChatPayload[], periodLabel: string, batchIndex: number, batchesTotal: number) {
  const formatted = batch.map((c, idx) => ({
    numero_caso: idx + 1,
    id_chat: c.id,
    paciente: c.patient_name,
    telefono: c.phone,
    asesor: c.agent_name,
    fecha_hora: c.started_at,
    conversacion: c.transcript,
  }));

  return `A continuación tienes ${formatted.length} conversaciones de WhatsApp de atención al cliente para auditar (lote ${batchIndex + 1} de ${batchesTotal}) correspondientes al período "${periodLabel}". Las horas están en zona horaria de Ecuador (America/Guayaquil):

${JSON.stringify(formatted, null, 2)}

INSTRUCCIÓN DE AGILIDAD: Sé ejecutivo y conciso en los textos del JSON:
- "executive_summary": máximo 2 oraciones.
- "strengths": 2 o 3 frases directas.
- "weaknesses": 2 o 3 frases directas.
- "recommendations": 2 o 3 frases directas.
- En cada chat de "chat_evaluations": "resumen_caso" máximo 1 frase y "observaciones" máximo 1 frase directa.
- "chat_evaluations" debe incluir exactamente una evaluación por cada caso recibido, en el mismo orden y con el mismo numero_caso.
Responde ÚNICAMENTE con el objeto JSON solicitado.`;
}

function weightedAverage(values: { value: number; weight: number }[]): number {
  const totalWeight = values.reduce((acc, v) => acc + v.weight, 0);
  if (totalWeight === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v.value * v.weight, 0);
  return Math.round((sum / totalWeight) * 10) / 10;
}

/**
 * Consolida los resultados parciales de todos los lotes en un único informe del periodo.
 */
async function consolidateJob(supabase: SupabaseClient, job: AuditJobRow, cfg: AiConfig) {
  const batches: any[] = job.batch_results || [];

  // Evaluaciones de todos los lotes, renumeradas de forma continua
  const chatEvaluations: any[] = [];
  for (const b of batches) {
    for (const ev of b.evaluations || []) {
      chatEvaluations.push({ ...ev, numero_caso: chatEvaluations.length + 1 });
    }
  }

  const weighted = (key: string) =>
    weightedAverage(
      batches.map((b) => ({
        value: Number(b[key]) || 0,
        weight: (b.evaluations || []).length || 1,
      }))
    );

  const rejectedCount = chatEvaluations.filter((e) => e.rechazo_fin_semana).length;
  const slowCount = chatEvaluations.filter((e) => String(e.tiempo_respuesta || "").toLowerCase().includes("lento")).length;

  // Síntesis ejecutiva: una llamada final con los resúmenes de cada lote
  let executiveSummary = "";
  let strengths: string[] = [];
  let weaknesses: string[] = [];
  let recommendations: string[] = [];
  let synthesisModel = "";

  const mergeUnique = (arrs: string[][]) =>
    Array.from(new Set(arrs.flat().filter(Boolean))).slice(0, 6);

  try {
    const synthesisPrompt = `Eres el supervisor de calidad de FACOP. Recibirás los resúmenes parciales de auditorías por lotes de conversaciones de WhatsApp del período "${job.period_label}". Consolídalos en un único diagnóstico del período.
Responde ÚNICAMENTE con JSON válido con esta forma:
{"executive_summary": "máximo 3 oraciones", "strengths": ["2 a 4 frases"], "weaknesses": ["2 a 4 frases"], "recommendations": ["2 a 4 frases"]}`;

    const { parsed, modelUsed } = await callAiForJson(
      cfg,
      synthesisPrompt,
      JSON.stringify(
        batches.map((b) => ({
          executive_summary: b.executive_summary,
          strengths: b.strengths,
          weaknesses: b.weaknesses,
          recommendations: b.recommendations,
        })),
        null,
        2
      )
    );
    executiveSummary = String(parsed.executive_summary || "");
    strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
    weaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [];
    recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    synthesisModel = modelUsed;
  } catch (err) {
    console.warn("Síntesis final falló, se usa fusión de lotes:", err);
    executiveSummary = batches.map((b) => b.executive_summary).filter(Boolean).slice(0, 2).join(" ");
    strengths = mergeUnique(batches.map((b) => b.strengths || []));
    weaknesses = mergeUnique(batches.map((b) => b.weaknesses || []));
    recommendations = mergeUnique(batches.map((b) => b.recommendations || []));
  }

  const modelUsed = [job.model_used, synthesisModel].filter(Boolean).join(" | ") || "desconocido";

  const { data: savedAudit, error } = await supabase
    .from("customer_service_audits")
    .insert({
      period_label: job.period_label,
      period_type: job.period_type,
      start_date: job.start_date,
      end_date: job.end_date,
      total_chats_analyzed: chatEvaluations.length,
      overall_score: weighted("overall_score"),
      cordiality_score: weighted("cordiality_score"),
      speed_score: weighted("speed_score"),
      resolution_score: weighted("resolution_score"),
      rejected_leads_count: rejectedCount,
      slow_response_count: slowCount,
      executive_summary: executiveSummary,
      strengths,
      weaknesses,
      recommendations,
      chat_evaluations: chatEvaluations,
      model_used: modelUsed,
      created_by: job.created_by || "n8n_automation",
    })
    .select("id")
    .single();

  if (error || !savedAudit) throw new Error(error?.message || "No se pudo guardar la auditoría consolidada.");
  return savedAudit.id as string;
}

/**
 * Procesa el siguiente lote pendiente del job. Cada llamada procesa exactamente un lote con la IA.
 * Si un lote falla, el job queda en estado "error" y puede reintentarse desde el mismo lote.
 */
export async function processNextBatch(supabase: SupabaseClient, jobId: string): Promise<AuditJobRow> {
  const { data: job, error: jobErr } = await supabase
    .from("customer_service_audit_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr || !job) throw new Error("Job de auditoría no encontrado.");
  const row = job as AuditJobRow;

  if (row.status === "completado") return row;

  const cfg = await resolveAiConfig(supabase, {});
  if (!hasAnyAiKey(cfg)) {
    throw new Error(
      "No se ha configurado una API Key de Inteligencia Artificial. Configúrala en Configuración del Sistema."
    );
  }

  await supabase
    .from("customer_service_audit_jobs")
    .update({ status: "en_proceso", error_message: null, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    if (row.batches_done < row.batches_total) {
      const start = row.batches_done * row.batch_size;
      const batch = row.chats_payload.slice(start, start + row.batch_size);
      const systemPrompt = getEffectiveAuditPrompt(cfg.customPrompt);
      const userPrompt = buildBatchUserPrompt(batch, row.period_label, row.batches_done, row.batches_total);

      const { parsed, modelUsed } = await callAiForJson(cfg, systemPrompt, userPrompt);

      // Vincular cada evaluación con el chat real (id, paciente, teléfono) por número de caso
      const evaluations = (Array.isArray(parsed.chat_evaluations) ? parsed.chat_evaluations : []).map((ev: any) => {
        const chat = batch[(Number(ev.numero_caso) || 0) - 1];
        const norm = (v: unknown) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const st = norm(ev.status);
        const status = st.includes("critic") ? "critico" : st.includes("regular") ? "regular" : "excelente";
        const rechazo = ["true", "si", "1"].includes(norm(ev.rechazo_fin_semana));
        return {
          ...ev,
          status,
          rechazo_fin_semana: rechazo,
          id_chat: chat?.id || ev.id_chat,
          paciente: chat?.patient_name || ev.paciente,
          telefono: chat?.phone || ev.telefono,
          fecha_hora: chat?.started_at || null,
          // Hilo completo solo para casos críticos o rechazos (acota el tamaño del registro)
          hilo: status === "critico" || rechazo ? chat?.transcript || null : null,
        };
      });

      const batchResult = {
        batch_index: row.batches_done,
        model: modelUsed,
        overall_score: parsed.overall_score,
        cordiality_score: parsed.cordiality_score,
        speed_score: parsed.speed_score,
        resolution_score: parsed.resolution_score,
        executive_summary: parsed.executive_summary,
        strengths: parsed.strengths,
        weaknesses: parsed.weaknesses,
        recommendations: parsed.recommendations,
        evaluations,
      };

      const nextDone = row.batches_done + 1;
      const { error: upErr } = await supabase
        .from("customer_service_audit_jobs")
        .update({
          batches_done: nextDone,
          batch_results: [...(row.batch_results || []), batchResult],
          model_used: modelUsed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      if (upErr) throw new Error(upErr.message);

      row.batches_done = nextDone;
      row.batch_results = [...(row.batch_results || []), batchResult];
      row.model_used = modelUsed;
    }

    if (row.batches_done >= row.batches_total) {
      const auditId = await consolidateJob(supabase, row, cfg);
      const { data: finished } = await supabase
        .from("customer_service_audit_jobs")
        .update({
          status: "completado",
          audit_id: auditId,
          chats_payload: [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .select("*")
        .single();
      return (finished as AuditJobRow) || { ...row, status: "completado", audit_id: auditId };
    }

    const { data: inProgress } = await supabase
      .from("customer_service_audit_jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    return { ...(inProgress as AuditJobRow), status: "en_proceso" };
  } catch (err: any) {
    const message = err?.message || String(err);
    await supabase
      .from("customer_service_audit_jobs")
      .update({ status: "error", error_message: message, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    throw new Error(message);
  }
}
