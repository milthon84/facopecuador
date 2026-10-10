"use client";

import { useState, useEffect } from "react";
import {
  Bot,
  Sparkles,
  Key,
  ExternalLink,
  Check,
  AlertTriangle,
  Save,
  ShieldCheck,
  RefreshCw
} from "lucide-react";

export default function IaGlobalConfigSection() {
  const [selectedProvider, setSelectedProvider] = useState<"gemini" | "anthropic" | "openai">("gemini");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-flash-latest");
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [claudeKeyInput, setClaudeKeyInput] = useState("");
  const [openAiKeyInput, setOpenAiKeyInput] = useState("");
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
        setGeminiKeyInput(data.geminiKey || "");
        setClaudeKeyInput(data.claudeKey || "");
        setOpenAiKeyInput(data.openAiKey || "");
        if (data.provider) setSelectedProvider(data.provider);
        if (data.model) setSelectedModel(data.model);
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

      setMsg({ type: "success", text: "Configuración global de Inteligencia Artificial guardada exitosamente." });
      setTimeout(() => setMsg(null), 5000);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Error al guardar configuración" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-xs text-ink-400 flex items-center justify-center gap-2">
        <RefreshCw size={14} className="animate-spin text-lilac-600" />
        <span>Cargando configuración de IA...</span>
      </div>
    );
  }

  return (
    <div id="ia-config" className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-lilac-50 pb-2.5">
        <h4 className="font-semibold text-sm text-ink-700 flex items-center gap-2">
          <Bot size={16} className="text-lilac-600" />
          <span>Sección: Inteligencia Artificial Global (IA)</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-lilac-50 text-lilac-700 border border-lilac-200">
            Multi-Modelo
          </span>
        </h4>
        <span className="text-[11px] text-ink-400">
          Aplica a: Auditoría de Atención, Ads Analytics y futuras herramientas IA
        </span>
      </div>

      <p className="text-xs text-ink-600">
        Configura el motor de Inteligencia Artificial activo para todo el sistema FACOP. Puedes usar el plan <b>100% Gratuito de Google Gemini</b> o cambiarte a Claude / OpenAI según tus preferencias y presupuesto.
      </p>

      {msg && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            msg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {msg.type === "success" ? <Check size={16} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={16} className="text-rose-600 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4 text-xs">
        {/* 1. Proveedor */}
        <div>
          <label className="block text-[10px] font-bold text-ink-600 uppercase tracking-wider mb-1.5">
            1. Proveedor de Inteligencia Artificial Activo
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Google Gemini */}
            <button
              type="button"
              onClick={() => {
                setSelectedProvider("gemini");
                if (!selectedModel.startsWith("gemini")) setSelectedModel("gemini-1.5-flash");
              }}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 ${
                selectedProvider === "gemini"
                  ? "border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-200"
                  : "border-lilac-200 bg-white text-ink-700 hover:bg-lilac-50/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs flex items-center gap-1">
                  <Sparkles size={13} className="text-emerald-600" /> Google Gemini
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  100% GRATIS
                </span>
              </div>
              <span className="text-[11px] text-ink-500">Plan sin costo en Google AI Studio (hasta 1,500 auditorías/día)</span>
            </button>

            {/* Anthropic Claude */}
            <button
              type="button"
              onClick={() => {
                setSelectedProvider("anthropic");
                if (!selectedModel.startsWith("claude")) setSelectedModel("claude-3-5-haiku-20241022");
              }}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 ${
                selectedProvider === "anthropic"
                  ? "border-amber-500 bg-amber-50/70 text-amber-950 ring-2 ring-amber-200"
                  : "border-lilac-200 bg-white text-ink-700 hover:bg-lilac-50/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">Anthropic Claude</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-black bg-amber-100 text-amber-800 border border-amber-200">
                  Pago x Uso
                </span>
              </div>
              <span className="text-[11px] text-ink-500">Haiku (Económico) o Sonnet (Máxima precisión)</span>
            </button>

            {/* OpenAI */}
            <button
              type="button"
              onClick={() => {
                setSelectedProvider("openai");
                if (!selectedModel.startsWith("gpt")) setSelectedModel("gpt-4o-mini");
              }}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 ${
                selectedProvider === "openai"
                  ? "border-indigo-500 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-200"
                  : "border-lilac-200 bg-white text-ink-700 hover:bg-lilac-50/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">OpenAI</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Pago x Uso
                </span>
              </div>
              <span className="text-[11px] text-ink-500">GPT-4o Mini (Económico) o GPT-4o</span>
            </button>
          </div>
        </div>

        {/* 2. Modelo Específico */}
        <div>
          <label className="block text-[10px] font-bold text-ink-600 uppercase tracking-wider mb-1.5">
            2. Modelo Específico (Selecciona el más barato o gratuito)
          </label>

          {selectedProvider === "gemini" && (
            <div className="space-y-2">
              {[
                { id: "gemini-flash-latest", name: "Gemini Flash (Automático / Última Versión)", badge: "100% GRATIS • Recomendado", desc: "El más rápido y recomendado. Sin costo en Google AI Studio (hasta 1,500 auditorías/día)." },
                { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", badge: "100% GRATIS • Alta Precisión", desc: "Excelente comprensión de contexto y detección de cordialidad/rechazos." },
                { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite", badge: "100% GRATIS • Ultra Rápido", desc: "Tiempo de respuesta ultra veloz para procesamiento masivo de chats." },
                { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", badge: "100% GRATIS • Razonamiento Avanzado", desc: "Mayor profundidad analítica para diagnósticos exhaustivos." },
              ].map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                    selectedModel === m.id
                      ? "bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-300"
                      : "bg-white border-lilac-200 hover:bg-lilac-50/30"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="ai_global_model"
                      value={m.id}
                      checked={selectedModel === m.id}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-bold text-xs text-ink-900">{m.name}</div>
                      <div className="text-[11px] text-ink-500">{m.desc}</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                    {m.badge}
                  </span>
                </label>
              ))}
            </div>
          )}

          {selectedProvider === "anthropic" && (
            <div className="space-y-2">
              {[
                { id: "claude-3-5-haiku-latest", name: "Claude 3.5 Haiku", badge: "Ultra Barato (~$0.80 / 1M)", desc: "El modelo más económico y veloz de Anthropic." },
                { id: "claude-3-5-sonnet-latest", name: "Claude 3.5 Sonnet", badge: "Calidad Premium (~$3.00 / 1M)", desc: "Máxima precisión en detección de tono, empatía y errores sutiles." },
              ].map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                    selectedModel === m.id
                      ? "bg-amber-50/80 border-amber-400 ring-1 ring-amber-300"
                      : "bg-white border-lilac-200 hover:bg-lilac-50/30"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="ai_global_model"
                      value={m.id}
                      checked={selectedModel === m.id}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-bold text-xs text-ink-900">{m.name}</div>
                      <div className="text-[11px] text-ink-500">{m.desc}</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                    {m.badge}
                  </span>
                </label>
              ))}
            </div>
          )}

          {selectedProvider === "openai" && (
            <div className="space-y-2">
              {[
                { id: "gpt-4o-mini", name: "GPT-4o Mini", badge: "Ultra Barato (~$0.15 / 1M)", desc: "El modelo más económico y rápido de OpenAI." },
                { id: "gpt-4o", name: "GPT-4o", badge: "Estándar OpenAI (~$2.50 / 1M)", desc: "Gran capacidad de razonamiento y análisis." },
              ].map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                    selectedModel === m.id
                      ? "bg-indigo-50/80 border-indigo-400 ring-1 ring-indigo-300"
                      : "bg-white border-lilac-200 hover:bg-lilac-50/30"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="ai_global_model"
                      value={m.id}
                      checked={selectedModel === m.id}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-xs text-ink-900">{m.name}</div>
                      <div className="text-[11px] text-ink-500">{m.desc}</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 shrink-0">
                    {m.badge}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 3. API Keys */}
        <div className="pt-2 border-t border-lilac-100 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-ink-700 uppercase">
              3. Clave API ({selectedProvider === "gemini" ? "Google Gemini" : selectedProvider === "anthropic" ? "Anthropic Claude" : "OpenAI"})
            </label>
            {selectedProvider === "gemini" && (
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-emerald-700 hover:underline inline-flex items-center gap-0.5 font-bold"
              >
                <span>Obtener Key Gratis en Google AI Studio</span>
                <ExternalLink size={11} />
              </a>
            )}
            {selectedProvider === "anthropic" && (
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-amber-700 hover:underline inline-flex items-center gap-0.5 font-bold"
              >
                <span>Consola Anthropic</span>
                <ExternalLink size={11} />
              </a>
            )}
            {selectedProvider === "openai" && (
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-indigo-700 hover:underline inline-flex items-center gap-0.5 font-bold"
              >
                <span>Plataforma OpenAI</span>
                <ExternalLink size={11} />
              </a>
            )}
          </div>

          {selectedProvider === "gemini" && (
            <input
              type="password"
              value={geminiKeyInput}
              onChange={(e) => setGeminiKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3.5 py-2.5 border border-emerald-300 rounded-xl bg-white font-mono text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none"
            />
          )}

          {selectedProvider === "anthropic" && (
            <input
              type="password"
              value={claudeKeyInput}
              onChange={(e) => setClaudeKeyInput(e.target.value)}
              placeholder="sk-ant-api03-..."
              className="w-full px-3.5 py-2.5 border border-amber-300 rounded-xl bg-white font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
          )}

          {selectedProvider === "openai" && (
            <input
              type="password"
              value={openAiKeyInput}
              onChange={(e) => setOpenAiKeyInput(e.target.value)}
              placeholder="sk-proj-..."
              className="w-full px-3.5 py-2.5 border border-indigo-300 rounded-xl bg-white font-mono text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-lilac-100">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-6 py-2.5 rounded-xl transition font-semibold text-xs shadow-md shadow-lilac-200"
          >
            <Save size={15} />
            <span>{isSaving ? "Guardando..." : "Guardar Configuración Global de IA"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
