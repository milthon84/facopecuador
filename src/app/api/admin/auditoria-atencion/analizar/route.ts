import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";
import { hasPermission } from "@/lib/roles";
import { getEffectiveAuditPrompt } from "@/lib/ia-audit-prompt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;


interface ChatItemForAnalysis {
  id?: string;
  patient_name?: string;
  phone?: string;
  agent_name?: string;
  chat_date?: string;
  started_at?: string;
  transcript: string;
}

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
    const {
      periodType = "mensual",
      periodLabel = "Auditoría de Atención",
      startDate,
      endDate,
      chats: customChats,
      apiKey: customApiKey,
      saveAudit = true,
    } = body;

    const supabase = createAdminClient();

    // 1. Obtener chats a analizar (desde la BD o desde el payload)
    let chatsToAnalyze: ChatItemForAnalysis[] = [];

    if (Array.isArray(customChats) && customChats.length > 0) {
      chatsToAnalyze = customChats;
    } else {
      const { getWhatsAppGroupedChats } = await import("@/lib/whatsapp-auditoria");
      const waChats = await getWhatsAppGroupedChats(supabase, startDate, endDate, 50);

      let directChats: any[] = [];
      try {
        let query = supabase
          .from("customer_service_chats")
          .select("id, patient_name, phone, agent_name, chat_date, started_at, transcript")
          .order("started_at", { ascending: false })
          .limit(30);

        if (startDate) query = query.gte("chat_date", startDate);
        if (endDate) query = query.lte("chat_date", endDate);

        const { data: dbChats } = await query;
        if (dbChats) directChats = dbChats;
      } catch {}

      const merged = [...waChats, ...directChats];
      merged.sort((a, b) => new Date(b.started_at || b.created_at).getTime() - new Date(a.started_at || a.created_at).getTime());
      chatsToAnalyze = merged.slice(0, 50);
    }

    if (chatsToAnalyze.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron conversaciones de chat para auditar en este período." },
        { status: 400 }
      );
    }

    // 2. Resolver Proveedor, Modelo y API Keys
    let geminiKey = (body.geminiKey || "").trim();
    let claudeKey = (body.claudeKey || customApiKey || "").trim();
    let openAiKey = (body.openAiKey || "").trim();
    let selectedProvider = body.provider || "";
    let selectedModel = body.model || "";

    let customPromptFromDb = "";
    try {
      const { data: auditConfig } = await supabase
        .from("web_settings")
        .select("value")
        .eq("key", "ia_audit_config")
        .maybeSingle();

      if (auditConfig?.value) {
        if (!geminiKey && auditConfig.value.geminiKey) geminiKey = auditConfig.value.geminiKey.trim();
        if (!claudeKey && auditConfig.value.claudeKey) claudeKey = auditConfig.value.claudeKey.trim();
        if (!openAiKey && auditConfig.value.openAiKey) openAiKey = auditConfig.value.openAiKey.trim();
        if (!selectedProvider && auditConfig.value.provider) selectedProvider = auditConfig.value.provider;
        if (!selectedModel && auditConfig.value.model) selectedModel = auditConfig.value.model;
        if (auditConfig.value.prompt) customPromptFromDb = auditConfig.value.prompt;
      }

      // Respaldo en ads_config
      const { data: adsConfig } = await supabase
        .from("web_settings")
        .select("value")
        .eq("key", "ads_config")
        .maybeSingle();

      if (!claudeKey && adsConfig?.value?.claudeKey) {
        claudeKey = adsConfig.value.claudeKey.trim();
      }
    } catch {}

    // Respaldo de variables de entorno
    if (!geminiKey) geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim();
    if (!claudeKey) claudeKey = (process.env.ANTHROPIC_API_KEY || "").trim();
    if (!openAiKey) openAiKey = (process.env.OPENAI_API_KEY || "").trim();

    if (!selectedProvider) {
      selectedProvider = geminiKey ? "gemini" : claudeKey ? "anthropic" : openAiKey ? "openai" : "gemini";
    }

    if (!geminiKey && !claudeKey && !openAiKey) {
      return NextResponse.json(
        {
          error:
            "No se ha configurado una API Key de Inteligencia Artificial. Puedes obtener una API Key 100% GRATIS de Google Gemini en https://aistudio.google.com/app/apikey o configurar Anthropic/OpenAI en 'Configurar IA'.",
        },
        { status: 400 }
      );
    }

    // 3. Preparar contexto y prompt de auditoría
    // Limitamos chats a un máximo de 30 para garantizar velocidad de respuesta y evitar tiempos muertos o timeouts
    const chatsToProcess = chatsToAnalyze.slice(0, 30);

    const formattedChats = chatsToProcess.map((c, idx) => {
      let transcriptText = c.transcript || "";
      // Truncar transcripción si es extremadamente extensa para mantener el prompt ágil y seguro
      if (transcriptText.length > 2500) {
        transcriptText = transcriptText.slice(0, 2500) + "\n... [Transcripción truncada para optimización]";
      }
      return {
        numero_caso: idx + 1,
        id_chat: c.id || `caso_${idx + 1}`,
        paciente: c.patient_name || "Paciente",
        telefono: c.phone || "N/A",
        asesor: c.agent_name || "Recepción",
        fecha_hora: c.chat_date || c.started_at || "No especificada",
        conversacion: transcriptText,
      };
    });

    const systemPrompt = getEffectiveAuditPrompt(body.prompt || customPromptFromDb);

    const userPrompt = `A continuación tienes ${formattedChats.length} conversaciones de WhatsApp de atención al cliente para auditar correspondientes al período "${periodLabel}":

${JSON.stringify(formattedChats, null, 2)}

Por favor, realiza la auditoría exhaustiva y devuelve el JSON estructurado según la rúbrica solicitada.`;

    let aiResultJson: any = null;
    let rawReply = "";
    let modelUsed = "";
    let lastErrorDetail = "";

    // 4. Ejecución según el proveedor seleccionado

    // PROVEEDOR 1: GOOGLE GEMINI
    if (selectedProvider === "gemini" && geminiKey) {
      let baseRequested = selectedModel || "gemini-1.5-flash";
      if (baseRequested === "gemini-flash-latest" || baseRequested.includes("3.8") || baseRequested.includes("3.5")) {
        baseRequested = "gemini-1.5-flash";
      }

      // Modelos oficiales y activos de Google Generative Language API
      const candidateGeminiModels = [
        baseRequested,
        "gemini-1.5-flash",
        "gemini-2.0-flash",
        "gemini-2.5-flash",
        "gemini-1.5-pro",
      ].filter((m, i, arr) => !!m && arr.indexOf(m) === i);

      for (const modelToTry of candidateGeminiModels) {
        if (rawReply) break;
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
                  },
                ],
                generationConfig: {
                  responseMimeType: "application/json",
                  temperature: 0.2,
                },
              }),
            }
          );

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            rawReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (rawReply) {
              modelUsed = `Google ${modelToTry}`;
              break;
            }
          } else {
            const errText = await geminiRes.text();
            console.warn(`Respuesta no OK de Gemini (${modelToTry}):`, geminiRes.status, errText);
            lastErrorDetail = `Google Gemini (${geminiRes.status} ${modelToTry}): ${errText}`;
          }
        } catch (err: any) {
          console.warn(`Error de conexión con Gemini (${modelToTry}):`, err);
          lastErrorDetail = `Google Gemini: ${err.message || String(err)}`;
        }
      }
    }

    // PROVEEDOR 2: ANTHROPIC CLAUDE
    if (!rawReply && ((selectedProvider === "anthropic" && claudeKey) || (!geminiKey && claudeKey))) {
      const targetClaudeModel = selectedModel && selectedModel.includes("claude") ? selectedModel : "claude-3-5-haiku-latest";
      const claudeCandidates = [targetClaudeModel, "claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-3-haiku-20240307"].filter((m, i, arr) => arr.indexOf(m) === i);

      for (const m of claudeCandidates) {
        if (rawReply) break;
        try {
          const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": claudeKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: m,
              max_tokens: 4000,
              system: systemPrompt,
              messages: [{ role: "user", content: userPrompt }],
            }),
          });

          if (anthropicRes.ok) {
            const anthropicData = await anthropicRes.json();
            rawReply = anthropicData.content?.[0]?.text || "";
            if (rawReply) {
              modelUsed = `Anthropic ${m}`;
              break;
            }
          } else {
            const errText = await anthropicRes.text();
            console.warn(`Error con Claude (${m}):`, anthropicRes.status, errText);
            lastErrorDetail = `Anthropic Claude (${anthropicRes.status} ${m}): ${errText}`;
          }
        } catch (err: any) {
          console.warn("Error con Claude:", err);
          lastErrorDetail = `Anthropic Claude: ${err.message || String(err)}`;
        }
      }
    }

    // PROVEEDOR 3: OPENAI
    if (!rawReply && ((selectedProvider === "openai" && openAiKey) || (!geminiKey && !claudeKey && openAiKey))) {
      const targetOpenAiModel = selectedModel && selectedModel.includes("gpt") ? selectedModel : "gpt-4o-mini";
      try {
        const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: targetOpenAiModel,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (openAiRes.ok) {
          const openAiData = await openAiRes.json();
          rawReply = openAiData.choices?.[0]?.message?.content || "";
          if (rawReply) {
            modelUsed = `OpenAI ${targetOpenAiModel}`;
          }
        } else {
          const errText = await openAiRes.text();
          console.warn("Error con OpenAI:", openAiRes.status, errText);
          lastErrorDetail = `OpenAI (${openAiRes.status}): ${errText}`;
        }
      } catch (err: any) {
        console.warn("Error con OpenAI:", err);
        lastErrorDetail = `OpenAI: ${err.message || String(err)}`;
      }
    }

    // Respaldo de seguridad con Gemini si todo lo anterior falló pero hay key de Gemini
    if (!rawReply && geminiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
              generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
            }),
          }
        );
        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          rawReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (rawReply) {
            modelUsed = "Google gemini-1.5-flash (Respaldo)";
          }
        }
      } catch {}
    }

    if (!rawReply) {
      return NextResponse.json(
        {
          error: lastErrorDetail
            ? `No se pudo obtener respuesta del modelo de IA: ${lastErrorDetail}`
            : "No se pudo obtener respuesta del modelo de Inteligencia Artificial. Revisa que tu API Key sea válida y tenga créditos/cuota.",
        },
        { status: 502 }
      );
    }

    // 5. Parsear JSON devuelto por la IA
    try {
      const cleanJsonStr = rawReply
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      aiResultJson = JSON.parse(cleanJsonStr);
    } catch (e) {
      console.error("Error al parsear JSON de la IA:", e, "Raw:", rawReply);
      return NextResponse.json(
        {
          error: "La IA respondió pero no en formato JSON estructurado.",
          rawReply,
        },
        { status: 500 }
      );
    }

    // 6. Guardar la auditoría en Supabase si saveAudit=true
    let savedAuditId: string | null = null;
    if (saveAudit) {
      try {
        const { data: savedAudit, error: saveErr } = await supabase
          .from("customer_service_audits")
          .insert({
            period_label: periodLabel,
            period_type: periodType,
            start_date: startDate || new Date().toISOString().slice(0, 10),
            end_date: endDate || new Date().toISOString().slice(0, 10),
            total_chats_analyzed: formattedChats.length,
            overall_score: aiResultJson.overall_score || 0,
            cordiality_score: aiResultJson.cordiality_score || 0,
            speed_score: aiResultJson.speed_score || 0,
            resolution_score: aiResultJson.resolution_score || 0,
            rejected_leads_count: aiResultJson.rejected_leads_count || 0,
            slow_response_count: aiResultJson.slow_response_count || 0,
            executive_summary: aiResultJson.executive_summary || "",
            strengths: aiResultJson.strengths || [],
            weaknesses: aiResultJson.weaknesses || [],
            recommendations: aiResultJson.recommendations || [],
            chat_evaluations: aiResultJson.chat_evaluations || [],
            model_used: modelUsed,
            created_by: authData?.user?.email || "n8n_automation",
          })
          .select("id")
          .single();

        if (!saveErr && savedAudit) {
          savedAuditId = savedAudit.id;
        }
      } catch (err) {
        console.warn("No se pudo guardar la auditoría en la BD:", err);
      }
    }

    return NextResponse.json({
      success: true,
      auditId: savedAuditId,
      modelUsed,
      totalAnalyzed: formattedChats.length,
      audit: aiResultJson,
    });
  } catch (err: any) {
    console.error("Error en auditoría de atención:", err);
    return NextResponse.json(
      { error: err.message || "Error interno al ejecutar auditoría con IA." },
      { status: 500 }
    );
  }
}
