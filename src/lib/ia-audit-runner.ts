import type { SupabaseClient } from "@supabase/supabase-js";

export interface AiConfig {
  geminiKey: string;
  claudeKey: string;
  openAiKey: string;
  provider: string;
  model: string;
  customPrompt: string;
}

/**
 * Resuelve las credenciales y el motor de IA: body > web_settings (ia_audit_config / ads_config) > variables de entorno.
 */
export async function resolveAiConfig(
  supabase: SupabaseClient,
  body: { geminiKey?: string; claudeKey?: string; apiKey?: string; openAiKey?: string; provider?: string; model?: string } = {}
): Promise<AiConfig> {
  let geminiKey = (body.geminiKey || "").trim();
  let claudeKey = (body.claudeKey || body.apiKey || "").trim();
  let openAiKey = (body.openAiKey || "").trim();
  let provider = body.provider || "";
  let model = body.model || "";
  let customPrompt = "";

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
      if (!provider && auditConfig.value.provider) provider = auditConfig.value.provider;
      if (!model && auditConfig.value.model) model = auditConfig.value.model;
      if (auditConfig.value.prompt) customPrompt = auditConfig.value.prompt;
    }

    const { data: adsConfig } = await supabase
      .from("web_settings")
      .select("value")
      .eq("key", "ads_config")
      .maybeSingle();

    if (!claudeKey && adsConfig?.value?.claudeKey) claudeKey = adsConfig.value.claudeKey.trim();
  } catch {}

  if (!geminiKey) geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim();
  if (!claudeKey) claudeKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!openAiKey) openAiKey = (process.env.OPENAI_API_KEY || "").trim();

  if (!provider) {
    provider = geminiKey ? "gemini" : claudeKey ? "anthropic" : openAiKey ? "openai" : "gemini";
  }

  return { geminiKey, claudeKey, openAiKey, provider, model, customPrompt };
}

export function hasAnyAiKey(cfg: AiConfig): boolean {
  return !!(cfg.geminiKey || cfg.claudeKey || cfg.openAiKey);
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Envía system + user prompt al proveedor configurado y devuelve el JSON parseado.
 * Lanza Error con detalle si ningún proveedor responde.
 */
export async function callAiForJson(
  cfg: AiConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<{ parsed: any; modelUsed: string }> {
  let rawReply = "";
  let modelUsed = "";
  let lastErrorDetail = "";

  // PROVEEDOR 1: GOOGLE GEMINI
  if (cfg.provider === "gemini" && cfg.geminiKey) {
    let baseRequested = cfg.model || "gemini-flash-latest";
    if (baseRequested.includes("1.5") || baseRequested.includes("2.0")) {
      baseRequested = "gemini-flash-latest";
    }
    const candidates = [baseRequested, "gemini-flash-latest", "gemini-2.5-flash"].filter(
      (m, i, arr) => !!m && arr.indexOf(m) === i
    );

    for (const modelToTry of candidates) {
      if (rawReply) break;
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${cfg.geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.2,
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          rawReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (rawReply) {
            modelUsed = `Google ${modelToTry}`;
            break;
          }
        } else {
          const errText = await res.text();
          console.warn(`Respuesta no OK de Gemini (${modelToTry}):`, res.status, errText);
          lastErrorDetail = `Google Gemini (${res.status} ${modelToTry}): ${errText}`;
        }
      } catch (err: any) {
        lastErrorDetail = `Google Gemini: ${err.message || String(err)}`;
      }
    }
  }

  // PROVEEDOR 2: ANTHROPIC CLAUDE
  if (!rawReply && ((cfg.provider === "anthropic" && cfg.claudeKey) || (!cfg.geminiKey && cfg.claudeKey))) {
    let target = cfg.model && cfg.model.includes("claude") ? cfg.model : "claude-haiku-5-5";
    if (target.includes("3") || target.includes("haiku-latest")) target = "claude-haiku-5-5";

    const candidates = [target, "claude-haiku-5-5", "claude-sonnet-5-5", "claude-haiku-4-5-20251001"].filter(
      (m, i, arr) => arr.indexOf(m) === i
    );

    for (const m of candidates) {
      if (rawReply) break;
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": cfg.claudeKey,
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
        if (res.ok) {
          const data = await res.json();
          rawReply = data.content?.[0]?.text || "";
          if (rawReply) {
            modelUsed = `Anthropic ${m}`;
            break;
          }
        } else {
          const errText = await res.text();
          console.warn(`Error con Claude (${m}):`, res.status, errText);
          lastErrorDetail = `Anthropic Claude (${res.status} ${m}): ${errText}`;
        }
      } catch (err: any) {
        lastErrorDetail = `Anthropic Claude: ${err.message || String(err)}`;
      }
    }
  }

  // PROVEEDOR 3: OPENAI
  if (!rawReply && ((cfg.provider === "openai" && cfg.openAiKey) || (!cfg.geminiKey && !cfg.claudeKey && cfg.openAiKey))) {
    const targetModel = cfg.model && cfg.model.includes("gpt") ? cfg.model : "gpt-4o-mini";
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.openAiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: targetModel,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        rawReply = data.choices?.[0]?.message?.content || "";
        if (rawReply) modelUsed = `OpenAI ${targetModel}`;
      } else {
        const errText = await res.text();
        lastErrorDetail = `OpenAI (${res.status}): ${errText}`;
      }
    } catch (err: any) {
      lastErrorDetail = `OpenAI: ${err.message || String(err)}`;
    }
  }

  // RESPALDO: Gemini si todo lo anterior falló
  if (!rawReply && cfg.geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${cfg.geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        rawReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (rawReply) modelUsed = "Google gemini-flash-latest (Respaldo)";
      }
    } catch {}
  }

  if (!rawReply) {
    throw new Error(
      lastErrorDetail
        ? `No se pudo obtener respuesta del modelo de IA: ${lastErrorDetail}`
        : "No se pudo obtener respuesta del modelo de Inteligencia Artificial. Revisa que tu API Key sea válida y tenga créditos/cuota."
    );
  }

  try {
    return { parsed: JSON.parse(stripJsonFences(rawReply)), modelUsed };
  } catch {
    throw new Error(`La IA respondió pero no en formato JSON estructurado. Respuesta: ${rawReply.slice(0, 300)}`);
  }
}
