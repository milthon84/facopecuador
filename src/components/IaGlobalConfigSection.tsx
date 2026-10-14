"use client";

import { useState, useEffect } from "react";
import {
  Bot,
  Sparkles,
  ExternalLink,
  Check,
  AlertTriangle,
  Save,
  RefreshCw,
  Cpu,
  CheckCircle2,
  Radio,
  Zap,
} from "lucide-react";

export default function IaGlobalConfigSection() {
  const [savedProvider, setSavedProvider] = useState<"gemini" | "anthropic" | "openai">("gemini");
  const [savedModel, setSavedModel] = useState<string>("gemini-flash-latest");
  const [selectedProvider, setSelectedProvider] = useState<"gemini" | "anthropic" | "openai">("gemini");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-flash-latest");

  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [claudeKeyInput, setClaudeKeyInput] = useState("");
  const [openAiKeyInput, setOpenAiKeyInput] = useState("");

  const [savedGeminiKeyMasked, setSavedGeminiKeyMasked] = useState("");
  const [savedClaudeKeyMasked, setSavedClaudeKeyMasked] = useState("");
  const [savedOpenAiKeyMasked, setSavedOpenAiKeyMasked] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/auditoria-atencion/config");
      const data = await res.json();
      if (data.success) {
        setSavedGeminiKeyMasked(data.geminiKey || "");
        setSavedClaudeKeyMasked(data.claudeKey || "");
        setSavedOpenAiKeyMasked(data.openAiKey || "");

        setGeminiKeyInput(data.geminiKey || "");
        setClaudeKeyInput(data.claudeKey || "");
        setOpenAiKeyInput(data.openAiKey || "");

        const prov = (data.provider as "gemini" | "anthropic" | "openai") || "gemini";
        setSavedProvider(prov);
        setSelectedProvider(prov);

        let mod = data.model || (prov === "anthropic" ? "claude-haiku-5-5" : prov === "openai" ? "gpt-4o-mini" : "gemini-flash-latest");
        if (mod.includes("1.5") || mod.includes("2.0")) {
          mod = "gemini-flash-latest";
        }
        if (prov === "anthropic" && (mod.includes("3") || mod.includes("haiku-latest"))) {
          mod = "claude-haiku-5-5";
        }
        setSavedModel(mod);
        setSelectedModel(mod);
      }
    } catch (err) {
      console.error("Error al cargar configuración de IA:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/auditoria-atencion/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          geminiKey: geminiKeyInput,
          claudeKey: claudeKeyInput,
          openAiKey: openAiKeyInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar configuración");

      setSavedProvider(selectedProvider);
      setSavedModel(selectedModel);

      if (geminiKeyInput && !geminiKeyInput.includes("...")) {
        setSavedGeminiKeyMasked(`${geminiKeyInput.slice(0, 6)}...${geminiKeyInput.slice(-4)}`);
      }
      if (claudeKeyInput && !claudeKeyInput.includes("...")) {
        setSavedClaudeKeyMasked(`${claudeKeyInput.slice(0, 7)}...${claudeKeyInput.slice(-4)}`);
      }
      if (openAiKeyInput && !openAiKeyInput.includes("...")) {
        setSavedOpenAiKeyMasked(`${openAiKeyInput.slice(0, 7)}...${openAiKeyInput.slice(-4)}`);
      }

      setMsg({
        type: "success",
        text: `¡Configuración guardada! El motor activo ahora es ${
          selectedProvider === "gemini" ? "Google Gemini" : selectedProvider === "anthropic" ? "Anthropic Claude" : "OpenAI"
        } (${selectedModel}).`,
      });
      setTimeout(() => setMsg(null), 6000);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Error al guardar configuración" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-ink-400 flex items-center justify-center gap-2">
        <RefreshCw size={16} className="animate-spin text-lilac-600" />
        <span>Cargando estado de Inteligencia Artificial...</span>
      </div>
    );
  }

  const hasUnsavedChanges = selectedProvider !== savedProvider || selectedModel !== savedModel;

  const getProviderName = (p: string) => {
    if (p === "gemini") return "Google Gemini";
    if (p === "anthropic") return "Anthropic Claude";
    if (p === "openai") return "OpenAI ChatGPT";
    return p;
  };

  const getActiveKeyMasked = () => {
    if (savedProvider === "gemini") return savedGeminiKeyMasked;
    if (savedProvider === "anthropic") return savedClaudeKeyMasked;
    if (savedProvider === "openai") return savedOpenAiKeyMasked;
    return "";
  };

  return (
    <div id="ia-config" className="p-4 sm:p-6 space-y-5">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-lilac-100 pb-3">
        <h4 className="font-bold text-sm text-ink-800 flex items-center gap-2">
          <Bot size={18} className="text-lilac-600" />
          <span>Configuración de Inteligencia Artificial (IA)</span>
        </h4>
      </div>

      {/* BANNER DESTACADO: PROVEEDOR ACTUALMENTE EN USO */}
      <div className="rounded-2xl border border-slate-700/60 p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-ink-950 to-slate-900 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0 shadow-inner">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1.5 shadow-xs">
                <CheckCircle2 size={12} className="stroke-[3] text-emerald-400" /> MOTOR EN USO ACTUALMENTE
              </span>
              <span className="text-[11px] text-slate-300">
                (Este es el proveedor que procesa las solicitudes)
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap pt-0.5">
              <span className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                {savedProvider === "gemini" && <Sparkles size={18} className="text-emerald-400" />}
                {savedProvider === "anthropic" && <Cpu size={18} className="text-amber-400" />}
                {savedProvider === "openai" && <Zap size={18} className="text-indigo-400" />}
                {getProviderName(savedProvider)}
              </span>

              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-white/10 text-emerald-200 border border-white/15">
                Modelo: {savedModel}
              </span>

              {savedProvider === "gemini" && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                  100% GRATIS (AI Studio)
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-300 flex items-center gap-2 flex-wrap pt-0.5">
              <span>
                Clave API guardada:{" "}
                <strong className="text-white font-mono">
                  {getActiveKeyMasked() || "⚠️ No configurada"}
                </strong>
              </span>
              {!getActiveKeyMasked() && (
                <span className="text-[10px] font-bold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/40">
                  Requiere ingresar API Key abajo para poder procesar
                </span>
              )}
            </div>
          </div>
        </div>

        {hasUnsavedChanges && (
          <div className="bg-amber-500/20 border border-amber-400/50 rounded-xl px-3.5 py-2.5 text-amber-200 text-xs flex items-center gap-2 shrink-0">
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            <div>
              <div className="font-bold">Cambio pendiente sin guardar</div>
              <div className="text-[11px] text-amber-300">
                Has seleccionado <b>{getProviderName(selectedProvider)} ({selectedModel})</b>. Haz clic en "Guardar Configuración" abajo para activarlo.
              </div>
            </div>
          </div>
        )}
      </div>

      {msg && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 shadow-xs ${
            msg.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-rose-50 text-rose-900 border border-rose-200"
          }`}
        >
          {msg.type === "success" ? (
            <Check size={18} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle size={18} className="text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{msg.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5 text-xs">
        {/* 1. SELECCIÓN DE PROVEEDOR */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-ink-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>1. Elegir Proveedor de Inteligencia Artificial</span>
            </label>
            <span className="text-[11px] text-ink-500 font-medium">
              Haz clic en el proveedor que deseas activar y pulsa "Guardar"
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* OPCIÓN 1: GOOGLE GEMINI */}
            <button
              type="button"
              onClick={() => {
                setSelectedProvider("gemini");
                if (!selectedModel.startsWith("gemini")) setSelectedModel("gemini-flash-latest");
              }}
              className={`p-4 rounded-2xl border text-left transition relative flex flex-col justify-between gap-3 ${
                selectedProvider === "gemini"
                  ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-400/60 shadow-sm"
                  : "border-lilac-200 bg-white hover:bg-lilac-50/30"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <div className="font-black text-sm text-ink-950">Google Gemini</div>
                      <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
                        100% Gratuito (Google AI Studio)
                      </div>
                    </div>
                  </div>

                  {savedProvider === "gemini" ? (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" /> EN USO
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-lilac-100 text-ink-500 border border-lilac-200 shrink-0">
                      Inactivo
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-ink-600 leading-relaxed">
                  Ideal para Ecuador y auditorías diarias. Hasta <b>1,500 auditorías gratis al día</b> sin necesidad de tarjeta ni costos.
                </p>
              </div>

              <div className="pt-2 border-t border-lilac-100/70 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-ink-500">
                  Key: {savedGeminiKeyMasked ? <span className="text-emerald-700 font-mono font-bold">Configurada</span> : <span className="text-rose-600 font-bold">Sin clave</span>}
                </span>
                <span className={`font-bold flex items-center gap-1 ${selectedProvider === "gemini" ? "text-emerald-700" : "text-ink-400"}`}>
                  {selectedProvider === "gemini" ? "✓ Seleccionado" : "Clic para elegir"}
                </span>
              </div>
            </button>

            {/* OPCIÓN 2: ANTHROPIC CLAUDE */}
            <button
              type="button"
              onClick={() => {
                setSelectedProvider("anthropic");
                if (!selectedModel.startsWith("claude")) setSelectedModel("claude-haiku-5-5");
              }}
              className={`p-4 rounded-2xl border text-left transition relative flex flex-col justify-between gap-3 ${
                selectedProvider === "anthropic"
                  ? "border-amber-500 bg-amber-50/60 ring-2 ring-amber-400/60 shadow-sm"
                  : "border-lilac-200 bg-white hover:bg-lilac-50/30"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                      <Cpu size={16} />
                    </div>
                    <div>
                      <div className="font-black text-sm text-ink-950">Anthropic Claude</div>
                      <div className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">
                        Pago x Uso (Haiku / Sonnet)
                      </div>
                    </div>
                  </div>

                  {savedProvider === "anthropic" ? (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" /> EN USO
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-lilac-100 text-ink-500 border border-lilac-200 shrink-0">
                      Inactivo
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-ink-600 leading-relaxed">
                  Excelente capacidad lingüística y detección de tono empático en atención a clientes. Requiere recarga de créditos.
                </p>
              </div>

              <div className="pt-2 border-t border-lilac-100/70 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-ink-500">
                  Key: {savedClaudeKeyMasked ? <span className="text-amber-700 font-mono font-bold">Configurada</span> : <span className="text-rose-600 font-bold">Sin clave</span>}
                </span>
                <span className={`font-bold flex items-center gap-1 ${selectedProvider === "anthropic" ? "text-amber-700" : "text-ink-400"}`}>
                  {selectedProvider === "anthropic" ? "✓ Seleccionado" : "Clic para elegir"}
                </span>
              </div>
            </button>

            {/* OPCIÓN 3: OPENAI */}
            <button
              type="button"
              onClick={() => {
                setSelectedProvider("openai");
                if (!selectedModel.startsWith("gpt")) setSelectedModel("gpt-4o-mini");
              }}
              className={`p-4 rounded-2xl border text-left transition relative flex flex-col justify-between gap-3 ${
                selectedProvider === "openai"
                  ? "border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-400/60 shadow-sm"
                  : "border-lilac-200 bg-white hover:bg-lilac-50/30"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                      <Zap size={16} />
                    </div>
                    <div>
                      <div className="font-black text-sm text-ink-950">OpenAI ChatGPT</div>
                      <div className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">
                        Pago x Uso (GPT-4o Mini / 4o)
                      </div>
                    </div>
                  </div>

                  {savedProvider === "openai" ? (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" /> EN USO
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-lilac-100 text-ink-500 border border-lilac-200 shrink-0">
                      Inactivo
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-ink-600 leading-relaxed">
                  Ampliamente conocido con GPT-4o Mini para respuestas muy rápidas y estructuradas. Requiere saldo en platform.openai.com.
                </p>
              </div>

              <div className="pt-2 border-t border-lilac-100/70 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-ink-500">
                  Key: {savedOpenAiKeyMasked ? <span className="text-indigo-700 font-mono font-bold">Configurada</span> : <span className="text-rose-600 font-bold">Sin clave</span>}
                </span>
                <span className={`font-bold flex items-center gap-1 ${selectedProvider === "openai" ? "text-indigo-700" : "text-ink-400"}`}>
                  {selectedProvider === "openai" ? "✓ Seleccionado" : "Clic para elegir"}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* 2. MODELO ESPECÍFICO */}
        <div>
          <label className="block text-xs font-bold text-ink-800 uppercase tracking-wider mb-2">
            2. Modelo Específico de {getProviderName(selectedProvider)}
          </label>

          {selectedProvider === "gemini" && (
            <div className="space-y-2">
              {[
                {
                  id: "gemini-flash-latest",
                  name: "Gemini Flash (Automático / Más Rápido)",
                  badge: "100% GRATIS • Recomendado",
                  desc: "El modelo más veloz y optimizado. Sin costo en Google AI Studio (hasta 1,500 auditorías/día).",
                },
                {
                  id: "gemini-2.5-flash",
                  name: "Gemini 2.5 Flash",
                  badge: "100% GRATIS • Alta Precisión",
                  desc: "Excelente comprensión de contexto y detección de cordialidad y rechazos de pacientes.",
                },
                {
                  id: "gemini-3.5-flash",
                  name: "Gemini 3.5 Flash",
                  badge: "100% GRATIS • Ultra Veloz",
                  desc: "Tiempo de respuesta ultra veloz para procesamiento masivo de chats de WhatsApp.",
                },
                {
                  id: "gemini-3.8-flash",
                  name: "Gemini 3.8 Flash",
                  badge: "100% GRATIS • Mayor Profundidad",
                  desc: "Mayor balance de profundidad analítica para diagnósticos exhaustivos de atención.",
                },
              ].map((m) => {
                const isThisModelActive = savedProvider === "gemini" && savedModel === m.id;
                return (
                  <label
                    key={m.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                      selectedModel === m.id
                        ? "bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-300 shadow-xs"
                        : "bg-white border-lilac-200 hover:bg-lilac-50/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="ai_global_model"
                        value={m.id}
                        checked={selectedModel === m.id}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                      />
                      <div>
                        <div className="font-bold text-xs text-ink-900 flex items-center gap-2">
                          <span>{m.name}</span>
                          {isThisModelActive && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-900 border border-emerald-300">
                              ● EN USO
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-ink-500">{m.desc}</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                      {m.badge}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {selectedProvider === "anthropic" && (
            <div className="space-y-2">
              {[
                {
                  id: "claude-haiku-5-5",
                  name: "Claude Haiku 5.5",
                  badge: "Ultra Rápido y Barato",
                  desc: "El modelo más veloz y económico de Anthropic. Excelente para auditorías en tiempo real.",
                },
                {
                  id: "claude-sonnet-5-5",
                  name: "Claude Sonnet 5.5",
                  badge: "Máxima Inteligencia",
                  desc: "Máxima precisión en detección de tono, empatía y errores sutiles de asesoría.",
                },
                {
                  id: "claude-haiku-4-5-20251001",
                  name: "Claude Haiku 4.5",
                  badge: "Económico y Confiable",
                  desc: "Modelo balanceado para auditoría conversacional de atención al cliente.",
                },
              ].map((m) => {
                const isThisModelActive = savedProvider === "anthropic" && savedModel === m.id;
                return (
                  <label
                    key={m.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                      selectedModel === m.id
                        ? "bg-amber-50/80 border-amber-400 ring-1 ring-amber-300 shadow-xs"
                        : "bg-white border-lilac-200 hover:bg-lilac-50/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="ai_global_model"
                        value={m.id}
                        checked={selectedModel === m.id}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="text-amber-600 focus:ring-amber-500 h-4 w-4"
                      />
                      <div>
                        <div className="font-bold text-xs text-ink-900 flex items-center gap-2">
                          <span>{m.name}</span>
                          {isThisModelActive && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 border border-amber-300">
                              ● EN USO
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-ink-500">{m.desc}</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                      {m.badge}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {selectedProvider === "openai" && (
            <div className="space-y-2">
              {[
                {
                  id: "gpt-4o-mini",
                  name: "GPT-4o Mini",
                  badge: "Ultra Barato (~$0.15 / 1M)",
                  desc: "El modelo más económico y rápido de OpenAI.",
                },
                {
                  id: "gpt-4o",
                  name: "GPT-4o",
                  badge: "Estándar OpenAI (~$2.50 / 1M)",
                  desc: "Gran capacidad de razonamiento y análisis.",
                },
              ].map((m) => {
                const isThisModelActive = savedProvider === "openai" && savedModel === m.id;
                return (
                  <label
                    key={m.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                      selectedModel === m.id
                        ? "bg-indigo-50/80 border-indigo-400 ring-1 ring-indigo-300 shadow-xs"
                        : "bg-white border-lilac-200 hover:bg-lilac-50/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="ai_global_model"
                        value={m.id}
                        checked={selectedModel === m.id}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div>
                        <div className="font-bold text-xs text-ink-900 flex items-center gap-2">
                          <span>{m.name}</span>
                          {isThisModelActive && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-indigo-200 text-indigo-900 border border-indigo-300">
                              ● EN USO
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-ink-500">{m.desc}</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 shrink-0">
                      {m.badge}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. CLAVE API DEL PROVEEDOR SELECCIONADO */}
        <div className="pt-3 border-t border-lilac-100 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <label className="text-xs font-bold text-ink-800 uppercase tracking-wider block">
                3. Clave API ({getProviderName(selectedProvider)})
              </label>
              <p className="text-[11px] text-ink-500">
                {selectedProvider === "gemini" && "Ingresa la clave generada en Google AI Studio (empieza con AIzaSy...)."}
                {selectedProvider === "anthropic" && "Ingresa tu clave de consola Anthropic (empieza con sk-ant-...)."}
                {selectedProvider === "openai" && "Ingresa tu clave de OpenAI (empieza con sk-proj-...)."}
              </p>
            </div>

            {selectedProvider === "gemini" && (
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-emerald-700 hover:underline inline-flex items-center gap-1 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
              >
                <span>Obtener Key Gratis en Google AI Studio</span>
                <ExternalLink size={12} />
              </a>
            )}
            {selectedProvider === "anthropic" && (
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-amber-700 hover:underline inline-flex items-center gap-1 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200"
              >
                <span>Consola Anthropic</span>
                <ExternalLink size={12} />
              </a>
            )}
            {selectedProvider === "openai" && (
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-indigo-700 hover:underline inline-flex items-center gap-1 font-bold bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200"
              >
                <span>Plataforma OpenAI</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          {selectedProvider === "gemini" && (
            <input
              type="password"
              value={geminiKeyInput}
              onChange={(e) => setGeminiKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3.5 py-2.5 border border-emerald-300 rounded-xl bg-white font-mono text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none shadow-xs"
            />
          )}

          {selectedProvider === "anthropic" && (
            <input
              type="password"
              value={claudeKeyInput}
              onChange={(e) => setClaudeKeyInput(e.target.value)}
              placeholder="sk-ant-api03-..."
              className="w-full px-3.5 py-2.5 border border-amber-300 rounded-xl bg-white font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none shadow-xs"
            />
          )}

          {selectedProvider === "openai" && (
            <input
              type="password"
              value={openAiKeyInput}
              onChange={(e) => setOpenAiKeyInput(e.target.value)}
              placeholder="sk-proj-..."
              className="w-full px-3.5 py-2.5 border border-indigo-300 rounded-xl bg-white font-mono text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none shadow-xs"
            />
          )}
        </div>

        {/* BOTÓN DE GUARDAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-lilac-100">
          <div className="text-[11px] text-ink-500">
            {hasUnsavedChanges ? (
              <span className="text-amber-700 font-bold flex items-center gap-1">
                <AlertTriangle size={13} /> Tienes cambios pendientes. Recuerda hacer clic en "Guardar Configuración".
              </span>
            ) : (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <Check size={13} /> La configuración mostrada coincide con el motor activo en el sistema.
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl transition font-bold text-xs shadow-md ${
              hasUnsavedChanges
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white ring-2 ring-emerald-300 shadow-emerald-200"
                : "bg-lilac-600 hover:bg-lilac-700 text-white shadow-lilac-200"
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save size={15} />
                <span>Guardar Configuración Global de IA</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
