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

  // Usar por defecto gemini-3.5-flash-lite (el modelo más económico, ultra-rápido y con cuota gratuita generosa)
  if (provider === "gemini" && (!model || model.includes("1.5") || model.includes("2.0") || model === "gemini-flash-latest")) {
    model = "gemini-3.5-flash-lite";
  }

  return { geminiKey, claudeKey, openAiKey, provider, model, customPrompt };
}

export function hasAnyAiKey(cfg: AiConfig): boolean {
  return !!(cfg.geminiKey || cfg.claudeKey || cfg.openAiKey);
}

/**
 * Extrae y parsea el primer bloque JSON válido de una respuesta, tolerando texto adicional o bloques markdown.
 */
function cleanAndParseJson(raw: string): any {
  const trimmed = raw.trim();
  // 1. Intento directo tras quitar fences markdown
  const stripped = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {}

  // 2. Buscar el bloque entre la primera '{' y la última '}'
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = trimmed.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
  }

  throw new Error(`La IA respondió pero no en formato JSON estructurado válido. Respuesta: ${raw.slice(0, 250)}`);
}

/**
 * Llamada a Google Gemini con reintento por candidatos y timeout.
 */
async function callGemini(
  cfg: AiConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<{ text: string; model: string } | null> {
  if (!cfg.geminiKey) return null;

  const userModel = cfg.model?.trim() || "";
  const candidates = [
    userModel.startsWith("gemini") ? userModel : "gemini-3.5-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
  ].filter((m, i, arr) => !!m && arr.indexOf(m) === i);

  for (const modelToTry of candidates) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${cfg.geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(35000),
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.15,
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 0) {
          return { text, model: `Google ${modelToTry}` };
        }
      } else {
        const errText = await res.text();
        console.warn(`Gemini (${modelToTry}) devolvió HTTP ${res.status}:`, errText.slice(0, 200));
        // Si fue 503 (alta demanda) o 429 (rate limit), breve pausa antes de probar el siguiente modelo
        if (res.status === 503 || res.status === 429) {
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
    } catch (err: any) {
      console.warn(`Error de conexión con Gemini (${modelToTry}):`, err?.message || err);
    }
  }

  return null;
}

/**
 * Llamada a Anthropic Claude con token buffer expandido (8192) y timeout.
 */
async function callClaude(
  cfg: AiConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<{ text: string; model: string } | null> {
  if (!cfg.claudeKey) return null;

  const target = cfg.model && cfg.model.includes("claude") ? cfg.model : "claude-haiku-5-5";
  const candidates = [target, "claude-haiku-5-5", "claude-sonnet-5-5"].filter(
    (m, i, arr) => !!m && arr.indexOf(m) === i
  );

  for (const m of candidates) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": cfg.claudeKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        signal: AbortSignal.timeout(40000),
        body: JSON.stringify({
          model: m,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text;
        if (text && text.trim().length > 0) {
          return { text, model: `Anthropic ${m}` };
        }
      } else {
        const errText = await res.text();
        console.warn(`Claude (${m}) devolvió HTTP ${res.status}:`, errText.slice(0, 200));
      }
    } catch (err: any) {
      console.warn(`Error de conexión con Claude (${m}):`, err?.message || err);
    }
  }

  return null;
}

/**
 * Llamada a OpenAI como proveedor / fallback.
 */
async function callOpenAi(
  cfg: AiConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<{ text: string; model: string } | null> {
  if (!cfg.openAiKey) return null;

  const targetModel = cfg.model && cfg.model.includes("gpt") ? cfg.model : "gpt-4o-mini";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.openAiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(35000),
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
      const text = data.choices?.[0]?.message?.content;
      if (text && text.trim().length > 0) {
        return { text, model: `OpenAI ${targetModel}` };
      }
    } else {
      const errText = await res.text();
      console.warn(`OpenAI devolvió HTTP ${res.status}:`, errText.slice(0, 200));
    }
  } catch (err: any) {
    console.warn(`Error de conexión con OpenAI:`, err?.message || err);
  }

  return null;
}

/**
 * Envía system + user prompt con failover inteligente entre todos los proveedores configurados.
 */
export async function callAiForJson(
  cfg: AiConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<{ parsed: any; modelUsed: string }> {
  // Orden dinámico de proveedores según preferencia configurada
  const providerOrder: Array<"gemini" | "anthropic" | "openai"> = [];
  if (cfg.provider === "anthropic") {
    providerOrder.push("anthropic", "gemini", "openai");
  } else if (cfg.provider === "openai") {
    providerOrder.push("openai", "gemini", "anthropic");
  } else {
    providerOrder.push("gemini", "anthropic", "openai");
  }

  let result: { text: string; model: string } | null = null;

  for (const provider of providerOrder) {
    if (provider === "gemini" && cfg.geminiKey) {
      result = await callGemini(cfg, systemPrompt, userPrompt);
    } else if (provider === "anthropic" && cfg.claudeKey) {
      result = await callClaude(cfg, systemPrompt, userPrompt);
    } else if (provider === "openai" && cfg.openAiKey) {
      result = await callOpenAi(cfg, systemPrompt, userPrompt);
    }

    if (result && result.text) break;
  }

  if (!result || !result.text) {
    throw new Error(
      "No se pudo obtener respuesta de ningún motor de Inteligencia Artificial configurado. " +
      "Verifica las API Keys, los límites de cuota y el estado de los servicios."
    );
  }

  const parsed = cleanAndParseJson(result.text);
  return { parsed, modelUsed: result.model };
}
