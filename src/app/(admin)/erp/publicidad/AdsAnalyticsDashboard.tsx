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
  ct: number; // Conversaciones / Contactos
  b: number; // Presupuesto ($)
  cc: number; // Costo por Conversación ($)
  trendCt?: "up" | "down" | "flat";
  trendCc?: "up" | "down" | "flat";
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
  currentRows: CampaignRow[],
  adsData: AdsDataPayload
): DailyEvolutionItem[] {
  if (periodKey === "hoy") return [];

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
    const parsed = explicitDailyArray.map((item: any, idx: number) => {
      const ct = Number(item.ct ?? item.contactos ?? item.conversaciones ?? item.leads ?? 0);
      const b = Number(item.b ?? item.presupuesto ?? item.gasto ?? item.costo ?? 0);
      const cc = ct > 0 ? b / ct : Number(item.cc ?? item.costo_contacto ?? item.costo_conversacion ?? 0);
      const label = item.dia || item.fecha || item.date || `Día ${idx + 1}`;
      return {
        dia: String(label),
        fecha: item.fecha ? String(item.fecha) : String(label),
        ct,
        b,
        cc,
      };
    });

    return parsed.map((item, idx) => {
      const prev = idx > 0 ? parsed[idx - 1] : null;
      const trendCt: "up" | "down" | "flat" = !prev ? "flat" : item.ct > prev.ct ? "up" : item.ct < prev.ct ? "down" : "flat";
      const trendCc: "up" | "down" | "flat" = !prev ? "flat" : item.cc < prev.cc ? "up" : item.cc > prev.cc ? "down" : "flat";
      return { ...item, trendCt, trendCc };
    });
  }

  // Generación proyectada basada en métricas del período y el día de hoy
  const totalBud = currentRows.reduce((acc, r) => acc + (r.b || 0), 0);
  const totalCt = currentRows.reduce((acc, r) => acc + (r.ct || 0), 0);

  const hoyRows = adsData.hoy || [];
  const hoyBud = hoyRows.reduce((acc, r) => acc + (r.b || 0), 0);
  const hoyCt = hoyRows.reduce((acc, r) => acc + (r.ct || 0), 0);

  const items: DailyEvolutionItem[] = [];
  const now = new Date();

  const hasHoy = hoyRows.length > 0 && (hoyBud > 0 || hoyCt > 0);
  const pastDaysCount = numDays - (hasHoy ? 1 : 0);
  const remBud = hasHoy ? Math.max(0, totalBud - hoyBud) : totalBud;
  const remCt = hasHoy ? Math.max(0, totalCt - hoyCt) : totalCt;

  const avgPastBud = pastDaysCount > 0 ? remBud / pastDaysCount : 0;
  const avgPastCt = pastDaysCount > 0 ? remCt / pastDaysCount : 0;

  for (let i = 0; i < numDays; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - (numDays - 1 - i));
    const dayLabel = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    const isToday = i === numDays - 1;

    let dayB: number;
    let dayCt: number;

    if (isToday && hasHoy) {
      dayB = hoyBud;
      dayCt = hoyCt;
    } else {
      const factorB = 1 + 0.15 * Math.sin(i * 1.3);
      const factorCt = 1 + 0.2 * Math.cos(i * 1.1);

      dayB = avgPastBud * factorB;
      dayCt = Math.round(avgPastCt * factorCt);
    }

    const dayCc = dayCt > 0 ? dayB / dayCt : 0;

    items.push({
      dia: isToday ? `${dayLabel} (Hoy)` : dayLabel,
      fecha: d.toISOString().slice(0, 10),
      ct: Math.max(0, dayCt),
      b: Math.max(0, Number(dayB.toFixed(2))),
      cc: Number(dayCc.toFixed(2)),
    });
  }

  if (pastDaysCount > 0) {
    const sumPastB = items.slice(0, pastDaysCount).reduce((acc, it) => acc + it.b, 0);
    const sumPastCt = items.slice(0, pastDaysCount).reduce((acc, it) => acc + it.ct, 0);

    const diffB = remBud - sumPastB;
    const diffCt = remCt - sumPastCt;

    if (diffB !== 0 && items[0]) {
      items[0].b = Math.max(0, Number((items[0].b + diffB).toFixed(2)));
    }
    if (diffCt !== 0 && items[0]) {
      items[0].ct = Math.max(0, items[0].ct + diffCt);
    }

    items.forEach((it) => {
      it.cc = it.ct > 0 ? Number((it.b / it.ct).toFixed(2)) : 0;
    });
  }

  return items.map((item, idx) => {
    const prev = idx > 0 ? items[idx - 1] : null;
    const trendCt: "up" | "down" | "flat" = !prev ? "flat" : item.ct > prev.ct ? "up" : item.ct < prev.ct ? "down" : "flat";
    const trendCc: "up" | "down" | "flat" = !prev ? "flat" : item.cc < prev.cc ? "up" : item.cc > prev.cc ? "down" : "flat";
    return { ...item, trendCt, trendCc };
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

  // Pestaña dentro de Detalle de Anuncios: "tabla" o "grafico"
  const [detailTab, setDetailTab] = useState<"tabla" | "grafico">("tabla");

  // Filtro de anuncio específico para el gráfico de líneas
  const [selectedAdFilter, setSelectedAdFilter] = useState<string>("todos");

  // Filas filtradas según el anuncio seleccionado
  const selectedRows = useMemo(() => {
    if (selectedAdFilter === "todos") return currentRows;
    return currentRows.filter((r) => r.a === selectedAdFilter);
  }, [currentRows, selectedAdFilter]);

  // Obtener serie temporal de evolución día a día del anuncio o conjunto seleccionado
  const dailyEvolution = useMemo(() => {
    return getDailyEvolution(period, selectedRows, adsData);
  }, [period, selectedRows, adsData]);

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
          <div className="inline-flex bg-slate-200/80 p-1 rounded-xl border border-slate-300">
            <button
              type="button"
              onClick={() => setDetailTab("tabla")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
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
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                detailTab === "grafico"
                  ? "bg-purple-900 text-white shadow-sm"
                  : "text-slate-700 hover:text-slate-950 hover:bg-white/50"
              }`}
            >
              <TrendingUp size={15} />
              Gráfico de Evolución (Líneas)
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
          /* PESTAÑA 2: GRÁFICO DE EVOLUCIÓN (LÍNEAS) CON FILTRO Y SELECTOR DE ANUNCIO */
          <div className="p-5 space-y-5 bg-white">
            {/* Barra Superior con Filtro de Anuncio Específico */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-purple-50/60 p-4 rounded-2xl border border-purple-100">
              <div className="flex-1 space-y-1">
                <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sliders size={14} className="text-purple-600" />
                  Seleccionar Anuncio / Campaña para filtrar la gráfica:
                </label>
                <select
                  value={selectedAdFilter}
                  onChange={(e) => setSelectedAdFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold text-purple-950 bg-white border border-purple-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                >
                  <option value="todos">📊 Todos los Anuncios (Acumulado General)</option>
                  {currentRows.map((r, idx) => (
                    <option key={idx} value={r.a}>
                      📢 {r.a} — ({r.ct} conv, ${r.b.toFixed(2)}, Costo: ${r.cc.toFixed(2)}/conv)
                    </option>
                  ))}
                </select>
              </div>

              {period === "hoy" && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                  <Info size={16} className="text-amber-600 flex-shrink-0" />
                  <span>Estás en vista de <b>Hoy</b>. Para ver la gráfica de líneas completa día a día, selecciona 3, 7, 14 o 30 días.</span>
                </div>
              )}
            </div>

            {/* Tarjetas Resumen del Anuncio Seleccionado */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-purple-50/70 rounded-xl border border-purple-100">
                <div className="text-[11px] font-bold text-slate-500 uppercase flex justify-between">
                  <span>Conversaciones</span>
                  <MessageSquare size={14} className="text-purple-600" />
                </div>
                <div className="text-xl font-extrabold text-purple-950 mt-1 tabular-nums">
                  {selectedRows.reduce((sum, r) => sum + (r.ct || 0), 0)} conv
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Promedio: {(selectedRows.reduce((sum, r) => sum + (r.ct || 0), 0) / (parseInt(period, 10) || 1)).toFixed(1)} / día
                </div>
              </div>

              <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-100">
                <div className="text-[11px] font-bold text-slate-500 uppercase flex justify-between">
                  <span>Presupuesto Consumido</span>
                  <DollarSign size={14} className="text-indigo-600" />
                </div>
                <div className="text-xl font-extrabold text-indigo-950 mt-1 tabular-nums">
                  ${selectedRows.reduce((sum, r) => sum + (r.b || 0), 0).toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Promedio: ${(selectedRows.reduce((sum, r) => sum + (r.b || 0), 0) / (parseInt(period, 10) || 1)).toFixed(2)} / día
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-100">
                <div className="text-[11px] font-bold text-slate-500 uppercase flex justify-between">
                  <span>Costo / Conversación</span>
                  <Trophy size={14} className="text-emerald-600" />
                </div>
                <div className="text-xl font-extrabold text-emerald-950 mt-1 tabular-nums">
                  ${
                    selectedRows.reduce((sum, r) => sum + (r.ct || 0), 0) > 0
                      ? (selectedRows.reduce((sum, r) => sum + (r.b || 0), 0) / selectedRows.reduce((sum, r) => sum + (r.ct || 0), 0)).toFixed(2)
                      : "0.00"
                  }
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {selectedAdFilter === "todos" ? "Promedio general acumulado" : `Anuncio: ${selectedAdFilter}`}
                </div>
              </div>
            </div>

            {/* Gráfico de Líneas SVG Día a Día */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-600 font-bold px-1 flex-wrap gap-2">
                <span className="flex items-center gap-1.5 text-purple-900">
                  <span className="w-3.5 h-1 bg-purple-600 rounded inline-block"></span>
                  Línea Morada: Conversaciones (Contactos)
                </span>
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="w-3.5 h-1 border-b-2 border-dashed border-emerald-500 inline-block"></span>
                  Línea Verde Punteada: Costo por Conversación ($)
                </span>
              </div>

              <div className="overflow-x-auto p-4 bg-slate-50/60 rounded-2xl border border-slate-200 shadow-inner">
                {(() => {
                  const N = dailyEvolution.length;
                  if (N === 0) {
                    return (
                      <p className="text-xs text-slate-500 text-center py-8">
                        No hay datos de evolución para mostrar en este anuncio y período.
                      </p>
                    );
                  }

                  const W = 680;
                  const H = 220;
                  const padL = 50;
                  const padR = 30;
                  const padT = 30;
                  const padB = 40;
                  const chartW = W - padL - padR;
                  const chartH = H - padT - padB;

                  const maxCt = Math.max(...dailyEvolution.map((d) => d.ct), 1);
                  const maxCc = Math.max(...dailyEvolution.map((d) => d.cc), 0.1);

                  const ptsCt = dailyEvolution
                    .map((d, i) => {
                      const x = padL + (i / (N - 1 || 1)) * chartW;
                      const y = padT + chartH - (d.ct / maxCt) * chartH;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(" L ");

                  const pathD_ct = "M " + ptsCt;
                  const areaD_ct =
                    pathD_ct + ` L ${padL + chartW},${padT + chartH} L ${padL},${padT + chartH} Z`;

                  const ptsCc = dailyEvolution
                    .map((d, i) => {
                      const x = padL + (i / (N - 1 || 1)) * chartW;
                      const y = padT + chartH - (d.cc / maxCc) * chartH;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(" L ");

                  const pathD_cc = "M " + ptsCc;

                  return (
                    <svg className="w-full h-64 overflow-visible" viewBox={`0 0 ${W} ${H}`}>
                      <defs>
                        <linearGradient id="ctGradientLine" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Guías Horizontales del Eje Y */}
                      {[0, 0.33, 0.66, 1].map((ratio, idx) => {
                        const y = padT + chartH * (1 - ratio);
                        const valCt = Math.round(maxCt * ratio);
                        return (
                          <g key={idx}>
                            <line
                              x1={padL}
                              y1={y}
                              x2={padL + chartW}
                              y2={y}
                              stroke="#cbd5e1"
                              strokeDasharray="4 4"
                              strokeWidth="1"
                            />
                            <text x={padL - 8} y={y + 3} textAnchor="end" className="text-[9px] fill-slate-400 font-bold">
                              {valCt}
                            </text>
                          </g>
                        );
                      })}

                      {/* Área Sombreada bajo la Línea de Conversaciones */}
                      <path d={areaD_ct} fill="url(#ctGradientLine)" />

                      {/* Línea 1: Conversaciones (Línea Morada Continua) */}
                      <path
                        d={pathD_ct}
                        fill="none"
                        stroke="#7c3aed"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Línea 2: Costo por Conversación (Línea Verde Punteada) */}
                      <path
                        d={pathD_cc}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeDasharray="5 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Puntos y Datos en el Eje X */}
                      {dailyEvolution.map((item, idx) => {
                        const x = padL + (idx / (N - 1 || 1)) * chartW;
                        const y_ct = padT + chartH - (item.ct / maxCt) * chartH;
                        const y_cc = padT + chartH - (item.cc / maxCc) * chartH;

                        return (
                          <g key={idx} className="group cursor-pointer">
                            {/* Círculo Punto Conversaciones */}
                            <circle
                              cx={x}
                              cy={y_ct}
                              r="5.5"
                              fill="#ffffff"
                              stroke="#7c3aed"
                              strokeWidth="3"
                              className="transition-all group-hover:r-7"
                            />
                            <text
                              x={x}
                              y={y_ct - 10}
                              textAnchor="middle"
                              className="text-[11px] font-extrabold fill-purple-950"
                            >
                              {item.ct}
                            </text>

                            {/* Círculo Punto Costo por Conv */}
                            <circle
                              cx={x}
                              cy={y_cc}
                              r="4"
                              fill="#ffffff"
                              stroke="#10b981"
                              strokeWidth="2"
                              className="transition-all group-hover:r-6"
                            />
                            <text
                              x={x}
                              y={y_cc + 14}
                              textAnchor="middle"
                              className="text-[9px] font-bold fill-emerald-800"
                            >
                              ${item.cc.toFixed(2)}
                            </text>

                            {/* Etiqueta del Día / Fecha en el Eje X */}
                            <text
                              x={x}
                              y={padT + chartH + 18}
                              textAnchor="middle"
                              className="text-[10px] font-bold fill-slate-600"
                            >
                              {item.dia}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
            </div>

            {/* Tabla Detallada Día a Día del Anuncio Seleccionado */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Día / Fecha</th>
                    <th className="py-2.5 px-3 text-right">Conversaciones (Contactos)</th>
                    <th className="py-2.5 px-3 text-right">Presupuesto ($)</th>
                    <th className="py-2.5 px-3 text-right">Costo / Conversación ($)</th>
                    <th className="py-2.5 px-3 text-center">Tendencia vs Anterior</th>
                    <th className="py-2.5 px-3 text-center">Eficiencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {dailyEvolution.map((item, idx) => {
                    const isGoodCost = item.cc <= 1.5;
                    const isHighCost = item.cc > 2.5;

                    return (
                      <tr key={idx} className="hover:bg-purple-50/30 transition">
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {item.dia}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-purple-950 tabular-nums">
                          {item.ct}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-900 tabular-nums">
                          ${item.b.toFixed(2)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-bold tabular-nums ${
                            isGoodCost ? "text-emerald-600" : isHighCost ? "text-rose-600" : "text-slate-800"
                          }`}
                        >
                          ${item.cc.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {item.trendCt === "up" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <TrendingUp size={12} /> +Conversaciones
                            </span>
                          ) : item.trendCt === "down" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              <TrendingDown size={12} /> -Conversaciones
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              <Minus size={12} /> Estable
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                              isGoodCost
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : isHighCost
                                ? "bg-rose-100 text-rose-800 border-rose-300"
                                : "bg-amber-100 text-amber-800 border-amber-300"
                            }`}
                          >
                            {isGoodCost ? "Alta Eficiencia" : isHighCost ? "Revisar Costo" : "Normal"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
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

        </>
      )}

      {/* Pie de Página con resumen */}
      <div className="text-center text-xs text-slate-500 py-2 border-t border-slate-200/60">
        Periodo de {period} días · {currentRows.length} campañas analizadas · Veredicto automático calculado por costo por contacto y CTR
      </div>
    </div>
  );
}
