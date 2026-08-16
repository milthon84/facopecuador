"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  MessageSquare,
  DollarSign,
  Trophy,
  AlertTriangle,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Settings,
  RefreshCw,
  ExternalLink,
  Info,
  Sliders,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Sparkles,
  Bot,
} from "lucide-react";

// Estructura de datos por campaña
export interface CampaignRow {
  a: string; // Nombre del anuncio / campaña
  b: number; // Presupuesto diario / acumulado en $
  c: {
    dir: "up" | "down" | "flat";
    abs: string; // Ejemplo "$15.00"
    pct: string; // Ejemplo "+25%"
  };
  ct: number; // Número de contactos / leads
  cc: number; // Costo por contacto en $
  ctr: string; // CTR % (ej "5.1%")
  e: "Excelente" | "Muy bueno" | "Aceptable" | "Débil" | "Atención"; // Veredicto
  st?: string; // Estado de la campaña ("Activo", "Campaña pausada", "Desconocido")
  estado_campana?: string;
  d?: number | string; // Días activa la campaña
  dias_activa?: number | string;
  days_active?: number | string;
  diasActiva?: number | string;
  dias?: number | string;
}

function getCampaignStatus(r: CampaignRow): { label: string; isPaused: boolean; isUnknown: boolean; badgeCls: string } {
  if (!r) return { label: "Activo", isPaused: false, isUnknown: false, badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  const raw = String(r.st || r.estado_campana || (r as any).status || "Activo").trim();
  const lower = raw.toLowerCase();

  if (lower.includes("pausa") || lower.includes("pause")) {
    return {
      label: "Campaña pausada",
      isPaused: true,
      isUnknown: false,
      badgeCls: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
    };
  }
  if (lower.includes("desconocid") || lower.includes("unknown")) {
    return {
      label: "Desconocido",
      isPaused: false,
      isUnknown: true,
      badgeCls: "bg-slate-100 text-slate-700 border-slate-300 font-semibold",
    };
  }
  return {
    label: "Activo",
    isPaused: false,
    isUnknown: false,
    badgeCls: "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold",
  };
}

function getActiveDays(r: CampaignRow): number | null {
  if (!r) return null;
  const val = r.dias ?? r.d ?? r.dias_activa ?? r.days_active ?? r.diasActiva;
  if (val === undefined || val === null || val === "") return null;
  const num = typeof val === "number" ? val : parseInt(String(val).replace(/\D/g, ""), 10);
  return isNaN(num) ? null : num;
}

export type PeriodKey = "hoy" | "30" | "14" | "7" | "3";

export interface AdsDataPayload {
  hoy?: CampaignRow[];
  "30"?: CampaignRow[];
  "14"?: CampaignRow[];
  "7"?: CampaignRow[];
  "3"?: CampaignRow[];
}

// Configuración de escalas y veredictos
const RANK_CONFIG: Record<
  string,
  {
    cls: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    color: string;
    w: number;
    note: string;
  }
> = {
  Excelente: {
    cls: "bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm font-extrabold",
    bgClass: "bg-emerald-500",
    textClass: "text-emerald-700",
    borderClass: "border-emerald-300",
    color: "#10b981",
    w: 5,
    note: "Costo mínimo y mejor CTR",
  },
  "Muy bueno": {
    cls: "bg-purple-100 text-purple-800 border-purple-300 shadow-sm font-extrabold",
    bgClass: "bg-purple-500",
    textClass: "text-purple-700",
    borderClass: "border-purple-300",
    color: "#8b5cf6",
    w: 4,
    note: "Buen costo por contacto",
  },
  Aceptable: {
    cls: "bg-amber-100 text-amber-800 border-amber-300 shadow-sm font-extrabold",
    bgClass: "bg-amber-500",
    textClass: "text-amber-700",
    borderClass: "border-amber-300",
    color: "#f59e0b",
    w: 3,
    note: "Rinde, pero con margen de mejora",
  },
  Débil: {
    cls: "bg-orange-100 text-orange-800 border-orange-300 shadow-sm font-extrabold",
    bgClass: "bg-orange-500",
    textClass: "text-orange-700",
    borderClass: "border-orange-300",
    color: "#f97316",
    w: 2,
    note: "Costo alto vs. contactos",
  },
  Atención: {
    cls: "bg-rose-100 text-rose-800 border-rose-300 shadow-sm font-extrabold",
    bgClass: "bg-rose-500",
    textClass: "text-rose-700",
    borderClass: "border-rose-300",
    color: "#f43f5e",
    w: 1,
    note: "Costo insostenible o sin contactos",
  },
};

function getAdStatus(r: CampaignRow): string {
  if (!r) return "Aceptable";
  return r.e || (r as any).estado || (r as any).status || (r as any).veredicto || "Aceptable";
}

// Datos Demo por defecto (para cuando no hay URL configurada o mientras carga)
const DEFAULT_DEMO_DATA: AdsDataPayload = {
  hoy: [
    {
      a: "Curso Implantología Bucal - Quito",
      b: 15.0,
      c: { dir: "up", abs: "$2.00", pct: "+15%" },
      ct: 12,
      cc: 0.65,
      ctr: "6.2%",
      e: "Excelente",
      d: 1,
    },
    {
      a: "Consulta Odontología General",
      b: 10.0,
      c: { dir: "up", abs: "$1.00", pct: "+10%" },
      ct: 8,
      cc: 0.9,
      ctr: "4.5%",
      e: "Muy bueno",
      d: 1,
    },
  ],
  "30": [
    {
      a: "Curso Implantología Bucal - Quito",
      b: 150.0,
      c: { dir: "up", abs: "$30.00", pct: "+25%" },
      ct: 210,
      cc: 0.71,
      ctr: "4.8%",
      e: "Excelente",
      d: 25,
    },
    {
      a: "Consulta Odontología General",
      b: 120.0,
      c: { dir: "up", abs: "$10.00", pct: "+9%" },
      ct: 140,
      cc: 0.85,
      ctr: "3.9%",
      e: "Muy bueno",
      d: 18,
    },
    {
      a: "Alquiler CoWorking Dental por Horas",
      b: 90.0,
      c: { dir: "flat", abs: "$0.00", pct: "0%" },
      ct: 65,
      cc: 1.38,
      ctr: "2.7%",
      e: "Aceptable",
      d: 12,
    },
    {
      a: "Promoción Ortodoncia Invisible",
      b: 80.0,
      c: { dir: "down", abs: "$15.00", pct: "-15%" },
      ct: 32,
      cc: 2.5,
      ctr: "1.9%",
      e: "Débil",
      d: 8,
    },
    {
      a: "Especialidad Endodoncia Avanzada",
      b: 60.0,
      c: { dir: "down", abs: "$20.00", pct: "-25%" },
      ct: 12,
      cc: 5.0,
      ctr: "1.1%",
      e: "Atención",
      d: 4,
    },
  ],
  "14": [
    {
      a: "Curso Implantología Bucal - Quito",
      b: 75.0,
      c: { dir: "up", abs: "$15.00", pct: "+25%" },
      ct: 110,
      cc: 0.68,
      ctr: "5.1%",
      e: "Excelente",
    },
    {
      a: "Consulta Odontología General",
      b: 60.0,
      c: { dir: "up", abs: "$5.00", pct: "+9%" },
      ct: 68,
      cc: 0.88,
      ctr: "4.0%",
      e: "Muy bueno",
    },
    {
      a: "Alquiler CoWorking Dental por Horas",
      b: 45.0,
      c: { dir: "flat", abs: "$0.00", pct: "0%" },
      ct: 31,
      cc: 1.45,
      ctr: "2.5%",
      e: "Aceptable",
    },
    {
      a: "Promoción Ortodoncia Invisible",
      b: 40.0,
      c: { dir: "down", abs: "$10.00", pct: "-20%" },
      ct: 15,
      cc: 2.66,
      ctr: "1.8%",
      e: "Débil",
    },
    {
      a: "Especialidad Endodoncia Avanzada",
      b: 30.0,
      c: { dir: "down", abs: "$10.00", pct: "-25%" },
      ct: 5,
      cc: 6.0,
      ctr: "0.9%",
      e: "Atención",
    },
  ],
  "7": [
    {
      a: "Curso Implantología Bucal - Quito",
      b: 40.0,
      c: { dir: "up", abs: "$10.00", pct: "+33%" },
      ct: 62,
      cc: 0.64,
      ctr: "5.4%",
      e: "Excelente",
    },
    {
      a: "Consulta Odontología General",
      b: 30.0,
      c: { dir: "flat", abs: "$0.00", pct: "0%" },
      ct: 33,
      cc: 0.9,
      ctr: "3.8%",
      e: "Muy bueno",
    },
    {
      a: "Alquiler CoWorking Dental por Horas",
      b: 22.0,
      c: { dir: "up", abs: "$2.00", pct: "+10%" },
      ct: 15,
      cc: 1.46,
      ctr: "2.6%",
      e: "Aceptable",
    },
    {
      a: "Promoción Ortodoncia Invisible",
      b: 20.0,
      c: { dir: "down", abs: "$5.00", pct: "-20%" },
      ct: 7,
      cc: 2.85,
      ctr: "1.6%",
      e: "Débil",
    },
  ],
  "3": [
    {
      a: "Curso Implantología Bucal - Quito",
      b: 18.0,
      c: { dir: "up", abs: "$4.00", pct: "+28%" },
      ct: 29,
      cc: 0.62,
      ctr: "5.8%",
      e: "Excelente",
    },
    {
      a: "Consulta Odontología General",
      b: 14.0,
      c: { dir: "up", abs: "$2.00", pct: "+16%" },
      ct: 15,
      cc: 0.93,
      ctr: "4.1%",
      e: "Muy bueno",
    },
    {
      a: "Alquiler CoWorking Dental por Horas",
      b: 10.0,
      c: { dir: "flat", abs: "$0.00", pct: "0%" },
      ct: 7,
      cc: 1.42,
      ctr: "2.8%",
      e: "Aceptable",
    },
  ],
};

const STORAGE_KEY = "facop_ads_api_url";
const CLAUDE_KEY_STORAGE = "facop_claude_api_key";

interface AdsAnalyticsDashboardProps {
  isAdmin?: boolean;
}

export default function AdsAnalyticsDashboard({ isAdmin = false }: AdsAnalyticsDashboardProps) {
  const [period, setPeriod] = useState<PeriodKey>("hoy");
  const [apiUrl, setApiUrl] = useState<string>("");
  const [inputUrl, setInputUrl] = useState<string>("");

  const [claudeKey, setClaudeKey] = useState<string>("");
  const [inputClaudeKey, setInputClaudeKey] = useState<string>("");

  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);

  const [sortField, setSortField] = useState<"a" | "b" | "ct" | "cc" | "ctr" | "e" | "d" | "st">("e");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [onlyActive, setOnlyActive] = useState<boolean>(false);

  const [adsData, setAdsData] = useState<AdsDataPayload>(DEFAULT_DEMO_DATA);
  const [loading, setLoading] = useState<boolean>(false);
  const [usingDemo, setUsingDemo] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rawJsonResponse, setRawJsonResponse] = useState<string | null>(null);
  const [showJsonInspector, setShowJsonInspector] = useState<boolean>(false);

  // Cargar URL y Claude API Key guardadas en localStorage al montar
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedClaude = localStorage.getItem(CLAUDE_KEY_STORAGE);

    if (savedClaude) {
      setClaudeKey(savedClaude);
      setInputClaudeKey(savedClaude);
    }

    if (saved) {
      setApiUrl(saved);
      setInputUrl(saved);
      fetchLiveData(saved);
    } else {
      setUsingDemo(true);
    }
  }, []);

  // Normalizador flexible para extraer periodos sin importar diferencias de nombre de clave en Google Apps Script
  function parsePeriodPayload(json: any): AdsDataPayload {
    if (!json || typeof json !== "object") {
      return { "30": [], "14": [], "7": [], "3": [] };
    }

    const findArray = (...possibleKeys: (string | number)[]) => {
      for (const k of possibleKeys) {
        if (Array.isArray(json[k]) && json[k].length > 0) return json[k];
      }
      for (const k of possibleKeys) {
        if (Array.isArray(json[k])) return json[k];
      }
      return [];
    };

    return {
      hoy: findArray("hoy", "today", "0", "hoy_dias"),
      "30": findArray("30", 30, "30d", "30_dias", "periodo_30", "periodo30", "mes", "month"),
      "14": findArray("14", 14, "14d", "14_dias", "periodo_14", "periodo14"),
      "7": findArray("7", 7, "7d", "7_dias", "periodo_7", "periodo7", "semana", "week"),
      "3": findArray("3", 3, "3d", "3_dias", "periodo_3", "periodo3"),
    };
  }

  // Función para consumir los datos reales a través de nuestra API proxy en el servidor
  async function fetchLiveData(targetUrl: string) {
    if (!targetUrl || !targetUrl.startsWith("http")) {
      setUsingDemo(true);
      setAdsData(DEFAULT_DEMO_DATA);
      setErrorMsg(null);
      setRawJsonResponse(null);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const proxyUrl = `/api/admin/ads-analytics?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyUrl, { cache: "no-store" });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || `Respuesta HTTP ${res.status}`);
      }

      const json = result.data;
      setRawJsonResponse(JSON.stringify(json, null, 2));

      const parsed = parsePeriodPayload(json);
      const totalCount =
        (parsed["hoy"]?.length || 0) +
        (parsed["30"]?.length || 0) +
        (parsed["14"]?.length || 0) +
        (parsed["7"]?.length || 0) +
        (parsed["3"]?.length || 0);

      if (totalCount > 0 || typeof json === "object") {
        setAdsData(parsed);
        setUsingDemo(false);
      } else {
        throw new Error("El JSON recibido no contiene claves de periodo reconocidas (30, 14, 7, 3)");
      }
    } catch (err: any) {
      console.error("Error al cargar datos de anuncios:", err);
      setErrorMsg(err.message || "Error al conectar con la URL de Apps Script");
      setUsingDemo(true);
      setAdsData(DEFAULT_DEMO_DATA);
    } finally {
      setLoading(false);
    }
  }

  // Guardar nueva URL de Apps Script y Claude API Key
  function handleSaveUrl(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputUrl.trim();
    const trimmedClaude = inputClaudeKey.trim();

    setApiUrl(trimmed);
    localStorage.setItem(STORAGE_KEY, trimmed);

    setClaudeKey(trimmedClaude);
    localStorage.setItem(CLAUDE_KEY_STORAGE, trimmedClaude);

    setIsConfigOpen(false);

    if (trimmed) {
      fetchLiveData(trimmed);
    } else {
      setUsingDemo(true);
      setAdsData(DEFAULT_DEMO_DATA);
      setErrorMsg(null);
    }
  }

  // Generar recomendaciones estratégicas llamando a la API de Claude
  async function fetchClaudeAiAnalysis() {
    if (!currentRows || currentRows.length === 0) {
      setAiError("No hay datos de anuncios registrados para analizar en este periodo.");
      return;
    }

    setAiLoading(true);
    setAiError(null);

    try {
      // Filtrar anuncios activos para enviar a la IA
      const activeRows = currentRows.filter((r) => !getCampaignStatus(r).isPaused);
      const rowsToAnalyze = activeRows.length > 0 ? activeRows : currentRows;

      const res = await fetch("/api/admin/ads-ai-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: rowsToAnalyze,
          period,
          apiKey: claudeKey || inputClaudeKey,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || `Respuesta HTTP ${res.status}`);
      }

      setAiAnalysis(result.analysis);
    } catch (err: any) {
      console.error("Error en análisis con Claude AI:", err);
      setAiError(err.message || "Error al conectar con la API de Claude AI");
    } finally {
      setAiLoading(false);
    }
  }

  // Cargar filas del periodo seleccionado
  const currentRows = useMemo(() => {
    return adsData[period] || [];
  }, [adsData, period]);

  // Cambiar ordenamiento de la tabla
  function handleSort(field: "a" | "b" | "ct" | "cc" | "ctr" | "e" | "d" | "st") {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "e" ? "desc" : "asc");
    }
  }

  // Filas ordenadas para la tabla por estado o columna seleccionada
  const sortedRows = useMemo(() => {
    if (!currentRows || currentRows.length === 0) return [];
    let filtered = currentRows;
    if (onlyActive) {
      filtered = filtered.filter((r) => !getCampaignStatus(r).isPaused);
    }
    return [...filtered].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === "e") {
        valA = RANK_CONFIG[getAdStatus(a)]?.w || 0;
        valB = RANK_CONFIG[getAdStatus(b)]?.w || 0;
      } else if (sortField === "st") {
        valA = getCampaignStatus(a).label;
        valB = getCampaignStatus(b).label;
      } else if (sortField === "d") {
        valA = getActiveDays(a) ?? -1;
        valB = getActiveDays(b) ?? -1;
      } else if (sortField === "ctr") {
        valA = parseFloat(a.ctr) || 0;
        valB = parseFloat(b.ctr) || 0;
      } else if (typeof valA === "string") {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [currentRows, sortField, sortOrder, onlyActive]);

  // Métricas calculadas para las Tarjetas KPI y Veredicto Global
  const metrics = useMemo(() => {
    if (!currentRows || currentRows.length === 0) {
      return {
        totalCt: 0,
        totalBud: 0,
        best: null,
        risk: 0,
        activeCount: 0,
        pausedCount: 0,
        avgActiveDays: 0,
        maxActiveDays: 0,
        score: 0,
        statusLabel: "SIN DATOS",
        statusColor: "#64748b",
        statusBg: "bg-slate-100 text-slate-700",
        statusText: "No hay información registrada para este periodo.",
      };
    }

    const totalCt = currentRows.reduce((acc, r) => acc + (r.ct || 0), 0);
    const totalBud = currentRows.reduce((acc, r) => acc + (r.b || 0), 0);

    const sortedByCc = [...currentRows].sort((a, b) => a.cc - b.cc);
    const best = sortedByCc[0] || null;

    const risk = currentRows.filter(
      (r) => getAdStatus(r) === "Débil" || getAdStatus(r) === "Atención"
    ).length;

    const activeCount = currentRows.filter((r) => !getCampaignStatus(r).isPaused).length;
    const pausedCount = currentRows.filter((r) => getCampaignStatus(r).isPaused).length;

    const activeDaysList = currentRows
      .map((r) => getActiveDays(r))
      .filter((d): d is number => d !== null);

    const avgActiveDays =
      activeDaysList.length > 0
        ? Math.round(
            activeDaysList.reduce((sum, d) => sum + d, 0) / activeDaysList.length
          )
        : 0;

    const maxActiveDays =
      activeDaysList.length > 0 ? Math.max(...activeDaysList) : 0;

    // Cálculo del Score de Salud 0 - 100
    const sumWeights = currentRows.reduce((acc, r) => {
      const cfg = RANK_CONFIG[r.e] || RANK_CONFIG["Aceptable"];
      return acc + cfg.w;
    }, 0);

    const avgWeight = sumWeights / currentRows.length; // 1 a 5
    const score = Math.round(((avgWeight - 1) / 4) * 100);

    let statusColor = "#10b981";
    let statusBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
    let statusLabel = "SALUDABLE";
    let statusText =
      "La cuenta rinde bien; concentra la inversión en las campañas líderes.";

    if (score >= 75) {
      statusColor = "#10b981";
      statusBg = "bg-emerald-100/70 text-emerald-800 border-emerald-300";
      statusLabel = "SALUDABLE";
      statusText =
        "La cuenta rinde bien; concentra la inversión en las campañas líderes.";
    } else if (score >= 55) {
      statusColor = "#8b5cf6";
      statusBg = "bg-purple-100/70 text-purple-800 border-purple-300";
      statusLabel = "ESTABLE";
      statusText =
        "Rendimiento correcto con varias campañas que tienen amplio margen de optimización.";
    } else if (score >= 40) {
      statusColor = "#f59e0b";
      statusBg = "bg-amber-100/70 text-amber-800 border-amber-300";
      statusLabel = "A VIGILAR";
      statusText =
        "Varias campañas arrastran el promedio de eficiencia; se sugiere reajustar presupuestos pronto.";
    } else {
      statusColor = "#f97316";
      statusBg = "bg-rose-100/70 text-rose-800 border-rose-300";
      statusLabel = "REQUIERE ACCIÓN";
      statusText =
        "El costo por contacto actual compromete la rentabilidad. Se recomienda pausar o reestructurar anuncios débiles.";
    }

    return {
      totalCt,
      totalBud,
      best,
      risk,
      activeCount,
      pausedCount,
      avgActiveDays,
      maxActiveDays,
      score,
      statusLabel,
      statusColor,
      statusBg,
      statusText,
    };
  }, [currentRows]);

  // Recomendaciones: Solo para anuncios activos (Top 3 escalar y 3 a revisar)
  const recommendations = useMemo(() => {
    if (!currentRows || currentRows.length === 0) {
      return { wins: [], fixes: [] };
    }

    // Filtrar estrictamente solo anuncios activos (excluir pausados y desconocidos)
    const activeRows = currentRows.filter((r) => {
      const st = getCampaignStatus(r);
      return !st.isPaused && !st.isUnknown;
    });

    const wins = [...activeRows]
      .sort((a, b) => {
        const wA = RANK_CONFIG[getAdStatus(a)]?.w || 3;
        const wB = RANK_CONFIG[getAdStatus(b)]?.w || 3;
        if (wB !== wA) return wB - wA;
        return a.cc - b.cc;
      })
      .slice(0, 3);

    const fixes = [...activeRows]
      .sort((a, b) => {
        const wA = RANK_CONFIG[getAdStatus(a)]?.w || 3;
        const wB = RANK_CONFIG[getAdStatus(b)]?.w || 3;
        if (wA !== wB) return wA - wB;
        return b.cc - a.cc;
      })
      .slice(0, 3);

    return { wins, fixes };
  }, [currentRows]);

  // Ayudante de formato de moneda
  const formatMoney = (amount: number) => `$${amount.toFixed(2)}`;

  // SVG Gauge variables
  const radius = 32;
  const circumference = 2 * Math.PI * radius; // ~201.06
  const strokeOffset = circumference * (1 - metrics.score / 100);

  return (
    <div className="space-y-4">
      {/* Panel Unificado de Diagnóstico, Salud y Periodo */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Título de la Sección */}
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Diagnóstico por Periodo de Anuncios
          </h1>
          {usingDemo && (
            <div className="mt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                <Info size={12} /> Modo Demo
              </span>
            </div>
          )}
        </div>

        {/* Controles de Período, Indicador 'Hoy' al lado del botón actualizar e Integración */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Botones de Filtro de Período */}
          <div className="inline-flex bg-slate-100/80 p-1 rounded-xl border border-slate-200">
            {(["hoy", "3", "7", "14", "30"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  period === p
                    ? "bg-gradient-to-r from-purple-900 to-purple-800 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                {p === "hoy" ? "Hoy" : `${p} días`}
              </button>
            ))}
          </div>

          {apiUrl && (
            <button
              onClick={() => fetchLiveData(apiUrl)}
              disabled={loading}
              title="Refrescar datos desde Apps Script"
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-purple-600" : ""} />
            </button>
          )}

          {/* Insignia del Período al lado del botón refrescar */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse"></span>
            {period === "hoy" ? "Hoy (24h)" : `Últimos ${period} días`}
          </span>

          {isAdmin && (
            <button
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition cursor-pointer"
            >
              <Settings size={15} />
              <span className="hidden sm:inline">Configurar Meta/Apps Script</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal / Panel Integrado para Configuración de Web App Google Apps Script (Solo Administradores) */}
      {isAdmin && isConfigOpen && (
        <form
          onSubmit={handleSaveUrl}
          className="bg-gradient-to-r from-purple-900 via-purple-950 to-slate-900 text-white p-5 rounded-2xl border border-purple-800 shadow-xl space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-amber-300">
              <Sliders size={16} /> URL del Web App de Google Apps Script / Meta API
            </h3>
            <button
              type="button"
              onClick={() => setIsConfigOpen(false)}
              className="text-xs text-purple-300 hover:text-white"
            >
              Cerrar
            </button>
          </div>
          <p className="text-xs text-purple-200 leading-relaxed">
            Ingresa la URL publicada de tu Google Apps Script (terminada en <code>/exec</code>) y opcionalmente tu <b>Claude API Key</b> (Anthropic) para generar diagnósticos automáticos por IA.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-amber-300 uppercase mb-1">
                URL del Web App de Apps Script:
              </label>
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="w-full px-4 py-2 text-xs text-slate-900 bg-white rounded-xl border border-purple-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-amber-300 uppercase mb-1">
                Claude API Key (Anthropic - Opcional):
              </label>
              <input
                type="password"
                placeholder="sk-ant-api03-..."
                value={inputClaudeKey}
                onChange={(e) => setInputClaudeKey(e.target.value)}
                className="w-full px-4 py-2 text-xs text-slate-900 bg-white rounded-xl border border-purple-300 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-amber-500/20"
              >
                <Check size={14} /> Guardar Configuración
              </button>
              {rawJsonResponse && (
                <button
                  type="button"
                  onClick={() => setShowJsonInspector(!showJsonInspector)}
                  className="px-3 py-2 bg-purple-800 hover:bg-purple-700 text-purple-200 text-xs font-semibold rounded-xl border border-purple-700 transition"
                >
                  {showJsonInspector ? "Ocultar JSON" : "Inspeccionar JSON API"}
                </button>
              )}
            </div>
          </div>

          {/* Inspector de respuesta RAW de JSON */}
          {showJsonInspector && rawJsonResponse && (
            <div className="mt-3 p-3 bg-slate-950 text-emerald-400 text-[11px] font-mono rounded-xl max-h-60 overflow-y-auto border border-purple-800">
              <div className="text-slate-400 text-[10px] uppercase font-bold mb-1 border-b border-slate-800 pb-1 flex justify-between">
                <span>Respuesta JSON recibida de Apps Script:</span>
                <span className="text-amber-400">Verifica que existan las claves "30", "14", "7", "3"</span>
              </div>
              <pre className="whitespace-pre-wrap">{rawJsonResponse}</pre>
            </div>
          )}
        </form>
      )}

      {/* Alerta de Error en Fetch */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
            <span>{errorMsg}. Se están mostrando los datos demostrativos.</span>
          </div>
          <button
            onClick={() => setIsConfigOpen(true)}
            className="font-bold underline hover:text-rose-950 ml-2"
          >
            Revisar URL
          </button>
        </div>
      )}

      {/* Tarjetas KPI (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Contactos Totales */}
        <div className="relative bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition group overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-emerald-500 rounded-r-md"></div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500">
              Contactos Totales
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageSquare size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-3 tabular-nums">
            {metrics.totalCt}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            Últimos <b className="text-slate-700">{period} días</b>
          </div>
        </div>

        {/* KPI 2: Presupuesto Total */}
        <div className="relative bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition group overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-purple-600 rounded-r-md"></div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500">
              Presupuesto Acumulado
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-3 tabular-nums">
            {formatMoney(metrics.totalBud)}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            <b className="text-slate-700">{metrics.activeCount}</b> activas{metrics.pausedCount > 0 ? ` · ${metrics.pausedCount} pausadas` : ""}
          </div>
        </div>

        {/* KPI 3: Mejor Costo / Contacto */}
        <div className="relative bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition group overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-amber-500 rounded-r-md"></div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500">
              Mejor Costo / Contacto
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Trophy size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-3 tabular-nums">
            {metrics.best ? formatMoney(metrics.best.cc) : "$0.00"}
          </div>
          <div className="text-xs text-slate-500 mt-1.5 truncate">
            {metrics.best ? metrics.best.a : "Sin anuncios"}
          </div>
        </div>

        {/* KPI 4: En Riesgo */}
        <div className="relative bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition group overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-rose-500 rounded-r-md"></div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500">
              En Riesgo
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-3 tabular-nums">
            {metrics.risk}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            Campañas débiles o críticas
          </div>
        </div>
      </div>

      {/* Tabla de Rendimiento por Anuncio */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <h3 className="font-bold text-slate-900 text-sm">
            Detalle de Anuncios y Métricas de Rendimiento
          </h3>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 hover:text-purple-900 transition bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm select-none">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 accent-purple-600 cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <span>Solo campañas activas</span>
                {onlyActive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                )}
              </span>
            </label>
            <span className="text-xs text-slate-500 font-medium">
              {sortedRows.length} Anuncios analizados
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold select-none">
                <th onClick={() => handleSort("a")} className="py-3.5 px-4 sm:px-5 cursor-pointer hover:bg-slate-100 transition">
                  <div className="flex items-center gap-1">
                    Anuncio {sortField === "a" && (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th onClick={() => handleSort("st")} className="py-3.5 px-4 text-center cursor-pointer hover:bg-slate-100 transition">
                  <div className="flex items-center justify-center gap-1">
                    Estado Campaña {sortField === "st" && (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th onClick={() => handleSort("b")} className="py-3.5 px-4 text-right cursor-pointer hover:bg-slate-100 transition">
                  <div className="flex items-center justify-end gap-1">
                    Presupuesto {sortField === "b" && (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th onClick={() => handleSort("ct")} className="py-3.5 px-4 text-right cursor-pointer hover:bg-slate-100 transition">
                  <div className="flex items-center justify-end gap-1">
                    Contactos {sortField === "ct" && (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th onClick={() => handleSort("cc")} className="py-3.5 px-4 text-right cursor-pointer hover:bg-slate-100 transition">
                  <div className="flex items-center justify-end gap-1">
                    Costo / contacto {sortField === "cc" && (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th onClick={() => handleSort("ctr")} className="py-3.5 px-4 text-right cursor-pointer hover:bg-slate-100 transition">
                  <div className="flex items-center justify-end gap-1">
                    CTR {sortField === "ctr" && (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th onClick={() => handleSort("e")} className="py-3.5 px-4 text-center cursor-pointer hover:bg-purple-100/60 transition bg-purple-50/50 text-purple-900">
                  <div className="flex items-center justify-center gap-1 font-extrabold">
                    Estado / Veredicto {sortField === "e" ? (sortOrder === "asc" ? <ArrowUp size={13} className="text-purple-700" /> : <ArrowDown size={13} className="text-purple-700" />) : <ArrowUpDown size={12} className="text-slate-400" />}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-2">
                      <p className="font-semibold text-slate-800 text-sm">
                        No hay anuncios registrados para el periodo {period === "hoy" ? "de Hoy" : `de ${period} días`}.
                      </p>
                      <p className="text-xs text-slate-500">
                        {usingDemo
                          ? "Selecciona otro periodo para ver el informe."
                          : `Tu Apps Script fue consultado con éxito, pero el objeto '${period}' está vacío en tu Google Sheet.`}
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                        {(["hoy", "3", "7", "14", "30"] as const).map((p) => {
                          const count = (adsData[p] || []).length;
                          if (count === 0) return null;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setPeriod(p)}
                              className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-bold rounded-lg transition"
                            >
                              Ver {p === "hoy" ? "Hoy" : `${p} días`} ({count} anuncios)
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedRows.map((r, idx) => {
                  const statusName = getAdStatus(r);
                  const rankInfo = RANK_CONFIG[statusName] || RANK_CONFIG["Aceptable"];
                  const activeDays = getActiveDays(r);
                  const stInfo = getCampaignStatus(r);
                  const ccColor =
                    r.cc <= 1.0
                      ? "text-emerald-600 font-bold"
                      : r.cc >= 2.5
                      ? "text-rose-600 font-bold"
                      : "text-slate-800";

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-purple-50/30 transition-colors"
                    >
                      {/* Anuncio */}
                      <td className="py-4 px-4 sm:px-5">
                        <div className="flex items-center gap-3">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: rankInfo.color }}
                          ></span>
                          <div>
                            <div className="font-bold text-slate-900 text-xs sm:text-sm">
                              {r.a}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                              <span className="text-[11px] text-slate-500">
                                {rankInfo.note}
                              </span>
                              {activeDays !== null && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                                  <Clock size={10} /> {activeDays} {activeDays === 1 ? "día activa" : "días activa"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Estado Campaña */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${stInfo.badgeCls}`}
                        >
                          {stInfo.isPaused ? "⏸️ Pausada" : stInfo.isUnknown ? "❓ Desconocido" : "🟢 Activa"}
                        </span>
                      </td>

                      {/* Presupuesto */}
                      <td className="py-4 px-4 text-right font-medium text-slate-900 tabular-nums">
                        {formatMoney(r.b)}
                      </td>

                      {/* Contactos */}
                      <td className="py-4 px-4 text-right font-bold text-slate-900 tabular-nums">
                        {r.ct}
                      </td>

                      {/* Costo / Contacto */}
                      <td className={`py-4 px-4 text-right tabular-nums ${ccColor}`}>
                        {formatMoney(r.cc)}
                      </td>

                      {/* CTR */}
                      <td className="py-4 px-4 text-right font-medium text-slate-700 tabular-nums">
                        {r.ctr}
                      </td>

                      {/* Veredicto / Estado */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold border ${rankInfo.cls}`}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
                            style={{ backgroundColor: rankInfo.color }}
                          ></span>
                          {statusName}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bloque de Recomendaciones en Tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Escalar */}
        <div className="bg-white border border-emerald-200/80 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-700">
            <TrendingUp size={16} />
            ▲ Escalar — Anuncios de mayor rendimiento
          </div>
          <ul className="divide-y divide-slate-100 text-xs sm:text-sm">
            {recommendations.wins.length === 0 ? (
              <li className="py-2 text-slate-500">Sin recomendaciones aún</li>
            ) : (
              recommendations.wins.map((r, i) => (
                <li key={i} className="py-3 flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <b className="text-slate-900 font-bold">{r.a}</b>
                    <div className="text-slate-500 text-xs mt-0.5">
                      {formatMoney(r.cc)} / contacto · <b>{r.ct} contactos</b>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Revisar */}
        <div className="bg-white border border-orange-200/80 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-orange-700">
            <AlertCircle size={16} />
            ▼ Revisar — Anuncios que requieren optimización
          </div>
          <ul className="divide-y divide-slate-100 text-xs sm:text-sm">
            {recommendations.fixes.length === 0 ? (
              <li className="py-2 text-slate-500">Sin anuncios críticos</li>
            ) : (
              recommendations.fixes.map((r, i) => {
                const rank = RANK_CONFIG[r.e] || RANK_CONFIG["Aceptable"];
                return (
                  <li key={i} className="py-3 flex items-start gap-2.5">
                    <AlertTriangle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <b className="text-slate-900 font-bold">{r.a}</b>
                      <div className="text-slate-500 text-xs mt-0.5">
                        {formatMoney(r.cc)} / contacto · {rank.note.toLowerCase()}
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

      {/* Bloque de Inteligencia Artificial Claude (Solo Administradores - Al Final) */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 rounded-2xl p-5 text-white border border-purple-800/80 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-800/60 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold shadow-inner">
                <Sparkles size={20} className="animate-pulse text-amber-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                  Recomendaciones de Inteligencia Artificial con Claude
                  <span className="text-[10px] bg-purple-500/30 text-purple-200 border border-purple-400/30 px-2 py-0.5 rounded-full font-mono font-normal">
                    Anthropic AI
                  </span>
                </h3>
                <p className="text-xs text-purple-200/80 mt-0.5">
                  Genera estrategias en vivo para potenciar anuncios ganadores y tomar medidas inmediatas.
                </p>
              </div>
            </div>

            <button
              onClick={fetchClaudeAiAnalysis}
              disabled={aiLoading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-extrabold rounded-xl transition shadow-md shadow-amber-500/20 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              {aiLoading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Analizando métricas...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Consultar a Claude AI
                </>
              )}
            </button>
          </div>

          {aiError && (
            <div className="p-3.5 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-400 flex-shrink-0" />
              <span>{aiError}</span>
            </div>
          )}

          {aiAnalysis ? (
            <div className="p-4 bg-purple-950/60 rounded-xl border border-purple-800/80 text-xs sm:text-sm text-purple-100 space-y-3 leading-relaxed font-sans whitespace-pre-wrap">
              {aiAnalysis}
            </div>
          ) : (
            !aiLoading && (
              <div className="p-3.5 bg-purple-950/40 rounded-xl border border-purple-900/60 text-xs text-purple-300/90 flex items-center justify-between">
                <span>
                  💡 Haz clic en <b>"Consultar a Claude AI"</b> para recibir sugerencias inteligentes de copy, presupuesto y optimización sobre los anuncios de este período.
                </span>
              </div>
            )
          )}
        </div>
      )}

      {/* Pie de Página con resumen */}
      <div className="text-center text-xs text-slate-500 py-2 border-t border-slate-200/60">
        Periodo de {period} días · {currentRows.length} campañas analizadas · Veredicto automático calculado por costo por contacto y CTR
      </div>
    </div>
  );
}
