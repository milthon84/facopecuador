"use client";

import { useState, useMemo, useEffect } from "react";
import { ecuadorDateTimeLabel } from "@/lib/ecuador-time";
import Link from "next/link";
import {
  Bot,
  Sparkles,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HeartHandshake,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldCheck,
  Settings,
  FileText,
  RotateCcw,
  X,
  Info,
  Save,
  Check,
  ExternalLink,
} from "lucide-react";

export interface ThreadMessage {
  id: string;
  created_at: string;
  time_label: string;
  sender: "ASESOR" | "PACIENTE/CLIENTE";
  is_asesor: boolean;
  content: string;
  tipo_mensaje: string | null;
}

export interface ChatItem {
  id: string;
  patient_name: string;
  phone: string;
  agent_name: string;
  channel: string;
  chat_date: string;
  started_at: string;
  ended_at?: string;
  messages_count?: number;
  transcript: string;
  messages?: ThreadMessage[];
  created_at: string;
}

interface JobProgress {
  batches_done: number;
  batches_total: number;
  total_chats: number;
}

export interface IndividualChatEval {
  numero_caso: number;
  id_chat: string;
  paciente: string;
  telefono: string;
  status: "excelente" | "regular" | "critico";
  score: number;
  cordialidad: string;
  tiempo_respuesta: string;
  rechazo_fin_semana: boolean;
  resultado_agendamiento: string;
  resumen_caso: string;
  observaciones: string;
  fecha_hora?: string | null;
  hilo?: string | null;
}

export interface AuditResult {
  overall_score: number;
  cordiality_score: number;
  speed_score: number;
  resolution_score: number;
  rejected_leads_count: number;
  slow_response_count: number;
  executive_summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  chat_evaluations: IndividualChatEval[];
}

export interface SavedAudit {
  id: string;
  period_label: string;
  period_type: string;
  start_date: string;
  end_date: string;
  total_chats_analyzed: number;
  overall_score: number;
  cordiality_score: number;
  speed_score: number;
  rejected_leads_count: number;
  executive_summary: string;
  created_at: string;
}

// Normaliza valores de la IA (acentos, mayúsculas, "sí"/"true")
const normText = (v: unknown) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const isCriticalEval = (c: IndividualChatEval) => normText(c.status).includes("critic");
const isRechazoEval = (c: IndividualChatEval) => ["true", "si", "1"].includes(normText(c.rechazo_fin_semana));

// Convierte la transcripción "[YYYY-MM-DD HH:mm] [ASESOR|PACIENTE/CLIENTE]: texto" en burbujas
function parseTranscript(transcript: string): ThreadMessage[] {
  const out: ThreadMessage[] = [];
  const re = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] \[(ASESOR|PACIENTE\/CLIENTE)\]: ?(.*)$/;
  for (const line of transcript.split("\n")) {
    const m = line.match(re);
    if (m) {
      out.push({
        id: String(out.length),
        created_at: "",
        time_label: m[1],
        sender: m[2] as ThreadMessage["sender"],
        is_asesor: m[2] === "ASESOR",
        content: m[3],
        tipo_mensaje: null,
      });
    } else if (out.length > 0 && line.trim()) {
      out[out.length - 1].content += `\n${line}`;
    }
  }
  return out;
}

interface Props {
  initialChats: ChatItem[];
  initialAudits: SavedAudit[];
}

type PeriodMode = "semanal" | "quincenal" | "mensual" | "custom";

export default function AuditoriaAtencionClient({ initialChats, initialAudits }: Props) {
  const [activeTab, setActiveTab] = useState<"auditoria" | "historial" | "chats">("chats");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("mensual");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [chats, setChats] = useState<ChatItem[]>(initialChats);
  const [audits, setAudits] = useState<SavedAudit[]>(initialAudits);
  const [currentAudit, setCurrentAudit] = useState<AuditResult | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("criticos");
  const [expandedChatId, setExpandedChatId] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null);
  const [showAllEvals, setShowAllEvals] = useState(false);

  // Estado del motor de IA activo
  const [activeAiConfig, setActiveAiConfig] = useState<{ provider: string; model: string } | null>(null);

  useEffect(() => {
    fetchActiveAiConfig();
  }, []);

  const fetchActiveAiConfig = async () => {
    try {
      const res = await fetch("/api/admin/auditoria-atencion/config");
      const data = await res.json();
      if (data.success) {
        setActiveAiConfig({
          provider: data.provider || "gemini",
          model: data.model || "gemini-1.5-flash",
        });
        if (data.prompt) setPromptInput(data.prompt);
        if (data.defaultPrompt) setDefaultPrompt(data.defaultPrompt);
      }
    } catch {}
  };

  // Modal de configuración del Prompt
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [promptFeedback, setPromptFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchPromptConfig = async () => {
    setIsLoadingPrompt(true);
    try {
      const res = await fetch("/api/admin/auditoria-atencion/config");
      const data = await res.json();
      if (data.success) {
        setPromptInput(data.prompt || "");
        setDefaultPrompt(data.defaultPrompt || "");
        setActiveAiConfig({
          provider: data.provider || "gemini",
          model: data.model || "gemini-1.5-flash",
        });
      }
    } catch (e) {
      console.error("Error al cargar prompt:", e);
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  const handleOpenPromptModal = () => {
    setIsPromptModalOpen(true);
    setPromptFeedback(null);
    fetchPromptConfig();
  };

  const handleResetPrompt = () => {
    if (defaultPrompt) {
      setPromptInput(defaultPrompt);
      setPromptFeedback({ type: "success", text: "Prompt restaurado al valor predeterminado de FACOP. Haz clic en 'Guardar Cambios' para confirmar." });
    }
  };

  const handleSavePrompt = async () => {
    setIsSavingPrompt(true);
    setPromptFeedback(null);
    try {
      const res = await fetch("/api/admin/auditoria-atencion/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar el prompt");
      setPromptFeedback({ type: "success", text: "Prompt de auditoría guardado exitosamente." });
      setTimeout(() => {
        setIsPromptModalOpen(false);
        setPromptFeedback(null);
      }, 1400);
    } catch (err: any) {
      setPromptFeedback({ type: "error", text: err.message || "Error al guardar el prompt" });
    } finally {
      setIsSavingPrompt(false);
    }
  };

  // Calcular fechas del período actual
  const periodDates = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (periodMode === "semanal") {
      const cur = new Date(now);
      const day = cur.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(cur.setDate(cur.getDate() + diff));
      const sun = new Date(cur.setDate(mon.getDate() + 6));
      return {
        start: mon.toISOString().slice(0, 10),
        end: sun.toISOString().slice(0, 10),
        label: `Semana del ${mon.getDate()} al ${sun.getDate()} de ${sun.toLocaleDateString("es-EC", { month: "short" })}`,
      };
    }

    if (periodMode === "quincenal") {
      const isSecondHalf = now.getDate() > 15;
      const startDay = isSecondHalf ? 16 : 1;
      const endDay = isSecondHalf ? new Date(currentYear, currentMonth + 1, 0).getDate() : 15;
      const monthName = now.toLocaleDateString("es-EC", { month: "long" });
      return {
        start: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`,
        end: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
        label: `${isSecondHalf ? "2da" : "1ra"} Quincena de ${monthName} ${currentYear}`,
      };
    }

    if (periodMode === "mensual") {
      const monthName = now.toLocaleDateString("es-EC", { month: "long", year: "numeric" });
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      return {
        start: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`,
        end: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
        label: `Mes de ${monthName}`,
      };
    }

    return {
      start: customStart || now.toISOString().slice(0, 10),
      end: customEnd || now.toISOString().slice(0, 10),
      label: `${customStart || "Inicio"} al ${customEnd || "Fin"}`,
    };
  }, [periodMode, customStart, customEnd]);

  // Chats del período, ordenados de forma descendente por último mensaje
  const periodChats = useMemo(() => {
    return chats
      .filter((c) => {
        const d = c.chat_date || (c.started_at ? c.started_at.slice(0, 10) : "");
        return d >= periodDates.start && d <= periodDates.end;
      })
      .sort(
        (a, b) =>
          new Date(b.ended_at || b.started_at || b.created_at).getTime() -
          new Date(a.ended_at || a.started_at || a.created_at).getTime()
      );
  }, [chats, periodDates]);

  // Ejecutar auditoría con IA: crea el job del periodo y procesa los lotes en secuencia
  const handleRunAudit = async () => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    setCurrentAudit(null);
    setJobProgress(null);

    try {
      const createRes = await fetch("/api/admin/auditoria-atencion/analizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodType: periodMode,
          periodLabel: periodDates.label,
          startDate: periodDates.start,
          endDate: periodDates.end,
        }),
      });
      const created = await createRes.json().catch(() => null);
      if (!createRes.ok || !created?.job) {
        throw new Error(created?.error || `Error ${createRes.status} al iniciar la auditoría con IA.`);
      }

      let job = created.job;
      setJobProgress({ batches_done: job.batches_done, batches_total: job.batches_total, total_chats: job.total_chats });

      let guard = 0;
      while (job.status !== "completado" && guard < 500) {
        guard++;
        const res = await fetch(`/api/admin/auditoria-atencion/jobs/${job.id}`, { method: "POST" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.job) {
          throw new Error(data?.error || `Error ${res.status} al procesar un lote de la auditoría.`);
        }
        job = data.job;
        setJobProgress({ batches_done: job.batches_done, batches_total: job.batches_total, total_chats: job.total_chats });
      }

      if (!job.audit_id) {
        throw new Error("La auditoría terminó sin generar un resultado consolidado.");
      }

      // Cargar el resultado guardado y refrescar historial
      const histRes = await fetch("/api/admin/auditoria-atencion/historial");
      const histData = await histRes.json().catch(() => ({ audits: [] }));
      const audits: SavedAudit[] = histData.audits || [];
      setAudits(audits);
      const saved = audits.find((a) => a.id === job.audit_id);
      if (saved) setCurrentAudit(saved as unknown as AuditResult);
      setActiveTab("auditoria");
    } catch (err: any) {
      setErrorMsg(err.message || "Error al conectar con la Inteligencia Artificial.");
    } finally {
      setIsAnalyzing(false);
      setJobProgress(null);
    }
  };

  const [isRefreshingChats, setIsRefreshingChats] = useState(false);

  const fetchChats = async (start: string, end: string) => {
    setIsRefreshingChats(true);
    try {
      const res = await fetch(`/api/admin/auditoria-atencion/chats?start=${start}&end=${end}`);
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.chats) {
          setChats(data.chats);
        }
      }
    } catch (err) {
      console.error("Error al refrescar chats:", err);
    } finally {
      setIsRefreshingChats(false);
    }
  };

  // Recargar chats cada vez que cambia el periodo (rango completo en hora Ecuador)
  useEffect(() => {
    if (periodDates.start && periodDates.end) {
      fetchChats(periodDates.start, periodDates.end);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodDates.start, periodDates.end]);

  const fetchHistorial = async () => {
    try {
      const res = await fetch("/api/admin/auditoria-atencion/historial");
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.audits) {
          setAudits(data.audits);
        }
      }
    } catch {}
  };

  // Casos del filtro activo (por defecto: críticos y rechazos)
  const evalsByFilter = useMemo(() => {
    if (!currentAudit) return [];
    const all = currentAudit.chat_evaluations || [];
    if (filterSeverity === "rechazo") return all.filter(isRechazoEval);
    if (filterSeverity === "critico") return all.filter(isCriticalEval);
    return all.filter((c) => isCriticalEval(c) || isRechazoEval(c));
  }, [currentAudit, filterSeverity]);

  // Más relevantes primero (rechazos, luego menor score) y máximo 10 salvo que se pida ver todos
  const filteredEvals = useMemo(() => {
    const sorted = [...evalsByFilter].sort(
      (a, b) => Number(isRechazoEval(b)) - Number(isRechazoEval(a)) || Number(a.score) - Number(b.score)
    );
    return showAllEvals ? sorted : sorted.slice(0, 10);
  }, [evalsByFilter, showAllEvals]);

  // Abre el hilo: usa el guardado en el caso; si no existe, lo busca en Supabase por id dentro del periodo auditado
  const openEvalThread = async (item: IndividualChatEval) => {
    if (item.hilo) {
      setSelectedChat({
        id: item.id_chat,
        patient_name: item.paciente,
        phone: item.telefono,
        agent_name: "Recepción / Asesor FACOP",
        channel: "whatsapp",
        chat_date: "",
        started_at: item.fecha_hora || "",
        transcript: item.hilo,
        created_at: "",
        messages: parseTranscript(item.hilo),
      });
      return;
    }

    const audit = currentAudit as (AuditResult & { start_date?: string; end_date?: string }) | null;
    if (!audit?.start_date || !audit?.end_date) {
      setErrorMsg("Esta auditoría no tiene periodo registrado para cargar el hilo.");
      return;
    }
    try {
      const start = String(audit.start_date).slice(0, 10);
      const end = String(audit.end_date).slice(0, 10);
      const res = await fetch(`/api/admin/auditoria-atencion/chats?start=${start}&end=${end}`);
      const data = await res.json();
      const found = (data.chats || []).find((c: ChatItem) => c.id === item.id_chat);
      if (found) {
        setSelectedChat(found as ChatItem);
      } else {
        setErrorMsg("No se encontró la conversación de este caso en el periodo auditado.");
      }
    } catch {
      setErrorMsg("No se pudo cargar el hilo de la conversación.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-12">
      {/* Header Principal */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-lilac-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center font-bold">
              <Bot size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-ink-950 tracking-tight flex items-center gap-2">
                Auditoría de Atención al Cliente
              </h1>
              <p className="text-xs text-ink-500 font-medium">
                Supervisión inteligente de chats de WhatsApp: cordialidad, agilidad y detección de rechazos de pacientes.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones de Cabecera */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeAiConfig && (
            <Link
              href="/erp/configuracion-sistema#ia-config"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs bg-slate-900 text-white hover:bg-slate-800 transition border border-slate-700/60 shadow-xs group"
              title="Haz clic para ver o cambiar el motor de IA en Configuración del Sistema"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-[11px] text-slate-300">Motor IA:</span>
              <span className="font-bold text-emerald-300">
                {activeAiConfig.provider === "gemini"
                  ? "Google Gemini"
                  : activeAiConfig.provider === "anthropic"
                  ? "Anthropic Claude"
                  : "OpenAI ChatGPT"}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white font-semibold border border-white/10">
                {activeAiConfig.model}
              </span>
              <Settings size={12} className="text-slate-400 group-hover:text-white transition" />
            </Link>
          )}

          <button
            type="button"
            onClick={handleOpenPromptModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-ink-700 bg-lilac-50 hover:bg-lilac-100 border border-lilac-200 transition shadow-xs"
            title="Personalizar las instrucciones y criterios del Prompt de IA para esta pantalla"
          >
            <FileText size={14} className="text-lilac-600" />
            <span>Configurar Prompt IA</span>
          </button>

          <button
            type="button"
            disabled={isAnalyzing}
            onClick={handleRunAudit}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition shadow-sm ${
              isAnalyzing
                ? "bg-lilac-400 cursor-not-allowed"
                : "bg-gradient-to-r from-lilac-600 to-indigo-600 hover:from-lilac-700 hover:to-indigo-700 hover:shadow"
            }`}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Auditando con IA...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Ejecutar Auditoría con IA</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Selector de Período y Pestañas */}
      <div className="bg-white px-3 py-2 sm:py-2.5 rounded-2xl border border-lilac-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        {/* Pestañas */}
        <div className="flex items-center gap-1 p-0.5 bg-lilac-50/80 rounded-xl border border-lilac-100">
          <button
            type="button"
            onClick={() => setActiveTab("chats")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              activeTab === "chats"
                ? "bg-lilac-600 text-white shadow-xs"
                : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
            }`}
          >
            Chats Disponibles ({periodChats.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("historial")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              activeTab === "historial"
                ? "bg-lilac-600 text-white shadow-xs"
                : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
            }`}
          >
            Historial ({audits.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("auditoria")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              activeTab === "auditoria"
                ? "bg-lilac-600 text-white shadow-xs"
                : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
            }`}
          >
            Resultados Auditoría
          </button>
        </div>

        {/* Filtro Período */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1 bg-lilac-50/80 p-0.5 rounded-xl border border-lilac-100">
            {(["semanal", "quincenal", "mensual", "custom"] as const).map((m) => {
              const labels = {
                semanal: "Semanal",
                quincenal: "Quincenal",
                mensual: "Mensual",
                custom: "Personalizado",
              };
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPeriodMode(m)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${
                    periodMode === m
                      ? "bg-white text-ink-900 shadow-xs border border-lilac-200"
                      : "text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {labels[m]}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 font-bold text-ink-700 bg-white border border-lilac-200 px-2 py-1 rounded-xl text-xs shadow-xs">
            <Calendar size={13} className="text-lilac-600" />
            <span>{periodDates.label}</span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-xs text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <Link
            href="/erp/configuracion-sistema"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition shrink-0 shadow-xs"
          >
            <Settings size={13} />
            <span>Ir a Configuración de IA</span>
          </Link>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑAS */}

      {/* PESTAÑA 1: RESULTADOS AUDITORÍA */}
      {activeTab === "auditoria" && (
        <div className="space-y-4">
          {isAnalyzing && jobProgress && (
            <div className="bg-white p-6 rounded-2xl border border-lilac-100 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-ink-900">
                <RefreshCw size={16} className="animate-spin text-lilac-600" />
                <span>Auditoría con IA en progreso</span>
              </div>
              <p className="text-xs text-ink-500">
                Lote {jobProgress.batches_done} de {jobProgress.batches_total} · {jobProgress.total_chats} chats del periodo
              </p>
              <div className="w-full h-2 bg-lilac-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-lilac-600 to-indigo-600 transition-all"
                  style={{ width: `${Math.round((jobProgress.batches_done / Math.max(jobProgress.batches_total, 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {!currentAudit && !isAnalyzing && (
            <div className="bg-white p-8 rounded-2xl border border-lilac-100 shadow-xs text-center space-y-3">
              <div className="w-12 h-12 bg-lilac-50 text-lilac-600 rounded-full flex items-center justify-center mx-auto">
                <Sparkles size={24} />
              </div>
              <h2 className="text-base font-bold text-ink-900">
                Aún no has ejecutado una auditoría para este período
              </h2>
              <p className="text-xs text-ink-500 max-w-md mx-auto">
                La Inteligencia Artificial evaluará los chats de WhatsApp registrados del {periodDates.label} para
                analizar cordialidad, tiempos de respuesta y oportunidades perdidas.
              </p>
            </div>
          )}

          {currentAudit && (
            <>
              {/* 4 KPIs Clave de Calidad */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {/* Score Global */}
                <div className="bg-white p-3 rounded-2xl border border-lilac-100 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">
                      Calidad Global
                    </div>
                    <div className="text-2xl font-black text-ink-950 mt-0.5">
                      {currentAudit.overall_score}
                      <span className="text-xs font-bold text-ink-400">/100</span>
                    </div>
                    <div className="text-[10px] font-bold mt-0.5">
                      {currentAudit.overall_score >= 80 ? (
                        <span className="text-emerald-600">Excelente atención</span>
                      ) : currentAudit.overall_score >= 65 ? (
                        <span className="text-amber-600">Aceptable (con alertas)</span>
                      ) : (
                        <span className="text-rose-600">Atención Crítica</span>
                      )}
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center font-bold">
                    <ShieldCheck size={18} />
                  </div>
                </div>

                {/* Cordialidad */}
                <div className="bg-white p-3 rounded-2xl border border-lilac-100 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">
                      Cordialidad / Tono
                    </div>
                    <div className="text-2xl font-black text-emerald-700 mt-0.5">
                      {currentAudit.cordiality_score}
                      <span className="text-xs font-bold text-ink-400">/10</span>
                    </div>
                    <div className="text-[10px] text-ink-500 font-medium">Empatía y amabilidad</div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                    <HeartHandshake size={18} />
                  </div>
                </div>

                {/* Velocidad */}
                <div className="bg-white p-3 rounded-2xl border border-lilac-100 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">
                      Velocidad Respuesta
                    </div>
                    <div className="text-2xl font-black text-indigo-700 mt-0.5">
                      {currentAudit.speed_score}
                      <span className="text-xs font-bold text-ink-400">/10</span>
                    </div>
                    <div className="text-[10px] text-amber-700 font-semibold">
                      {currentAudit.slow_response_count} chat(s) con demora
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                    <Clock size={18} />
                  </div>
                </div>

                {/* Oportunidades Perdidas / Rechazos */}
                <div className="bg-white p-3 rounded-2xl border border-lilac-100 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">
                      Rechazos / Leads Perdidos
                    </div>
                    <div className={`text-2xl font-black mt-0.5 ${currentAudit.rejected_leads_count > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                      {currentAudit.rejected_leads_count}
                    </div>
                    <div className="text-[10px] text-rose-700 font-semibold">
                      {currentAudit.rejected_leads_count > 0 ? "Fines de semana / Fuera horario" : "Sin rechazos detectados"}
                    </div>
                  </div>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${currentAudit.rejected_leads_count > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                    <TrendingDown size={18} />
                  </div>
                </div>
              </div>

              {/* Resumen Ejecutivo IA */}
              <div className="bg-gradient-to-br from-lilac-50/60 to-indigo-50/60 p-4 rounded-2xl border border-lilac-200/80 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-lilac-900 uppercase tracking-wider">
                  <Sparkles size={14} className="text-lilac-600" />
                  <span>Diagnóstico Ejecutivo de la IA</span>
                </div>
                <p className="text-xs text-ink-800 leading-relaxed font-medium">
                  {currentAudit.executive_summary}
                </p>
              </div>

              {/* Fortalezas vs Debilidades vs Recomendaciones */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Fortalezas */}
                <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 uppercase tracking-wider">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>Fortalezas Detectadas</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-ink-700">
                    {currentAudit.strengths.map((s, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Puntos Críticos */}
                <div className="bg-white p-3.5 rounded-2xl border border-amber-100 shadow-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider">
                    <AlertTriangle size={14} className="text-amber-600" />
                    <span>Puntos Críticos a Corregir</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-ink-700">
                    {currentAudit.weaknesses.map((w, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recomendaciones Accionables */}
                <div className="bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 uppercase tracking-wider">
                    <Bot size={14} className="text-indigo-600" />
                    <span>Recomendaciones para el Equipo</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-ink-700">
                    {currentAudit.recommendations.map((r, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-indigo-600 font-bold">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Desglose Detallado Chat por Chat */}
              <div className="bg-white p-4 rounded-2xl border border-lilac-100 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-lilac-50 pb-2">
                  <div>
                    <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider">
                      Casos prioritarios ({evalsByFilter.length})
                    </h3>
                    <p className="text-[11px] text-ink-400">
                      Casos prioritarios. Usa &quot;Ver hilo&quot; para leer la conversación completa.
                    </p>
                  </div>

                  {/* Filtro por Semáforo */}
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterSeverity("criticos")}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${
                        filterSeverity === "criticos" ? "bg-lilac-600 text-white" : "text-ink-600 hover:bg-lilac-50"
                      }`}
                    >
                      Críticos y rechazos
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterSeverity("rechazo")}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${
                        filterSeverity === "rechazo" ? "bg-rose-600 text-white" : "text-rose-700 hover:bg-rose-50"
                      }`}
                    >
                      Rechazos ({currentAudit.chat_evaluations.filter(isRechazoEval).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterSeverity("critico")}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${
                        filterSeverity === "critico" ? "bg-amber-600 text-white" : "text-amber-700 hover:bg-amber-50"
                      }`}
                    >
                      Críticos
                    </button>
                  </div>
                </div>

                {evalsByFilter.length > 10 && (
                  <button
                    type="button"
                    onClick={() => setShowAllEvals((v) => !v)}
                    className="text-[11px] font-bold text-lilac-700 hover:text-lilac-900 self-start"
                  >
                    {showAllEvals ? "Mostrar solo los 10 más prioritarios" : `Mostrar todos (${evalsByFilter.length})`}
                  </button>
                )}

                {/* Lista de Chats Evaluados */}
                <div className="divide-y divide-lilac-50">
                  {filteredEvals.map((item, idx) => {
                    const isExpanded = expandedChatId === item.id_chat;
                    const isCrit = isCriticalEval(item) || isRechazoEval(item);
                    const isReg = normText(item.status).includes("regular");

                    return (
                      <div key={item.id_chat || idx} className="py-2.5">
                        <div
                          onClick={() => setExpandedChatId(isExpanded ? null : item.id_chat)}
                          className="flex items-center justify-between gap-3 cursor-pointer hover:bg-lilac-50/40 p-2 rounded-xl transition"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                isCrit ? "bg-rose-500 ring-4 ring-rose-100" : isReg ? "bg-amber-500 ring-4 ring-amber-100" : "bg-emerald-500 ring-4 ring-emerald-100"
                              }`}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-ink-900">
                                  {item.paciente} ({item.telefono})
                                </span>
                                {item.rechazo_fin_semana && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                    RECHAZÓ ATENCIÓN
                                  </span>
                                )}
                                <span className="text-[10px] text-ink-400">
                                  Score: <b>{item.score}/10</b>
                                </span>
                              </div>
                              <p className="text-[11px] text-ink-600 line-clamp-1 mt-0.5 font-medium">
                                {item.resumen_caso}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-semibold text-ink-500 hidden sm:inline">
                              {item.resultado_agendamiento}
                            </span>
                            {(
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEvalThread(item);
                                }}
                                className="text-[11px] font-bold text-lilac-700 hover:text-lilac-900 bg-lilac-50 hover:bg-lilac-100 px-2 py-0.5 rounded-lg border border-lilac-200 transition"
                              >
                                Ver hilo
                              </button>
                            )}
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-2 pl-6 pr-2 py-2 bg-lilac-50/30 rounded-xl space-y-2 border border-lilac-100/70 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                              <div>
                                <span className="font-bold text-ink-500">Cordialidad:</span>{" "}
                                <span className="font-medium text-ink-900">{item.cordialidad}</span>
                              </div>
                              <div>
                                <span className="font-bold text-ink-500">Tiempo de Respuesta:</span>{" "}
                                <span className="font-medium text-ink-900">{item.tiempo_respuesta}</span>
                              </div>
                              <div>
                                <span className="font-bold text-ink-500">Resultado:</span>{" "}
                                <span className="font-medium text-ink-900">{item.resultado_agendamiento}</span>
                              </div>
                            </div>

                            <div className="bg-white p-2.5 rounded-lg border border-lilac-100">
                              <span className="font-bold text-lilac-900 block text-[11px]">Observaciones del Auditor IA:</span>
                              <p className="text-ink-700 text-xs mt-0.5">{item.observaciones}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* PESTAÑA 2: HISTORIAL */}
      {activeTab === "historial" && (
        <div className="bg-white p-4 rounded-2xl border border-lilac-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-lilac-50 pb-2">
            <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider">
              Historial de Auditorías Realizadas ({audits.length})
            </h3>
            <button
              type="button"
              onClick={fetchHistorial}
              className="text-xs text-lilac-600 hover:text-lilac-800 font-semibold inline-flex items-center gap-1"
            >
              <RefreshCw size={12} /> Refrescar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-lilac-100 text-ink-400 font-bold uppercase text-[10px]">
                  <th className="pb-1.5">Período Auditado</th>
                  <th className="pb-1.5 text-center">Tipo</th>
                  <th className="pb-1.5 text-center">Chats</th>
                  <th className="pb-1.5 text-center">Score Global</th>
                  <th className="pb-1.5 text-center">Cordialidad</th>
                  <th className="pb-1.5 text-center">Rechazos</th>
                  <th className="pb-1.5 text-right">Fecha Ejecución</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50/70">
                {audits.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => {
                      setCurrentAudit(a as unknown as AuditResult);
                      setActiveTab("auditoria");
                    }}
                    className="hover:bg-lilac-50/30 transition cursor-pointer"
                    title="Haz clic para ver el detalle de esta auditoría"
                  >
                    <td className="py-2 font-bold text-ink-900">{a.period_label}</td>
                    <td className="py-2 text-center capitalize text-ink-600">{a.period_type}</td>
                    <td className="py-2 text-center font-bold text-ink-700">{a.total_chats_analyzed}</td>
                    <td className="py-2 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-black text-[11px] ${
                          Number(a.overall_score) >= 80
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {a.overall_score}/100
                      </span>
                    </td>
                    <td className="py-2 text-center font-semibold text-emerald-700">{a.cordiality_score}/10</td>
                    <td className="py-2 text-center font-bold text-rose-700">{a.rejected_leads_count}</td>
                    <td className="py-2 text-right text-ink-400 text-[11px]">
                      {new Date(a.created_at).toLocaleDateString("es-EC")}
                    </td>
                  </tr>
                ))}

                {audits.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-xs text-ink-400 italic">
                      No hay auditorías guardadas en el historial.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: GESTIÓN DE CHATS */}
      {activeTab === "chats" && (
        <div className="space-y-4">
          {/* Tabla de Chats Disponibles */}
          <div className="bg-white p-4 rounded-2xl border border-lilac-100 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-lilac-50 pb-2">
              <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider">
                Conversaciones ({periodChats.length})
              </h3>
              <button
                type="button"
                disabled={isRefreshingChats}
                onClick={() => fetchChats(periodDates.start, periodDates.end)}
                className="text-xs text-lilac-600 hover:text-lilac-800 font-bold inline-flex items-center gap-1 bg-lilac-50 hover:bg-lilac-100 px-3 py-1.5 rounded-xl transition"
              >
                <RefreshCw size={13} className={isRefreshingChats ? "animate-spin" : ""} />
                <span>{isRefreshingChats ? "Sincronizando..." : "Sincronizar de Supabase"}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-lilac-100 text-ink-400 font-bold uppercase text-[10px]">
                    <th className="pb-1.5">Paciente / Teléfono</th>
                    <th className="pb-1.5">Fecha y hora (Ecuador)</th>
                    <th className="pb-1.5">Último mensaje</th>
                    <th className="pb-1.5 text-right">Mensajes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lilac-50/70">
                  {periodChats.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedChat(c)}
                      className="hover:bg-lilac-50/40 transition cursor-pointer"
                      title="Haz clic para ver el hilo completo de la conversación"
                    >
                      <td className="py-2">
                        <div className="font-bold text-ink-900">{c.patient_name}</div>
                        <div className="text-[10px] text-ink-400">{c.phone}</div>
                      </td>
                      <td className="py-2.5 text-ink-700 font-mono text-[11px] whitespace-nowrap">
                        {ecuadorDateTimeLabel(c.ended_at || c.started_at || c.created_at)}
                      </td>
                      <td className="py-2.5 text-ink-600 max-w-xs truncate">
                        {(c.messages?.[c.messages.length - 1]?.content ?? (c.transcript || "").split("\n").pop() ?? "").slice(0, 120)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-ink-600">
                        {c.messages_count ?? c.messages?.length ?? "-"}
                      </td>
                    </tr>
                  ))}

                  {periodChats.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-ink-400 italic">
                        No hay chats registrados en este período ({periodDates.label}). Los mensajes de WhatsApp se sincronizan automáticamente desde la base de datos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: hilo completo de la conversación */}
      {selectedChat && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setSelectedChat(null)}
        >
          <div
            className="bg-white rounded-2xl border border-lilac-100 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-lilac-100 flex items-start justify-between gap-3 bg-lilac-50/40">
              <div>
                <h3 className="font-bold text-sm text-ink-900">
                  {selectedChat.patient_name} <span className="text-ink-400 font-normal">({selectedChat.phone})</span>
                </h3>
                <p className="text-[11px] text-ink-500">
                  {selectedChat.messages?.length ?? selectedChat.messages_count ?? 0} mensajes · Inicio{" "}
                  {ecuadorDateTimeLabel(selectedChat.started_at)} · Último{" "}
                  {ecuadorDateTimeLabel(selectedChat.ended_at || selectedChat.started_at)} (hora Ecuador)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedChat(null)}
                className="w-8 h-8 shrink-0 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-lilac-100 flex items-center justify-center transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 bg-ink-50/40 flex-1">
              {selectedChat.messages && selectedChat.messages.length > 0 ? (
                selectedChat.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.is_asesor ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs shadow-xs border ${
                        m.is_asesor
                          ? "bg-lilac-600 text-white border-lilac-700 rounded-br-sm"
                          : "bg-white text-ink-800 border-lilac-100 rounded-bl-sm"
                      }`}
                    >
                      <div className={`text-[10px] font-bold mb-0.5 ${m.is_asesor ? "text-lilac-100" : "text-ink-400"}`}>
                        {m.is_asesor ? "Asesor" : "Paciente"} · {m.time_label || ecuadorDateTimeLabel(m.created_at)}
                      </div>
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    </div>
                  </div>
                ))
              ) : (
                <pre className="text-[11px] font-mono whitespace-pre-wrap text-ink-700">{selectedChat.transcript}</pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuración del Prompt de IA */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-lilac-100 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Cabecera del Modal */}
            <div className="p-4 sm:p-5 border-b border-lilac-100 flex items-center justify-between bg-lilac-50/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center font-bold">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-ink-900 flex items-center gap-2">
                    <span>Configuración del Prompt de Auditoría con IA</span>
                  </h3>
                  <p className="text-[11px] text-ink-500">
                    Instrucciones y rúbrica que recibe la IA para evaluar las conversaciones de WhatsApp.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPromptModalOpen(false)}
                className="w-8 h-8 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-lilac-100 flex items-center justify-center transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs flex-1">
              {/* Indicador de motor actual */}
              <div className="flex items-center justify-between p-3 bg-lilac-50/80 border border-lilac-200 rounded-xl text-xs flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-ink-600 font-medium">Motor de IA activo:</span>
                  <strong className="text-ink-950 font-black">
                    {activeAiConfig?.provider === "gemini"
                      ? "Google Gemini"
                      : activeAiConfig?.provider === "anthropic"
                      ? "Anthropic Claude"
                      : "OpenAI ChatGPT"}
                  </strong>
                  <span className="font-mono text-[10px] bg-white border border-lilac-200 px-2 py-0.5 rounded text-lilac-700 font-bold">
                    {activeAiConfig?.model || "gemini-1.5-flash"}
                  </span>
                </div>
                <Link
                  href="/erp/configuracion-sistema#ia-config"
                  className="text-xs text-lilac-700 hover:text-lilac-900 font-bold hover:underline inline-flex items-center gap-1"
                >
                  <span>Cambiar en Configuración</span>
                  <ExternalLink size={12} />
                </Link>
              </div>

              {promptFeedback && (
                <div
                  className={`p-3 rounded-xl flex items-center gap-2 text-xs ${
                    promptFeedback.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {promptFeedback.type === "success" ? (
                    <Check size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                  )}
                  <span>{promptFeedback.text}</span>
                </div>
              )}

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2 text-[11px] text-amber-900">
                <Info size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Consejo para personalizar las reglas:</p>
                  <p className="text-amber-800">
                    Puedes agregar directrices específicas como <i>&quot;Evaluar si la recepcionista ofrece las promociones vigentes de Ortodoncia&quot;</i> o <i>&quot;Verificar si solicita el nombre y apellido al paciente al inicio&quot;</i>.
                  </p>
                  <p className="text-amber-900 font-medium">
                    ⚠️ <b>Importante:</b> Conserva siempre la estructura de respuesta JSON requerida para que las métricas, tarjetas y tablas del panel se calculen con precisión.
                  </p>
                </div>
              </div>

              {isLoadingPrompt ? (
                <div className="py-12 text-center text-xs text-ink-400 flex items-center justify-center gap-2">
                  <RefreshCw size={15} className="animate-spin text-lilac-600" />
                  <span>Cargando instrucciones actuales...</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-ink-600 uppercase tracking-wider">
                      Editor de Instrucciones del Sistema (Prompt)
                    </label>
                    <span className="text-[10px] text-ink-400 font-mono">
                      {promptInput.length} caracteres
                    </span>
                  </div>
                  <textarea
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    rows={13}
                    placeholder="Escribe las instrucciones detalladas para la IA..."
                    className="w-full px-3.5 py-2.5 border border-lilac-300 rounded-xl bg-ink-950 text-emerald-300 font-mono text-[11px] leading-relaxed focus:ring-2 focus:ring-lilac-400 focus:outline-none shadow-inner"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>

            {/* Pie del Modal */}
            <div className="p-4 sm:p-5 border-t border-lilac-100 bg-lilac-50/20 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div>
                {defaultPrompt && (
                  <button
                    type="button"
                    onClick={handleResetPrompt}
                    disabled={isSavingPrompt || isLoadingPrompt}
                    className="text-xs text-ink-600 hover:text-lilac-700 inline-flex items-center gap-1.5 font-medium transition px-3 py-1.5 rounded-lg border border-lilac-200 bg-white hover:bg-lilac-50"
                    title="Restaura la rúbrica y esquema JSON oficial de FACOP"
                  >
                    <RotateCcw size={13} />
                    <span>Restablecer Original</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsPromptModalOpen(false)}
                  disabled={isSavingPrompt}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-600 hover:bg-ink-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSavePrompt}
                  disabled={isSavingPrompt || isLoadingPrompt}
                  className="flex items-center gap-1.5 bg-lilac-600 hover:bg-lilac-700 text-white px-5 py-2 rounded-xl transition font-bold text-xs shadow-md shadow-lilac-200"
                >
                  {isSavingPrompt ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Guardar Cambios</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

