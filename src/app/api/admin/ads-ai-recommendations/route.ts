import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { payload, period, apiKey } = body;

    let keyToUse = (apiKey || "").trim();

    if (!keyToUse) {
      try {
        const supabase = createAdminClient();
        const { data } = await supabase
          .from("web_settings")
          .select("value")
          .eq("key", "ads_config")
          .maybeSingle();

        if (data?.value?.claudeKey && typeof data.value.claudeKey === "string") {
          keyToUse = data.value.claudeKey.trim();
        }
      } catch {}
    }

    if (!keyToUse) {
      keyToUse = (process.env.ANTHROPIC_API_KEY || "").trim();
    }

    if (!keyToUse) {
      return NextResponse.json(
        {
          error:
            "No se ha configurado la API Key de Claude. Ingresa tu Anthropic API Key en el panel de configuración (⚙️) o define la variable ANTHROPIC_API_KEY.",
        },
        { status: 400 }
      );
    }

    if (!payload || !Array.isArray(payload) || payload.length === 0) {
      return NextResponse.json(
        { error: "No hay datos de anuncios disponibles en este periodo para analizar." },
        { status: 400 }
      );
    }

    // Preparar resumen estructurado para reducir consumo de tokens
    const adsSummary = payload.map((ad: any) => ({
      anuncio: ad.a,
      presupuesto: ad.b,
      contactos: ad.ct,
      costo_por_contacto: ad.cc,
      ctr: ad.ctr,
      veredicto: ad.e,
      estado_campana: ad.st || "Activo",
      dias_activa: ad.dias || ad.d || "N/D",
    }));

    const systemPrompt = `Eres un Director Estratégico de Marketing Digital y Especialista Senior en Meta Ads (Facebook e Instagram) especializado en clínicas odontológicas y centros de formación profesional. Tu tarea es analizar las métricas reales de las campañas publicitarias y proporcionar recomendaciones ejecutivas, directas y altamente accionables.`;

    const userPrompt = `Analiza las siguientes métricas de campañas publicitarias activas en el periodo "${period === "hoy" ? "Hoy (últimas 24h)" : `Últimos ${period} días`}":

${JSON.stringify(adsSummary, null, 2)}

Por favor, genera un análisis ejecutivo en español estructurado exactamente con estas 3 secciones:

1. 🚀 **ACCIONES PARA POTENCIAR Y ESCALAR** (Cuáles anuncios multiplicar o aumentar presupuesto y por qué).
2. ⚠️ **MEDIDAS CORRECTIVAS INMEDIATAS** (Qué campañas pausar, reestructurar o ajustar por costo alto/bajo CTR).
3. 💡 **MEJORAS DE CREATIVOS Y AUDIENCIA** (Recomendaciones de copy, gancho visual o segmentación específica).

Mantén las respuestas concisas, profesionales y basadas estrictamente en el retorno de inversión de las cifras ingresadas.`;

    // Intentar primero con Claude 3.5 Sonnet o Claude 3 Haiku como respaldo
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": keyToUse,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      let detail = errText;
      try {
        const parsedErr = JSON.parse(errText);
        detail = parsedErr.error?.message || errText;
      } catch (e) {}

      return NextResponse.json(
        { error: `Error desde la API de Claude (HTTP ${anthropicRes.status}): ${detail}` },
        { status: anthropicRes.status }
      );
    }

    const anthropicData = await anthropicRes.json();
    const replyText =
      anthropicData.content?.[0]?.text || "No se pudo obtener una respuesta de análisis de Claude.";

    return NextResponse.json({ success: true, analysis: replyText });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Error en la llamada a la IA de Claude: ${err.message || err}` },
      { status: 500 }
    );
  }
}
