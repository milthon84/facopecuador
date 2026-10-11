import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";
import { hasPermission } from "@/lib/roles";
import { DEFAULT_AUDIT_SYSTEM_PROMPT, getEffectiveAuditPrompt } from "@/lib/ia-audit-prompt";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authData = await getCachedUserAndPermissions();
    if (!authData?.user || !hasPermission(authData.role, "/erp/auditoria-atencion", authData.allowedPaths)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data } = await supabase
      .from("web_settings")
      .select("value")
      .eq("key", "ia_audit_config")
      .maybeSingle();

    const geminiKey = data?.value?.geminiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
    const claudeKey = data?.value?.claudeKey || process.env.ANTHROPIC_API_KEY || "";
    const openAiKey = data?.value?.openAiKey || process.env.OPENAI_API_KEY || "";
    const provider = data?.value?.provider || (geminiKey ? "gemini" : claudeKey ? "anthropic" : openAiKey ? "openai" : "gemini");
    let model = data?.value?.model || (provider === "anthropic" ? "claude-haiku-5-5" : provider === "openai" ? "gpt-4o-mini" : "gemini-flash-latest");
    if (model.includes("1.5") || model.includes("2.0")) {
      model = "gemini-flash-latest";
    }
    const prompt = data?.value?.prompt || DEFAULT_AUDIT_SYSTEM_PROMPT;

    return NextResponse.json({
      success: true,
      hasKey: !!(geminiKey || claudeKey || openAiKey),
      geminiKey: geminiKey ? `${geminiKey.slice(0, 6)}...${geminiKey.slice(-4)}` : "",
      claudeKey: claudeKey ? `${claudeKey.slice(0, 7)}...${claudeKey.slice(-4)}` : "",
      openAiKey: openAiKey ? `${openAiKey.slice(0, 7)}...${openAiKey.slice(-4)}` : "",
      provider,
      model,
      prompt,
      defaultPrompt: DEFAULT_AUDIT_SYSTEM_PROMPT,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authData = await getCachedUserAndPermissions();
    if (!authData?.user || !hasPermission(authData.role, "/erp/auditoria-atencion", authData.allowedPaths)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { geminiKey, claudeKey, openAiKey, provider, model, prompt } = body;

    const supabase = createAdminClient();

    // Obtener valores existentes para no sobreescribir si vienen vacíos / enmascarados
    const { data: existing } = await supabase
      .from("web_settings")
      .select("value")
      .eq("key", "ia_audit_config")
      .maybeSingle();

    const currentVal = existing?.value || {};

    const updatedVal = {
      geminiKey: geminiKey && !geminiKey.includes("...") ? geminiKey.trim() : (currentVal.geminiKey || ""),
      claudeKey: claudeKey && !claudeKey.includes("...") ? claudeKey.trim() : (currentVal.claudeKey || ""),
      openAiKey: openAiKey && !openAiKey.includes("...") ? openAiKey.trim() : (currentVal.openAiKey || ""),
      provider: provider || currentVal.provider || "gemini",
      model: model || currentVal.model || "gemini-flash-latest",
      prompt: typeof prompt === "string" ? prompt.trim() : (currentVal.prompt || DEFAULT_AUDIT_SYSTEM_PROMPT),
      updated_at: new Date().toISOString(),
      updated_by: authData.user.email,
    };

    const { error } = await supabase
      .from("web_settings")
      .upsert(
        { key: "ia_audit_config", value: updatedVal },
        { onConflict: "key" }
      );

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Configuración y Prompt de IA guardados correctamente." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar configuración de IA" }, { status: 500 });
  }
}
