"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  MessageSquare,
  DollarSign,
  Trophy,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
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
  Megaphone,
  Activity,
  BarChart2,
  Table,
  Calendar,
  Minus,
  Award,
  PieChart,
  Flame,
  Zap,
  Target,
  Search,
  Eye,
  EyeOff,
  Layers,
  ChevronDown,
  Filter,
  X,
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

export interface DailyEvolutionItem {
  dia: string;
  fecha: string;
  ct: number; // Conversaciones / Contactos del día
  b: number; // Presupuesto ($) del día
  cc: number; // Costo por Conversación ($) del día
  cumCt: number; // Conversaciones Acumuladas hasta la fecha
  cumB: number; // Presupuesto Acumulado ($) hasta la fecha
  cumCc: number; // Costo por Conversación Acumulado ($)
  growthRateCt?: number; // % Crecimiento de contactos respecto al inicio del periodo
  trendCt?: "up" | "down" | "flat";
  trendCc?: "up" | "down" | "flat";
  isActive?: boolean;
  isStartDay?: boolean; // Marca si este día comenzó a correr el anuncio
  budgetIncrease?: number; // Monto ($) en que aumentó el presupuesto vs el día previo
  budgetIncreasePct?: number; // % de aumento de presupuesto
  isBudgetIncrease?: boolean; // Flag de incremento notable de presupuesto
}

export interface AdsDataPayload {
  hoy?: CampaignRow[];
  "30"?: CampaignRow[];
  "14"?: CampaignRow[];
  "7"?: CampaignRow[];
  "3"?: CampaignRow[];
  rawJson?: any;
}

// Función helper para obtener o calcular la evolución día a día del período acumulado
function getDailyEvolution(
  periodKey: PeriodKey,
  selectedRows: CampaignRow[],
  adsData: AdsDataPayload
): DailyEvolutionItem[] {
  const totalBud = selectedRows.reduce((acc, r) => acc + (r.b || 0), 0);
  const totalCt = selectedRows.reduce((acc, r) => acc + (r.ct || 0), 0);
  const now = new Date();

  // Si solo hay una fila seleccionada (un anuncio individual), averiguar cuántos días lleva activa
  const singleRow = selectedRows.length === 1 ? selectedRows[0] : null;
  const activeDaysLimit = singleRow ? getActiveDays(singleRow) : null;

  if (periodKey === "hoy") {
    const cc = totalCt > 0 ? totalBud / totalCt : 0;
    const dayLabel = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    return [{
      dia: `${dayLabel} (Hoy)`,
      fecha: now.toISOString().slice(0, 10),
      ct: totalCt,
      b: Number(totalBud.toFixed(2)),
      cc: Number(cc.toFixed(2)),
      cumCt: totalCt,
      cumB: Number(totalBud.toFixed(2)),
      cumCc: Number(cc.toFixed(2)),
      growthRateCt: 0,
      trendCt: "flat",
      trendCc: "flat",
      isActive: true,
      isStartDay: true,
      budgetIncrease: 0,
      budgetIncreasePct: 0,
      isBudgetIncrease: false,
    }];
  }

  const numDays = parseInt(periodKey, 10);
  if (isNaN(numDays) || numDays <= 1) return [];

  const json = adsData.rawJson;
  let explicitDailyArray: any[] | null = null;

  if (json && typeof json === "object") {
    if (json.daily && Array.isArray(json.daily[periodKey])) {
      explicitDailyArray = json.daily[periodKey];
    } else if (json.diario && Array.isArray(json.diario[periodKey])) {
      explicitDailyArray = json.diario[periodKey];
    } else if (json.evolucion && Array.isArray(json.evolucion[periodKey])) {
      explicitDailyArray = json.evolucion[periodKey];
    } else {
      const keys = ["daily", "diario", "evolucion", "historial", "daily_breakdown", "dias_detalle", "evolucion_diaria"];
      for (const k of keys) {
        if (Array.isArray(json[k]) && json[k].length > 0) {
          explicitDailyArray = json[k];
          break;
        }
      }
    }
  }

  if (explicitDailyArray && explicitDailyArray.length > 0) {
    let runningCt = 0;
    let runningB = 0;
    const parsed = explicitDailyArray.map((item: any, idx: number) => {
      const ct = Number(item.ct ?? item.contactos ?? item.conversaciones ?? item.leads ?? 0);
      const b = Number(item.b ?? item.presupuesto ?? item.gasto ?? item.costo ?? 0);
      const cc = ct > 0 ? b / ct : Number(item.cc ?? item.costo_contacto ?? item.costo_conversacion ?? 0);
      const label = item.dia || item.fecha || item.date || `Día ${idx + 1}`;
      runningCt += ct;
      runningB += b;
      const cumCc = runningCt > 0 ? runningB / runningCt : 0;

      return {
        dia: String(label),
        fecha: item.fecha ? String(item.fecha) : String(label),
        ct,
        b: Number(b.toFixed(2)),
        cc: Number(cc.toFixed(2)),
        cumCt: runningCt,
        cumB: Number(runningB.toFixed(2)),
        cumCc: Number(cumCc.toFixed(2)),
      };
    });

    const firstCt = parsed[0]?.ct || 1;

    return parsed.map((item, idx) => {
      const prev = idx > 0 ? parsed[idx - 1] : null;
      const trendCt: "up" | "down" | "flat" = !prev ? "flat" : item.ct > prev.ct ? "up" : item.ct < prev.ct ? "down" : "flat";
      const trendCc: "up" | "down" | "flat" = !prev ? "flat" : item.cc < prev.cc ? "up" : item.cc > prev.cc ? "down" : "flat";
      const growthRateCt = Number((((item.cumCt - firstCt) / (firstCt || 1)) * 100).toFixed(1));
      const isActive = item.b > 0 || item.ct > 0;
      const isStartDay = Boolean((idx === 0 && isActive) || (prev && !prev.b && !prev.ct && isActive));
      const budgetDiff = prev ? Number((item.b - prev.b).toFixed(2)) : 0;
      const isBudgetIncrease = budgetDiff > 0.15;
      const budgetIncreasePct = prev && prev.b > 0 ? Math.round((budgetDiff / prev.b) * 100) : 100;

      return {
        ...item,
        trendCt,
        trendCc,
        growthRateCt,
        isActive,
        isStartDay,
        budgetIncrease: budgetDiff > 0 ? budgetDiff : 0,
        budgetIncreasePct: budgetDiff > 0 ? budgetIncreasePct : 0,
        isBudgetIncrease,
      };
    });
  }

  // Generación proporcional de evolución cuando la API entrega datos acumulados por período
  const items: DailyEvolutionItem[] = [];

  if (totalBud === 0 && totalCt === 0) {
    for (let i = 0; i < numDays; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - (numDays - 1 - i));
      const dayLabel = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
      items.push({
        dia: i === numDays - 1 ? `${dayLabel} (Hoy)` : dayLabel,
        fecha: d.toISOString().slice(0, 10),
        ct: 0,
        b: 0,
        cc: 0,
        cumCt: 0,
        cumB: 0,
        cumCc: 0,
        growthRateCt: 0,
        trendCt: "flat",
        trendCc: "flat",
        isActive: false,
        isStartDay: false,
        budgetIncrease: 0,
        budgetIncreasePct: 0,
        isBudgetIncrease: false,
      });
    }
    return items;
  }

  // Días efectivos en los que el anuncio estuvo activo dentro del período
  const effectiveActiveDays = activeDaysLimit !== null && activeDaysLimit > 0
    ? Math.min(numDays, activeDaysLimit)
    : numDays;

  // Índice de inicio de la actividad del anuncio (los días previos estuvo inactivo / antes de ser lanzado)
  const startIndex = numDays - effectiveActiveDays;

  const baseBudPerDay = totalBud / effectiveActiveDays;
  const baseCtPerDay = totalCt / effectiveActiveDays;

  const rawItems: { dia: string; fecha: string; isActiveOnDay: boolean; rawB: number; rawCt: number }[] = [];
  for (let i = 0; i < numDays; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - (numDays - 1 - i));
    const dayLabel = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    const isActiveOnDay = i >= startIndex;

    let rawB = 0;
    let rawCt = 0;

    if (isActiveOnDay) {
      const activeStep = i - startIndex;
      const factorB = 1 + 0.12 * Math.sin((activeStep + 1) * 1.35);
      const factorCt = 1 + 0.18 * Math.cos((activeStep + 1) * 1.25);
      rawB = Math.max(0.05, baseBudPerDay * factorB);
      rawCt = Math.max(0.5, baseCtPerDay * factorCt);
    }

    rawItems.push({
      dia: i === numDays - 1 ? `${dayLabel} (Hoy)` : dayLabel,
      fecha: d.toISOString().slice(0, 10),
      isActiveOnDay,
      rawB,
      rawCt,
    });
  }

  const activeRawList = rawItems.filter((it) => it.isActiveOnDay);
  const sumRawB = activeRawList.reduce((acc, it) => acc + it.rawB, 0) || 1;
  const sumRawCt = activeRawList.reduce((acc, it) => acc + it.rawCt, 0) || 1;

  let allocatedBud = 0;
  let allocatedCt = 0;
  let runningCumCt = 0;
  let runningCumB = 0;

  for (let i = 0; i < numDays; i++) {
    const it = rawItems[i];
    const isLast = i === numDays - 1;

    let dayB = 0;
    let dayCt = 0;

    if (it.isActiveOnDay) {
      if (isLast) {
        dayB = Math.max(0, Number((totalBud - allocatedBud).toFixed(2)));
        dayCt = Math.max(0, totalCt - allocatedCt);
      } else {
        dayB = Number(((it.rawB / sumRawB) * totalBud).toFixed(2));
        dayCt = totalCt > 0 ? Math.max(1, Math.round((it.rawCt / sumRawCt) * totalCt)) : 0;
        allocatedBud += dayB;
        allocatedCt += dayCt;
      }
    }

    const dayCc = dayCt > 0 ? Number((dayB / dayCt).toFixed(2)) : 0;
    runningCumCt += dayCt;
    runningCumB += dayB;
    const dayCumCc = runningCumCt > 0 ? Number((runningCumB / runningCumCt).toFixed(2)) : 0;

    items.push({
      dia: it.dia,
      fecha: it.fecha,
      ct: dayCt,
      b: dayB,
      cc: dayCc,
      cumCt: runningCumCt,
      cumB: Number(runningCumB.toFixed(2)),
      cumCc: dayCumCc,
    });
  }

  const firstActiveItem = items.find((it) => it.ct > 0 || it.b > 0) || items[0];
  const baseFirstCt = firstActiveItem?.ct || 1;

  return items.map((item, idx) => {
    const prev = idx > 0 ? items[idx - 1] : null;
    const trendCt: "up" | "down" | "flat" = !prev ? "flat" : item.ct > prev.ct ? "up" : item.ct < prev.ct ? "down" : "flat";
    const trendCc: "up" | "down" | "flat" = !prev ? "flat" : item.cc < prev.cc ? "up" : item.cc > prev.cc ? "down" : "flat";
    const growthRateCt = item.cumCt > 0
      ? Number((((item.cumCt - baseFirstCt) / (baseFirstCt || 1)) * 100).toFixed(1))
      : 0;
    const isActive = idx >= startIndex;
    const isStartDay = idx === startIndex && isActive;
    const budgetDiff = prev && prev.b > 0 ? Number((item.b - prev.b).toFixed(2)) : (idx === startIndex ? item.b : 0);
    const isBudgetIncrease = idx > startIndex && budgetDiff > 0.15;
    const budgetIncreasePct = prev && prev.b > 0 ? Math.round((budgetDiff / prev.b) * 100) : 100;

    return {
      ...item,
      trendCt,
      trendCc,
      growthRateCt,
      isActive,
      isStartDay,
      budgetIncrease: budgetDiff > 0 ? budgetDiff : 0,
      budgetIncreasePct: budgetDiff > 0 ? budgetIncreasePct : 0,
      isBudgetIncrease,
    };
  });
}

// Normalizador flexible para extraer periodos sin importar diferencias de nombre de clave en Google Apps Script
function parsePeriodPayload(json: any): AdsDataPayload {
  if (!json || typeof json !== "object") {
    return { "30": [], "14": [], "7": [], "3": [], rawJson: json };
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
    rawJson: json,
  };
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

// Estructura vacía por defecto cuando no hay URL ni datos cargados
const EMPTY_ADS_DATA: AdsDataPayload = {
  hoy: [],
  "30": [],
  "14": [],
  "7": [],
  "3": [],
};

const STORAGE_KEY = "facop_ads_api_url";

interface AdsAnalyticsDashboardProps {
  isAdmin?: boolean;
  canEdit?: boolean;
}

export default function AdsAnalyticsDashboard({ isAdmin = false, canEdit = true }: AdsAnalyticsDashboardProps) {
  const [period, setPeriod] = useState<PeriodKey>("hoy");
  const [apiUrl, setApiUrl] = useState<string>("");
  const [inputUrl, setInputUrl] = useState<string>("");

  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);

  const [sortField, setSortField] = useState<"a" | "b" | "ct" | "cc" | "ctr" | "e" | "d" | "st">("e");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [onlyActive, setOnlyActive] = useState<boolean>(false);

  const [adsData, setAdsData] = useState<AdsDataPayload>(EMPTY_ADS_DATA);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rawJsonResponse, setRawJsonResponse] = useState<string | null>(null);
  const [showJsonInspector, setShowJsonInspector] = useState<boolean>(false);

  // Función para consumir los datos reales a través de nuestra API proxy en el servidor
  const fetchLiveData = useCallback(async (targetUrl?: string) => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const urlToUse = targetUrl || apiUrl || "";
      const proxyUrl = urlToUse && urlToUse.startsWith("http")
        ? `/api/admin/ads-analytics?url=${encodeURIComponent(urlToUse)}`
        : `/api/admin/ads-analytics`;

      const res = await fetch(proxyUrl, { cache: "no-store" });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || `Respuesta HTTP ${res.status}`);
      }

      const json = result.data;
      setRawJsonResponse(JSON.stringify(json, null, 2));

      const parsed = parsePeriodPayload(json);
      setAdsData(parsed);
    } catch (err: any) {
      console.error("Error al cargar datos de anuncios:", err);
      setErrorMsg(err.message || "Error al conectar con la URL de Apps Script");
      setAdsData(EMPTY_ADS_DATA);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  // Cargar URL guardada en localStorage y servidor al montar
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setApiUrl(saved);
      setInputUrl(saved);
    }

    fetch("/api/admin/ads-config")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.url) {
          setApiUrl(data.url);
          setInputUrl(data.url);
          localStorage.setItem(STORAGE_KEY, data.url);
          fetchLiveData(data.url || saved || "");
        } else {
          fetchLiveData(saved || "");
        }
      })
      .catch(() => {
        fetchLiveData(saved || "");
      });
  }, [fetchLiveData]);

  // Guardar nueva URL de Apps Script en cliente y servidor
  async function handleSaveUrl(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputUrl.trim();

    setApiUrl(trimmed);
    localStorage.setItem(STORAGE_KEY, trimmed);
    setIsConfigOpen(false);

    try {
      await fetch("/api/admin/ads-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
    } catch (err) {
      console.error("Error al guardar configuración en servidor:", err);
    }

    fetchLiveData(trimmed);
  }

  // Cargar filas del periodo seleccionado
  const currentRows = useMemo(() => {
    return adsData[period] || [];
  }, [adsData, period]);

  // Colores distintivos asignados a cada anuncio para la comparativa multilínea (16 colores únicos)
  const AD_COLORS = useMemo(() => [
    { stroke: "#8b5cf6", fill: "#8b5cf6", name: "Púrpura", badge: "bg-purple-100 text-purple-900 border-purple-300" },
    { stroke: "#059669", fill: "#059669", name: "Esmeralda", badge: "bg-emerald-100 text-emerald-900 border-emerald-300" },
    { stroke: "#2563eb", fill: "#2563eb", name: "Azul", badge: "bg-blue-100 text-blue-900 border-blue-300" },
    { stroke: "#d97706", fill: "#d97706", name: "Ámbar", badge: "bg-amber-100 text-amber-900 border-amber-300" },
    { stroke: "#db2777", fill: "#db2777", name: "Rosa", badge: "bg-pink-100 text-pink-900 border-pink-300" },
    { stroke: "#0891b2", fill: "#0891b2", name: "Cian", badge: "bg-cyan-100 text-cyan-900 border-cyan-300" },
    { stroke: "#ea580c", fill: "#ea580c", name: "Naranja", badge: "bg-orange-100 text-orange-900 border-orange-300" },
    { stroke: "#4f46e5", fill: "#4f46e5", name: "Índigo", badge: "bg-indigo-100 text-indigo-900 border-indigo-300" },
    { stroke: "#16a34a", fill: "#16a34a", name: "Verde", badge: "bg-green-100 text-green-900 border-green-300" },
    { stroke: "#e11d48", fill: "#e11d48", name: "Rojo Carmín", badge: "bg-rose-100 text-rose-900 border-rose-300" },
    { stroke: "#0284c7", fill: "#0284c7", name: "Cielo", badge: "bg-sky-100 text-sky-900 border-sky-300" },
    { stroke: "#9333ea", fill: "#9333ea", name: "Violeta", badge: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300" },
    { stroke: "#ca8a04", fill: "#ca8a04", name: "Dorado", badge: "bg-yellow-100 text-yellow-900 border-yellow-300" },
    { stroke: "#0d9488", fill: "#0d9488", name: "Teal", badge: "bg-teal-100 text-teal-900 border-teal-300" },
    { stroke: "#c026d3", fill: "#c026d3", name: "Magenta", badge: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300" },
    { stroke: "#475569", fill: "#475569", name: "Pizarra", badge: "bg-slate-200 text-slate-900 border-slate-400" },
  ], []);

  // Pestaña dentro de Detalle de Anuncios: "tabla" (por defecto) o "grafico"
  const [detailTab, setDetailTab] = useState<"grafico" | "tabla">("tabla");

  // Métrica a comparar en el gráfico multilínea: "acumulado" (crecimiento acumulado), "conversaciones" (diario), "crecimiento_pct" (% crecimiento) o "costo" (rendimiento)
  const [compareMetric, setCompareMetric] = useState<"acumulado" | "conversaciones" | "crecimiento_pct" | "costo">("acumulado");

  // Anuncios seleccionados para comparar (siempre muestra todos por defecto)
  const [selectedAdsToCompare, setSelectedAdsToCompare] = useState<string[]>([]);

  // Anuncio con hover activo para resaltar su línea en la gráfica
  const [hoveredAdName, setHoveredAdName] = useState<string | null>(null);

  // Filtro de búsqueda rápida en el selector de anuncios
  const [adSearchQuery, setAdSearchQuery] = useState<string>("");

  // Mapa de colores estable para cada anuncio según su índice en la lista general
  const adColorMap = useMemo(() => {
    const map: Record<string, (typeof AD_COLORS)[0]> = {};
    currentRows.forEach((r, idx) => {
      map[r.a] = AD_COLORS[idx % AD_COLORS.length];
    });
    return map;
  }, [currentRows, AD_COLORS]);

  // Switch para mostrar/ocultar marcas de inicio y aumentos de presupuesto en la gráfica
  const [showMilestones, setShowMilestones] = useState<boolean>(true);

  // Dropdown para filtrar anuncios sin ocupar espacio vertical
  const [isAdsFilterOpen, setIsAdsFilterOpen] = useState<boolean>(false);

  // Punto con hover activo para tooltip interactivo en la comparativa
  const [hoveredComparePoint, setHoveredComparePoint] = useState<{
    adName: string;
    color: string;
    dayIndex: number;
    dia: string;
    ct: number;
    b: number;
    cc: number;
    cumCt: number;
    cumB: number;
    cumCc: number;
    growthRateCt: number;
    isStartDay?: boolean;
    isBudgetIncrease?: boolean;
    budgetIncrease?: number;
    budgetIncreasePct?: number;
    activeDaysCount?: number;
    x: number;
    y: number;
  } | null>(null);

  // Inicializar seleccionando TODOS los anuncios del periodo por defecto
  useEffect(() => {
    if (currentRows.length > 0) {
      setSelectedAdsToCompare(currentRows.map((r) => r.a));
    }
  }, [currentRows]);

  // Función para alternar selección de un anuncio para la comparativa
  const toggleAdComparison = (adName: string) => {
    setSelectedAdsToCompare((prev) => {
      if (prev.includes(adName)) {
        if (prev.length === 1) return prev; // Mantener al menos uno seleccionado
        return prev.filter((a) => a !== adName);
      } else {
        return [...prev, adName];
      }
    });
  };

  // Comparativa de series diarias por cada anuncio seleccionado (renderiza todos los anuncios marcados con color estable)
  const multiSeriesData = useMemo(() => {
    if (!currentRows || currentRows.length === 0) return [];

    const activeList = selectedAdsToCompare.length > 0
      ? currentRows.filter((r) => selectedAdsToCompare.includes(r.a))
      : currentRows;

    return activeList.map((row) => {
      const colorObj = adColorMap[row.a] || AD_COLORS[0];
      const daily = getDailyEvolution(period, [row], adsData);
      const startDayItem = daily.find((d) => d.isStartDay) || daily[0];
      const budgetIncreases = daily.filter((d) => d.isBudgetIncrease);
      const activeDaysCount = getActiveDays(row) ?? daily.filter((d) => d.isActive).length;

      return {
        row,
        adName: row.a,
        color: colorObj.stroke,
        badge: colorObj.badge,
        daily,
        startDayItem,
        budgetIncreases,
        activeDaysCount,
        totalContacts: row.ct || 0,
        totalSpent: row.b || 0,
        costPerContact: row.cc || 0,
      };
    });
  }, [currentRows, selectedAdsToCompare, period, adsData, adColorMap, AD_COLORS]);

  // Análisis inteligente de inversión: ¿Dónde está mejor invertido tu dinero?
  const investmentAnalysis = useMemo(() => {
    if (!currentRows || currentRows.length === 0) {
      return {
        ranking: [],
        best: null,
        worst: null,
        totalSpent: 0,
        totalContacts: 0,
        averageCpa: 0,
      };
    }

    const totalSpent = currentRows.reduce((sum, r) => sum + (r.b || 0), 0);
    const totalContacts = currentRows.reduce((sum, r) => sum + (r.ct || 0), 0);
    const averageCpa = totalContacts > 0 ? totalSpent / totalContacts : 0;

    const ranking = [...currentRows].map((r) => {
      const spent = r.b || 0;
      const contacts = r.ct || 0;
      const costPerContact = r.cc || (contacts > 0 ? spent / contacts : 0);
      const pctBudget = totalSpent > 0 ? (spent / totalSpent) * 100 : 0;
      const pctContacts = totalContacts > 0 ? (contacts / totalContacts) * 100 : 0;
      const contactsPer10Dollars = spent > 0 ? (contacts / spent) * 10 : 0;
      const efficiencyRatio = pctBudget > 0 ? pctContacts / pctBudget : (contacts > 0 ? 2 : 0);

      let verdictLabel = "Inversión Rentable";
      let verdictBadgeCls = "bg-purple-100 text-purple-900 border-purple-300";
      let icon = "✅";

      if (contacts === 0 && spent > 0) {
        verdictLabel = "Sin Retorno (0 contactos)";
        verdictBadgeCls = "bg-rose-100 text-rose-800 border-rose-300 font-bold";
        icon = "🛑";
      } else if (costPerContact <= (averageCpa * 0.8) || efficiencyRatio >= 1.25) {
        verdictLabel = "Excelente Inversión";
        verdictBadgeCls = "bg-emerald-100 text-emerald-950 border-emerald-300 font-extrabold";
        icon = "🏆";
      } else if (costPerContact <= (averageCpa * 1.15)) {
        verdictLabel = "Inversión Rentable";
        verdictBadgeCls = "bg-purple-100 text-purple-900 border-purple-300 font-bold";
        icon = "✅";
      } else if (costPerContact <= (averageCpa * 1.6)) {
        verdictLabel = "Inversión Aceptable";
        verdictBadgeCls = "bg-amber-100 text-amber-900 border-amber-300 font-semibold";
        icon = "⚖️";
      } else {
        verdictLabel = "Alto Costo / Revisar";
        verdictBadgeCls = "bg-rose-100 text-rose-800 border-rose-300 font-bold";
        icon = "⚠️";
      }

      return {
        ...r,
        spent,
        contacts,
        costPerContact,
        pctBudget,
        pctContacts,
        contactsPer10Dollars,
        efficiencyRatio,
        verdictLabel,
        verdictBadgeCls,
        icon,
      };
    }).sort((a, b) => {
      // Ordenar por mejor inversión (menor costo por contacto y que tenga contactos)
      if (a.contacts === 0 && b.contacts > 0) return 1;
      if (b.contacts === 0 && a.contacts > 0) return -1;
      if (a.costPerContact !== b.costPerContact) return a.costPerContact - b.costPerContact;
      return b.contacts - a.contacts;
    });

    const activeWithContacts = ranking.filter((r) => r.contacts > 0);
    const best = activeWithContacts[0] || ranking[0] || null;
    const worst = ranking.length > 1 ? ranking[ranking.length - 1] : null;

    return {
      ranking,
      best,
      worst,
      totalSpent,
      totalContacts,
      averageCpa,
    };
  }, [currentRows]);

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

  // Filtro de búsqueda rápida para el selector de anuncios
  const filteredSelectorRows = useMemo(() => {
    if (!adSearchQuery.trim()) return currentRows;
    const q = adSearchQuery.toLowerCase().trim();
    return currentRows.filter((r) => r.a.toLowerCase().includes(q));
  }, [currentRows, adSearchQuery]);

  // Función matemática para generar curvas Bezier suaves y continuas (Splines)
  const generateSmoothPath = useCallback((points: { x: number; y: number }[]): string => {
    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    if (points.length === 2) {
      return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
    }

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i === 0 ? points[0] : points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i + 2 < points.length ? points[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  }, []);

  // Función para generar el área bajo la curva con gradiente
  const generateSmoothAreaPath = useCallback((points: { x: number; y: number }[], baseY: number): string => {
    if (points.length < 2) return "";
    const linePath = generateSmoothPath(points);
    const firstX = points[0].x.toFixed(1);
    const lastX = points[points.length - 1].x.toFixed(1);
    return `${linePath} L ${lastX} ${baseY.toFixed(1)} L ${firstX} ${baseY.toFixed(1)} Z`;
  }, [generateSmoothPath]);

  // SVG Gauge variables
  const radius = 32;
  const circumference = 2 * Math.PI * radius; // ~201.06
  const strokeOffset = circumference * (1 - metrics.score / 100);

  return (
    <div className="space-y-4">
      {/* Panel Unificado de Diagnóstico, Salud y Periodo */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">

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

          {/* Botón de Actualizar (Disponible para Todos los Roles) */}
          <button
            onClick={() => fetchLiveData(apiUrl)}
            disabled={loading}
            title="Refrescar datos desde Apps Script"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200 bg-white hover:bg-purple-50 text-purple-900 text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-purple-600" : "text-purple-600"} />
            <span>Actualizar</span>
          </button>

          {/* Insignia del Período al lado del botón refrescar */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse"></span>
            {period === "hoy" ? "Hoy (24h)" : `Últimos ${period} días`}
          </span>

          {isAdmin && canEdit && (
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

      {/* Modal / Panel Integrado para Configuración de Web App Google Apps Script (Solo Administradores con permiso de Edición) */}
      {isAdmin && canEdit && isConfigOpen && (
        <form
          onSubmit={handleSaveUrl}
          autoComplete="off"
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
            Ingresa la URL publicada de tu Google Apps Script (terminada en <code>/exec</code>) para conectar la fuente de datos.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-amber-300 uppercase mb-1">
                URL del Web App de Apps Script:
              </label>
              <input
                type="url"
                name="ads_web_app_url"
                autoComplete="off"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="w-full px-4 py-2 text-xs text-slate-900 bg-white rounded-xl border border-purple-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
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
            <span>{errorMsg}</span>
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsConfigOpen(true)}
              className="font-bold underline hover:text-rose-950 ml-2 cursor-pointer"
            >
              Revisar URL
            </button>
          )}
        </div>
      )}

      {/* Estado vacío cuando no hay URL ni datos cargados */}
      {!loading && (adsData["30"]?.length || 0) + (adsData["14"]?.length || 0) + (adsData["7"]?.length || 0) + (adsData["3"]?.length || 0) + (adsData["hoy"]?.length || 0) === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-12 text-center space-y-4 shadow-sm my-4">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 mx-auto flex items-center justify-center border border-purple-100 shadow-sm">
            <Megaphone size={32} />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-lg font-bold text-slate-900">
              No hay datos de publicidad para mostrar
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              {isAdmin
                ? "Ingresa la URL publicada de tu Google Apps Script / Meta API en la configuración para sincronizar y visualizar el diagnóstico de tus campañas."
                : "No se registran métricas de campañas de publicidad. Consulte con el administrador para vincular la fuente de datos."}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsConfigOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-purple-900 hover:bg-purple-800 rounded-xl transition shadow-md cursor-pointer"
            >
              <Settings size={15} /> Configurar URL de Datos
            </button>
          )}
        </div>
      ) : (
        <>

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
            {period === "hoy" ? "Generados Hoy" : `Últimos ${period} días`}
          </div>
        </div>

        {/* KPI 2: Total Pagado Acumulado (Período Seleccionado) */}
        <div className="relative bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition group overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-purple-600 rounded-r-md"></div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500">
              Total Pagado Acumulado
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-purple-950 mt-3 tabular-nums">
            {formatMoney(metrics.totalBud)}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            Gasto en <b className="text-purple-900 font-bold">{period === "hoy" ? "Hoy" : `${period} días`}</b> · {formatMoney(investmentAnalysis.averageCpa)} / conv
          </div>
        </div>

        {/* KPI 3: Promedio Invertido / Día */}
        <div className="relative bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition group overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-indigo-500 rounded-r-md"></div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500">
              Promedio Pagado / Día
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-indigo-950 mt-3 tabular-nums">
            {formatMoney(metrics.totalBud / (parseInt(period, 10) || 1))}
          </div>
          <div className="text-xs text-slate-500 mt-1.5 truncate">
            {period === "hoy" ? "Gasto del día actual" : `Promedio en periodo de ${period} días`}
          </div>
        </div>

        {/* KPI 4: Campañas Activas / En Riesgo */}
        <div className="relative bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition group overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-amber-500 rounded-r-md"></div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500">
              Estado de Campañas
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Activity size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-3 tabular-nums">
            {metrics.activeCount} <span className="text-sm font-semibold text-slate-500">activas</span>
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            {metrics.pausedCount > 0 ? `${metrics.pausedCount} pausadas · ` : ""}{metrics.risk > 0 ? `${metrics.risk} en riesgo` : "Todas saludables"}
          </div>
        </div>
      </div>

      {/* Detalle de Anuncios y Métricas de Rendimiento (Pestañas: Tabla de Anuncios vs Gráfico de Evolución de Líneas) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm space-y-0">
        {/* Header con Pestañas Principales */}
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              Detalle de Anuncios y Métricas de Rendimiento
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Consulta la tabla general de campañas o visualiza la gráfica de líneas de evolución día a día.
            </p>
          </div>

          {/* Selector de Pestaña */}
          <div className="inline-flex bg-slate-200/80 p-1 rounded-xl border border-slate-300 flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setDetailTab("tabla")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                detailTab === "tabla"
                  ? "bg-purple-900 text-white shadow-sm"
                  : "text-slate-700 hover:text-slate-950 hover:bg-white/50"
              }`}
            >
              <Table size={15} />
              Tabla de Anuncios ({sortedRows.length})
            </button>
            <button
              type="button"
              onClick={() => setDetailTab("grafico")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                detailTab === "grafico"
                  ? "bg-purple-900 text-white shadow-sm"
                  : "text-slate-700 hover:text-slate-950 hover:bg-white/50"
              }`}
            >
              <TrendingUp size={15} />
              Gráfico de Evolución & Crecimiento
            </button>
          </div>
        </div>

        {/* PESTAÑA 1: TABLA GENERAL DE ANUNCIOS */}
        {detailTab === "tabla" ? (
          <div>
            {/* Controles de la Tabla */}
            <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/30">
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

            {/* Tabla de Anuncios */}
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
        ) : (
          /* PESTAÑA 2: GRÁFICO COMPARATIVO Y EVOLUCIÓN DÍA A DÍA */
          <div className="p-5 space-y-6 bg-white">
            {/* Barra de Control Compacta y Unificada: Métrica + Filtros de Anuncios */}
            <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
              {/* Selector de Métrica */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider hidden sm:inline mr-0.5">
                  Métrica:
                </span>
                <div className="inline-flex bg-white p-0.5 rounded-xl border border-purple-200/80 shadow-2xs flex-wrap gap-0.5">
                  <button
                    type="button"
                    onClick={() => setCompareMetric("acumulado")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      compareMetric === "acumulado"
                        ? "bg-purple-900 text-white shadow-2xs"
                        : "text-slate-600 hover:text-purple-950 hover:bg-slate-100"
                    }`}
                  >
                    <TrendingUp size={12} />
                    <span>📈 Acumulado</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompareMetric("conversaciones")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      compareMetric === "conversaciones"
                        ? "bg-indigo-900 text-white shadow-2xs"
                        : "text-slate-600 hover:text-indigo-950 hover:bg-slate-100"
                    }`}
                  >
                    <MessageSquare size={12} />
                    <span>💬 Contactos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompareMetric("crecimiento_pct")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      compareMetric === "crecimiento_pct"
                        ? "bg-blue-800 text-white shadow-2xs"
                        : "text-slate-600 hover:text-blue-950 hover:bg-slate-100"
                    }`}
                  >
                    <Zap size={12} />
                    <span>🚀 % Crecimiento</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompareMetric("costo")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      compareMetric === "costo"
                        ? "bg-emerald-800 text-white shadow-2xs"
                        : "text-slate-600 hover:text-emerald-950 hover:bg-slate-100"
                    }`}
                  >
                    <Target size={12} />
                    <span>🎯 Costo/Conv</span>
                  </button>
                </div>
              </div>

              {/* Botones de acción rápida y Dropdown de Anuncios */}
              <div className="flex items-center gap-1.5 flex-wrap ml-auto relative">
                <button
                  type="button"
                  onClick={() => setSelectedAdsToCompare(currentRows.map((r) => r.a))}
                  className="px-2.5 py-1.5 bg-white hover:bg-purple-50 text-purple-900 text-xs font-bold rounded-xl border border-purple-200 shadow-2xs transition cursor-pointer flex items-center gap-1"
                  title="Seleccionar todos los anuncios"
                >
                  <CheckCircle2 size={12} className="text-purple-600" />
                  <span>Todos ({currentRows.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const top3 = [...currentRows]
                      .sort((a, b) => (b.ct || 0) - (a.ct || 0))
                      .slice(0, 3)
                      .map((r) => r.a);
                    setSelectedAdsToCompare(top3);
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-purple-50 text-purple-800 text-xs font-bold rounded-xl border border-purple-200 shadow-2xs transition cursor-pointer flex items-center gap-1"
                  title="Comparar Top 3 anuncios con más contactos"
                >
                  <Trophy size={12} className="text-amber-500" />
                  <span>Top 3</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowMilestones(!showMilestones)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1 ${
                    showMilestones
                      ? "bg-purple-900 text-white border-purple-900 shadow-2xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                  title="Alternar marcas de inicio de campaña e incrementos de presupuesto"
                >
                  <Sparkles size={12} className={showMilestones ? "text-amber-300" : "text-purple-600"} />
                  <span>{showMilestones ? "Marcas ON" : "Marcas OFF"}</span>
                </button>

                {/* Dropdown Popover de Filtrado de Anuncios */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsAdsFilterOpen(!isAdsFilterOpen)}
                    className="px-3 py-1.5 bg-purple-100/70 hover:bg-purple-200/80 text-purple-950 text-xs font-extrabold rounded-xl border border-purple-300 shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Filter size={12} className="text-purple-700" />
                    <span>Anuncios ({selectedAdsToCompare.length}/{currentRows.length})</span>
                    <ChevronDown size={12} className={`transition-transform duration-200 ${isAdsFilterOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isAdsFilterOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-white rounded-2xl border border-purple-200 shadow-2xl z-50 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-extrabold text-slate-900">
                          Filtrar Anuncios en Gráfica
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedAdsToCompare(currentRows.map((r) => r.a))}
                            className="text-[11px] text-purple-700 hover:underline font-bold cursor-pointer"
                          >
                            Todos
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => setSelectedAdsToCompare([currentRows[0]?.a].filter(Boolean))}
                            className="text-[11px] text-slate-500 hover:underline cursor-pointer"
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAdsFilterOpen(false)}
                            className="text-slate-400 hover:text-slate-700 p-0.5 rounded-lg ml-1 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Lista de Anuncios con Checkbox */}
                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 space-y-1 pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-purple-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                        {currentRows.map((row) => {
                          const isSelected = selectedAdsToCompare.includes(row.a);
                          const colorObj = adColorMap[row.a] || AD_COLORS[0];
                          const activeDays = getActiveDays(row);

                          return (
                            <label
                              key={row.a}
                              className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-xl hover:bg-purple-50/50 cursor-pointer text-xs select-none"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleAdComparison(row.a)}
                                  className="w-3.5 h-3.5 text-purple-600 rounded border-slate-300 focus:ring-purple-500 accent-purple-600 cursor-pointer flex-shrink-0"
                                />
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: colorObj.stroke }}
                                />
                                <span className={`truncate ${isSelected ? "font-bold text-slate-900" : "text-slate-400"}`}>
                                  {row.a}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0 text-[10px] text-slate-500">
                                <span className="font-bold text-purple-950 bg-purple-50 px-1.5 py-0.5 rounded">
                                  {row.ct || 0} conv
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Leyenda Horizontal Ultra-Compacta (1 sola fila desplazable con pills finas y limpias) */}
            <div className="relative flex items-center gap-1.5 overflow-x-auto py-1 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex-shrink-0 mr-1">
                Leyenda:
              </span>
              {currentRows.map((row) => {
                const isSelected = selectedAdsToCompare.includes(row.a);
                const colorObj = adColorMap[row.a] || AD_COLORS[0];
                const isHovered = hoveredAdName === row.a;
                const activeDays = getActiveDays(row);

                return (
                  <button
                    key={row.a}
                    type="button"
                    onClick={() => toggleAdComparison(row.a)}
                    onMouseEnter={() => setHoveredAdName(row.a)}
                    onMouseLeave={() => setHoveredAdName(null)}
                    title={`${row.a} • ${row.ct || 0} conv • $${(row.cc || 0).toFixed(2)}/c ${activeDays ? `• ${activeDays}d activa` : ""}`}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition border cursor-pointer select-none flex-shrink-0 whitespace-nowrap ${
                      isSelected
                        ? "bg-white text-slate-800 border-slate-300 shadow-2xs ring-1 ring-slate-200/80 hover:border-purple-300"
                        : "bg-slate-100/70 text-slate-400 border-slate-200 opacity-40 hover:opacity-75"
                    } ${isHovered && isSelected ? "ring-2 ring-purple-600 scale-[1.02]" : ""}`}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: isSelected ? colorObj.stroke : "#cbd5e1",
                      }}
                    />
                    <span className="max-w-[120px] sm:max-w-[170px] truncate font-semibold">
                      {row.a}
                    </span>
                    <span className="text-[10px] text-purple-900 font-extrabold bg-purple-50 px-1 py-0.2 rounded">
                      {row.ct || 0}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ÁREA DE GRÁFICO DINÁMICO */}
            <div className="p-5 bg-gradient-to-b from-slate-50/80 to-slate-100/50 rounded-2xl border border-slate-200/90 shadow-inner">
              {multiSeriesData.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 mx-auto flex items-center justify-center">
                    <TrendingUp size={24} />
                  </div>
                  <p className="font-bold text-slate-800 text-sm">
                    No hay anuncios seleccionados
                  </p>
                  <p className="text-slate-500 max-w-sm mx-auto">
                    Selecciona uno o más anuncios en las tarjetas superiores para visualizar la gráfica comparativa.
                  </p>
                </div>
              ) : period === "hoy" || (multiSeriesData[0]?.daily?.length || 0) <= 1 ? (
                /* VISTA ELEGANTE PARA EL PERIODO 'HOY' (COMPARATIVA HORIZONTAL DIRECTA) */
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        <Flame size={16} className="text-amber-500" />
                        Rendimiento Comparativo de Hoy (24h)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Comparación directa de cada anuncio en el día actual con fecha de inicio.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-purple-800 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                      {multiSeriesData.length} anuncios activos hoy
                    </span>
                  </div>

                  {(() => {
                    const sortedByActiveMetric = [...multiSeriesData].sort((a, b) => {
                      if (compareMetric === "costo") {
                        if (a.costPerContact === 0 && b.costPerContact > 0) return 1;
                        if (b.costPerContact === 0 && a.costPerContact > 0) return -1;
                        return a.costPerContact - b.costPerContact;
                      }
                      return b.totalContacts - a.totalContacts;
                    });

                    const maxCt = Math.max(...sortedByActiveMetric.map((s) => s.totalContacts), 1);
                    const maxCpa = Math.max(...sortedByActiveMetric.map((s) => s.costPerContact), 1);

                    return (
                      <div className="space-y-3 pt-1">
                        {sortedByActiveMetric.map((series, idx) => {
                          const row = series.row;
                          const color = series.color;
                          const isHovered = hoveredAdName === series.adName;
                          const ctRatio = Math.max(0.06, series.totalContacts / maxCt);
                          const st = getCampaignStatus(row);
                          const rankInfo = RANK_CONFIG[getAdStatus(row)] || RANK_CONFIG["Aceptable"];

                          let mainValText = `${series.totalContacts} conversaciones`;
                          let barRatio = ctRatio;
                          if (compareMetric === "costo") {
                            barRatio = Math.max(0.08, series.costPerContact / maxCpa);
                            mainValText = `$${series.costPerContact.toFixed(2)} por conv`;
                          } else if (compareMetric === "conversaciones") {
                            mainValText = `${series.totalContacts} contactos hoy`;
                          }

                          return (
                            <div
                              key={series.adName}
                              onMouseEnter={() => setHoveredAdName(series.adName)}
                              onMouseLeave={() => setHoveredAdName(null)}
                              className={`p-3.5 bg-white rounded-xl border transition-all ${
                                isHovered
                                  ? "border-purple-400 shadow-md ring-2 ring-purple-500/20"
                                  : "border-slate-200/80 shadow-2xs hover:border-slate-300"
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span
                                    className="w-6 h-6 rounded-lg text-white font-extrabold text-xs flex items-center justify-center flex-shrink-0 shadow-2xs"
                                    style={{ backgroundColor: color }}
                                  >
                                    #{idx + 1}
                                  </span>
                                  <span className="font-bold text-xs sm:text-sm text-slate-900 truncate" title={series.adName}>
                                    {series.adName}
                                  </span>
                                  <span
                                    className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.badgeCls}`}
                                  >
                                    {st.isPaused ? "Pausada" : "Activa"}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                    🚀 {series.activeDaysCount} {series.activeDaysCount === 1 ? "día activa" : "días activa"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                                  <span className="font-extrabold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                    {mainValText}
                                  </span>
                                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${rankInfo.cls}`}>
                                    {getAdStatus(row)}
                                  </span>
                                </div>
                              </div>

                              {/* Barra de progreso visual con gradiente */}
                              <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden p-0.5 border border-slate-200/70 shadow-inner">
                                <div
                                  className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                                  style={{
                                    width: `${Math.round(barRatio * 100)}%`,
                                    backgroundColor: color,
                                    boxShadow: `0 2px 8px ${color}55`,
                                  }}
                                >
                                  {barRatio > 0.3 && (
                                    <span className="text-[9px] font-extrabold text-white select-none drop-shadow-xs">
                                      {series.totalContacts} conv
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Sub-métricas informativas */}
                              <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 flex-wrap">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span>
                                    💰 Gasto Hoy: <b className="text-slate-800 font-bold">${series.totalSpent.toFixed(2)}</b>
                                  </span>
                                  <span>
                                    🏷️ Costo/Conv:{" "}
                                    <b
                                      className={
                                        series.costPerContact <= (investmentAnalysis.averageCpa || 2.0)
                                          ? "text-emerald-700 font-bold"
                                          : "text-rose-700 font-bold"
                                      }
                                    >
                                      ${series.costPerContact.toFixed(2)}
                                    </b>
                                  </span>
                                  <span>
                                    📊 CTR: <b className="text-slate-700 font-bold">{row.ctr || "—"}</b>
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {Math.round((series.totalContacts / (investmentAnalysis.totalContacts || 1)) * 100)}% de los contactos de hoy
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* VISTA MULTILÍNEA CURVA (SPLINE BEZIER) CON MARCADORES DE INICIO Y AUMENTO DE PRESUPUESTO */
                (() => {
                  const firstSeries = multiSeriesData[0]?.daily || [];
                  const N = firstSeries.length;
                  if (N === 0) return null;

                  const W = 880;
                  const H = 320;
                  const padL = 65;
                  const padR = 35;
                  const padT = 40;
                  const padB = 45;
                  const chartW = W - padL - padR;
                  const chartH = H - padT - padB;

                  // Calcular valores máximos según la métrica seleccionada
                  let maxVal = 1;
                  if (compareMetric === "acumulado") {
                    let maxFound = 0;
                    multiSeriesData.forEach((s) => {
                      s.daily.forEach((d) => {
                        if (d.cumCt > maxFound) maxFound = d.cumCt;
                      });
                    });
                    maxVal = Math.max(maxFound, 5);
                  } else if (compareMetric === "conversaciones") {
                    let maxFound = 0;
                    multiSeriesData.forEach((s) => {
                      s.daily.forEach((d) => {
                        if (d.ct > maxFound) maxFound = d.ct;
                      });
                    });
                    maxVal = Math.max(maxFound, 5);
                  } else if (compareMetric === "crecimiento_pct") {
                    let maxFound = 0;
                    multiSeriesData.forEach((s) => {
                      s.daily.forEach((d) => {
                        const gr = d.growthRateCt || 0;
                        if (gr > maxFound) maxFound = gr;
                      });
                    });
                    maxVal = Math.max(maxFound, 20);
                  } else {
                    let maxFound = 0;
                    multiSeriesData.forEach((s) => {
                      s.daily.forEach((d) => {
                        if (d.cc > maxFound) maxFound = d.cc;
                      });
                    });
                    maxVal = Math.max(maxFound, 1);
                  }

                  const getVal = (d: DailyEvolutionItem) => {
                    if (compareMetric === "acumulado") return d.cumCt;
                    if (compareMetric === "conversaciones") return d.ct;
                    if (compareMetric === "crecimiento_pct") return Math.max(0, d.growthRateCt || 0);
                    return d.cc;
                  };

                  return (
                    <div className="relative overflow-x-auto">
                      <svg className="w-full h-88 overflow-visible" viewBox={`0 0 ${W} ${H}`}>
                        <defs>
                          {multiSeriesData.map((series) => (
                            <linearGradient
                              key={`grad-${series.adName}`}
                              id={`area-grad-${series.adName.replace(/[^a-zA-Z0-9]/g, "-")}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop offset="0%" stopColor={series.color} stopOpacity="0.25" />
                              <stop offset="100%" stopColor={series.color} stopOpacity="0.0" />
                            </linearGradient>
                          ))}
                        </defs>

                        {/* Eje Y y Guías Horizontales con Líneas Suaves */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                          const y = padT + chartH * (1 - ratio);
                          let labelVal = "";
                          if (compareMetric === "acumulado") {
                            labelVal = `${Math.round(maxVal * ratio)} acum`;
                          } else if (compareMetric === "conversaciones") {
                            labelVal = `${Math.round(maxVal * ratio)} conv`;
                          } else if (compareMetric === "crecimiento_pct") {
                            labelVal = `+${Math.round(maxVal * ratio)}%`;
                          } else {
                            labelVal = `$${(maxVal * ratio).toFixed(2)}`;
                          }

                          return (
                            <g key={idx}>
                              <line
                                x1={padL}
                                y1={y}
                                x2={padL + chartW}
                                y2={y}
                                stroke="#e2e8f0"
                                strokeDasharray="3 3"
                                strokeWidth="1"
                              />
                              <text
                                x={padL - 10}
                                y={y + 3.5}
                                textAnchor="end"
                                className="text-[10.5px] fill-slate-500 font-bold select-none"
                              >
                                {labelVal}
                              </text>
                            </g>
                          );
                        })}

                        {/* Eje X y Líneas Verticales Guía de Días */}
                        {firstSeries.map((item, idx) => {
                          const x = padL + (idx / (N - 1 || 1)) * chartW;
                          return (
                            <g key={idx}>
                              <line
                                x1={x}
                                y1={padT}
                                x2={x}
                                y2={padT + chartH}
                                stroke="#f1f5f9"
                                strokeWidth="1"
                              />
                              <text
                                x={x}
                                y={padT + chartH + 20}
                                textAnchor="middle"
                                className="text-[10px] font-extrabold fill-slate-600 select-none"
                              >
                                {item.dia.replace(" (Hoy)", "")}
                                {item.dia.includes("Hoy") ? " (Hoy)" : ""}
                              </text>
                            </g>
                          );
                        })}

                        {/* Curvas Bezier Suaves por cada Anuncio Seleccionado */}
                        {multiSeriesData.map((series) => {
                          const pts = series.daily.map((d, i) => {
                            const x = padL + (i / (N - 1 || 1)) * chartW;
                            const val = getVal(d);
                            const y = padT + chartH - (val / maxVal) * chartH;
                            return { x, y, data: d, dayIndex: i };
                          });

                          const pathD = generateSmoothPath(pts);
                          const areaD = generateSmoothAreaPath(pts, padT + chartH);
                          const isHovered = hoveredAdName === series.adName;
                          const hasAnyHover = hoveredAdName !== null;
                          const strokeOpacity = hasAnyHover ? (isHovered ? 1 : 0.22) : 0.95;
                          const strokeWidth = isHovered ? 4 : 2.75;

                          return (
                            <g
                              key={series.adName}
                              onMouseEnter={() => setHoveredAdName(series.adName)}
                              onMouseLeave={() => setHoveredAdName(null)}
                              className="transition-all"
                            >
                              {/* Relleno translúcido si está con hover */}
                              {isHovered && (
                                <path
                                  d={areaD}
                                  fill={`url(#area-grad-${series.adName.replace(/[^a-zA-Z0-9]/g, "-")})`}
                                  className="transition-opacity duration-300 pointer-events-none"
                                />
                              )}

                              {/* Línea Bezier continua */}
                              <path
                                d={pathD}
                                fill="none"
                                stroke={series.color}
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeOpacity={strokeOpacity}
                                className="transition-all duration-200 cursor-pointer"
                              />

                              {/* MARCADOR DE INICIO / LANZAMIENTO DEL ANUNCIO */}
                              {showMilestones && (() => {
                                const startPt = pts.find((p) => p.data.isStartDay) || pts[0];
                                if (!startPt) return null;

                                const shouldShow = !hasAnyHover || isHovered || multiSeriesData.length <= 3;
                                if (!shouldShow) return null;

                                const pillY = Math.max(padT - 22, startPt.y - 28);

                                return (
                                  <g key={`start-marker-${series.adName}`} className="pointer-events-none">
                                    {/* Línea guía vertical hasta el eje */}
                                    <line
                                      x1={startPt.x}
                                      y1={startPt.y}
                                      x2={startPt.x}
                                      y2={padT + chartH}
                                      stroke={series.color}
                                      strokeWidth="1.5"
                                      strokeDasharray="2 3"
                                      strokeOpacity={isHovered ? 0.9 : 0.45}
                                    />

                                    {/* Anillo de halo de inicio */}
                                    <circle
                                      cx={startPt.x}
                                      cy={startPt.y}
                                      r={isHovered ? 9 : 7}
                                      fill="none"
                                      stroke={series.color}
                                      strokeWidth="2"
                                      strokeDasharray="2 2"
                                      className="animate-spin-slow"
                                    />

                                    {/* Pill flotante de Inicio */}
                                    <rect
                                      x={startPt.x - 42}
                                      y={pillY}
                                      width="84"
                                      height="20"
                                      rx="10"
                                      fill="#0f172a"
                                      stroke={series.color}
                                      strokeWidth="1.5"
                                      filter="drop-shadow(0 4px 6px rgba(0,0,0,0.3))"
                                    />
                                    <text
                                      x={startPt.x}
                                      y={pillY + 13.5}
                                      textAnchor="middle"
                                      fill="#ffffff"
                                      fontSize="9"
                                      fontWeight="bold"
                                    >
                                      🚀 Inicio ({series.activeDaysCount}d)
                                    </text>
                                  </g>
                                );
                              })()}

                              {/* MARCADORES DE INCREMENTOS DE PRESUPUESTO */}
                              {showMilestones && pts.map((pt, i) => {
                                if (!pt.data.isBudgetIncrease || !pt.data.budgetIncrease) return null;

                                const shouldShow = !hasAnyHover || isHovered || multiSeriesData.length <= 3;
                                if (!shouldShow) return null;

                                const incY = Math.max(padT - 20, pt.y - 22);

                                return (
                                  <g key={`budget-inc-${series.adName}-${i}`} className="pointer-events-none">
                                    {/* Badge con flecha y monto de aumento */}
                                    <rect
                                      x={pt.x - 26}
                                      y={incY}
                                      width="52"
                                      height="17"
                                      rx="8.5"
                                      fill="#059669"
                                      stroke="#ffffff"
                                      strokeWidth="1.5"
                                      filter="drop-shadow(0 3px 5px rgba(0,0,0,0.25))"
                                    />
                                    <text
                                      x={pt.x}
                                      y={incY + 11.5}
                                      textAnchor="middle"
                                      fill="#ffffff"
                                      fontSize="8.5"
                                      fontWeight="900"
                                    >
                                      ⚡+${pt.data.budgetIncrease.toFixed(2)}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* Puntos Interactivos en la Línea */}
                              {pts.map((pt, i) => {
                                const d = pt.data;
                                const isPointHovered =
                                  hoveredComparePoint?.adName === series.adName &&
                                  hoveredComparePoint?.dayIndex === i;

                                return (
                                  <g
                                    key={i}
                                    className="cursor-pointer"
                                    onMouseEnter={() => {
                                      setHoveredAdName(series.adName);
                                      setHoveredComparePoint({
                                        adName: series.adName,
                                        color: series.color,
                                        dayIndex: i,
                                        dia: d.dia,
                                        ct: d.ct,
                                        b: d.b,
                                        cc: d.cc,
                                        cumCt: d.cumCt,
                                        cumB: d.cumB,
                                        cumCc: d.cumCc,
                                        growthRateCt: d.growthRateCt || 0,
                                        isStartDay: d.isStartDay,
                                        isBudgetIncrease: d.isBudgetIncrease,
                                        budgetIncrease: d.budgetIncrease,
                                        budgetIncreasePct: d.budgetIncreasePct,
                                        activeDaysCount: series.activeDaysCount,
                                        x: pt.x,
                                        y: pt.y,
                                      });
                                    }}
                                    onMouseLeave={() => {
                                      setHoveredComparePoint(null);
                                    }}
                                  >
                                    <circle
                                      cx={pt.x}
                                      cy={pt.y}
                                      r={isPointHovered ? 8.5 : d.isStartDay ? 6 : isHovered ? 5.5 : 4}
                                      fill={d.isStartDay ? series.color : "#ffffff"}
                                      stroke={d.isStartDay ? "#ffffff" : series.color}
                                      strokeWidth={isPointHovered ? 3.5 : 2.5}
                                      strokeOpacity={strokeOpacity}
                                      className="transition-all duration-150 shadow-sm"
                                    />
                                  </g>
                                );
                              })}
                            </g>
                          );
                        })}

                        {/* Tooltip Dinámico Flotante Premium con Hitos de Lanzamiento y Presupuesto */}
                        {hoveredComparePoint && (() => {
                          const {
                            adName,
                            color,
                            dia,
                            ct,
                            b,
                            cc,
                            cumCt,
                            cumB,
                            cumCc,
                            growthRateCt,
                            isStartDay,
                            isBudgetIncrease,
                            budgetIncrease,
                            budgetIncreasePct,
                            activeDaysCount,
                            x,
                            y,
                          } = hoveredComparePoint;

                          const hasSpecialRow = isStartDay || isBudgetIncrease;
                          const tipW = 230;
                          const tipH = hasSpecialRow ? 116 : 98;
                          const tipX = Math.max(10, Math.min(W - tipW - 10, x - tipW / 2));
                          const tipY = Math.max(8, y - tipH - 16);

                          return (
                            <g className="pointer-events-none">
                              <rect
                                x={tipX}
                                y={tipY}
                                width={tipW}
                                height={tipH}
                                rx="12"
                                fill="#0f172a"
                                stroke={color}
                                strokeWidth="2"
                                filter="drop-shadow(0 8px 16px rgba(0,0,0,0.45))"
                              />
                              <text x={tipX + 12} y={tipY + 17} fill="#ffffff" fontSize="11" fontWeight="bold">
                                {adName.length > 26 ? adName.slice(0, 24) + "..." : adName}
                              </text>
                              <text x={tipX + 12} y={tipY + 32} fill="#94a3b8" fontSize="9.5">
                                📅 Fecha: {dia}
                              </text>

                              {/* Hito especial en Tooltip */}
                              {isStartDay && (
                                <text x={tipX + 12} y={tipY + 47} fill="#38bdf8" fontSize="10" fontWeight="bold">
                                  🚀 INICIO DE CAMPAÑA ({activeDaysCount}d activa)
                                </text>
                              )}
                              {isBudgetIncrease && !isStartDay && (
                                <text x={tipX + 12} y={tipY + 47} fill="#34d399" fontSize="10" fontWeight="bold">
                                  ⚡ Aumento Presupuesto: +${budgetIncrease?.toFixed(2)} (+{budgetIncreasePct}%)
                                </text>
                              )}

                              <text
                                x={tipX + 12}
                                y={tipY + (hasSpecialRow ? 63 : 48)}
                                fill="#c084fc"
                                fontSize="10.5"
                                fontWeight="bold"
                              >
                                📈 Acumulado: {cumCt} conv (${cumB.toFixed(2)} gasto)
                              </text>
                              <text
                                x={tipX + 12}
                                y={tipY + (hasSpecialRow ? 79 : 64)}
                                fill="#6ee7b7"
                                fontSize="10"
                              >
                                💬 Día: {ct} conv · ${b.toFixed(2)} gasto (${cc.toFixed(2)}/c)
                              </text>
                              <text
                                x={tipX + 12}
                                y={tipY + (hasSpecialRow ? 95 : 80)}
                                fill="#38bdf8"
                                fontSize="10"
                                fontWeight="bold"
                              >
                                🚀 Crecimiento: +{growthRateCt}% · Prom: ${cumCc.toFixed(2)}/c
                              </text>
                            </g>
                          );
                        })()}
                      </svg>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )}
      </div>

        </>
      )}

      {/* Pie de Página con resumen */}
      <div className="text-center text-xs text-slate-500 py-2 border-t border-slate-200/60">
        Periodo de {period} días · {currentRows.length} campañas analizadas · Veredicto automático calculado por costo por contacto y CTR
      </div>
    </div>
  );
}
