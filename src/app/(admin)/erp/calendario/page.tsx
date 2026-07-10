import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatTimeLocal } from "@/lib/availability";
import { ChevronLeft, ChevronRight, Calendar, LayoutGrid, Plus } from "lucide-react";
import { hasPermission } from "@/lib/roles";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";

export const dynamic = "force-dynamic";

interface SearchParams { view?: string; date?: string }

// ── Helpers ────────────────────────────────────────────────────────────────

function parseDate(s?: string): Date {
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  // Sin param: usar la fecha de HOY en Ecuador (UTC-5)
  const ecToday = new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
  const [y, m, d] = ecToday.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mondayOf(d: Date): Date {
  const date = new Date(d);
  const diff = date.getDay() === 0 ? -6 : 1 - date.getDay();
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

const STATUS_COLOR: Record<string, string> = {
  cancelled: "bg-red-50 text-red-700 line-through",
  attended:  "bg-green-50 text-green-700",
  no_show:   "bg-amber-50 text-amber-700",
  scheduled: "bg-lilac-50 text-lilac-800",
};

export default async function CalendarioPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await searchParamsPromise;
  const view    = searchParams.view ?? "month"; // "month" | "week"
  const base    = parseDate(searchParams.date);
  const supabase = createAdminClient();

  // ── Rango de fechas según vista ────────────────────────────────────────
  let rangeStart: Date, rangeEnd: Date;
  let prevDate: Date, nextDate: Date;
  let title: string;

  if (view === "week") {
    rangeStart = mondayOf(base);
    rangeEnd   = new Date(rangeStart); rangeEnd.setDate(rangeEnd.getDate() + 6); rangeEnd.setHours(23, 59, 59);
    prevDate   = new Date(rangeStart); prevDate.setDate(prevDate.getDate() - 7);
    nextDate   = new Date(rangeStart); nextDate.setDate(nextDate.getDate() + 7);
    title = `${rangeStart.toLocaleDateString("es-EC", { day: "numeric", month: "long" })} — ${rangeEnd.toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })}`;
  } else {
    // Month view
    rangeStart = new Date(base.getFullYear(), base.getMonth(), 1);
    rangeEnd   = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59);
    prevDate   = new Date(base.getFullYear(), base.getMonth() - 1, 1);
    nextDate   = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    title = base.toLocaleDateString("es-EC", { month: "long", year: "numeric" })
      .replace(/^./, s => s.toUpperCase());
  }

  // ── Cargar citas y permisos en paralelo ──────────────────────────────────
  const [authData, apptsRes] = await Promise.all([
    getCachedUserAndPermissions(),
    supabase
      .from("appointments")
      .select("id, starts_at, status, patient:patients(full_name), dental_consultation:dental_consultations(id)")
      .gte("starts_at", rangeStart.toISOString())
      .lte("starts_at", rangeEnd.toISOString())
      .order("starts_at")
  ]);

  const { role, allowedPaths } = authData;
  const canModify = hasPermission(role, "/erp/calendario/modificar", allowedPaths);
  const appts = apptsRes.data;

  // Agrupar por YYYY-MM-DD local
  const byDay = new Map<string, typeof appts>();
  for (const a of appts || []) {
    const d = new Date(a.starts_at);
    const key = fmtDate(d);
    if (!byDay.has(key)) byDay.set(key, [] as any);
    (byDay.get(key) as any[]).push(a);
  }

  // "Hoy" siempre calculado en timezone Ecuador
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });

  // ── Renderizar citas de un día ─────────────────────────────────────────
  function ApptList({ dateStr, max }: { dateStr: string; max: number }) {
    const list = byDay.get(dateStr) || [];
    if (list.length === 0) return null;
    const shown = list.slice(0, max);
    const extra = list.length - max;
    return (
      <ul className="space-y-0.5 mt-1">
        {(shown as any[]).map((a) => {
          const p = Array.isArray(a.patient) ? a.patient[0] : a.patient;
          const color = STATUS_COLOR[a.status] ?? STATUS_COLOR.scheduled;
          return (
            <li key={a.id}>
              <Link href={`/erp/citas/${a.id}`}
                className={`block rounded px-1.5 py-0.5 text-[11px] leading-tight truncate ${color} hover:opacity-80`}>
                {formatTimeLocal(new Date(a.starts_at))} {p?.full_name}
              </Link>
            </li>
          );
        })}
        {extra > 0 && (
          <li className="text-[10px] text-lilac-600 font-semibold px-1">+{extra} más</li>
        )}
      </ul>
    );
  }

  // ── Vista Mensual ─────────────────────────────────────────────────────
  function MonthView() {
    // Generar días del grid: desde el lunes de la primera semana
    const firstDay   = new Date(base.getFullYear(), base.getMonth(), 1);
    const gridStart  = mondayOf(firstDay);
    // Terminar en el domingo que cubra el último día del mes
    const lastDay    = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    const gridEnd    = new Date(mondayOf(lastDay));
    gridEnd.setDate(gridEnd.getDate() + 6);

    const days: Date[] = [];
    const cur = new Date(gridStart);
    while (cur <= gridEnd) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }

    const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

    return (
      <div>
        {/* Cabecera días semana */}
        <div className="grid grid-cols-7 mb-1">
          {WEEK_DAYS.map(d => (
            <div key={d} className="text-center text-[11px] font-bold text-ink-400 uppercase py-1">{d}</div>
          ))}
        </div>
        {/* Grid de días */}
        <div className="grid grid-cols-7 gap-0.5">
          {days.map(d => {
            const str      = fmtDate(d);
            const isToday  = str === todayStr;
            const inMonth  = d.getMonth() === base.getMonth();
            const hasAppts = (byDay.get(str) || []).length > 0;
            return (
              <div key={str}
                className={`min-h-[90px] rounded-xl p-1.5 border transition-colors ${
                  isToday   ? "border-lilac-500 bg-lilac-50" :
                  !inMonth  ? "border-transparent bg-gray-50/50" :
                  hasAppts  ? "border-lilac-100 bg-white" :
                              "border-gray-100 bg-white"
                }`}>
                <div className="flex items-center justify-between mb-0.5">
                  <div className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? "bg-lilac-600 text-white" : inMonth ? "text-ink-800" : "text-ink-300"
                  }`}>
                    {d.getDate()}
                  </div>
                  {inMonth && canModify && (
                    <Link href={`/erp/citas/nueva?date=${str}`}
                      className="p-1 text-lilac-400 hover:text-lilac-700 hover:bg-lilac-100 rounded-lg transition"
                      title="Añadir cita">
                      <Plus size={12} />
                    </Link>
                  )}
                </div>
                {inMonth && <ApptList dateStr={str} max={3} />}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Vista Semanal ─────────────────────────────────────────────────────
  function WeekView() {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(rangeStart); d.setDate(d.getDate() + i);
      days.push(d);
    }
    return (
      <div className="grid grid-cols-7 gap-2">
        {days.map(d => {
          const str     = fmtDate(d);
          const isToday = str === todayStr;
          return (
            <div key={str} className={`rounded-xl p-2.5 border ${isToday ? "border-lilac-500 bg-lilac-50 ring-2 ring-lilac-200" : "border-lilac-100 bg-white"}`}>
              <div className="mb-1.5">
                <div className="text-[10px] text-ink-500 uppercase font-semibold">
                  {d.toLocaleDateString("es-EC", { weekday: "short" })}
                </div>
                <div className={`text-lg font-bold ${isToday ? "text-lilac-700" : "text-ink-800"}`}>
                  {d.getDate()}
                </div>
              </div>
              {(byDay.get(str) || []).length === 0
                ? <p className="text-[11px] text-ink-400 italic">Sin citas</p>
                : <ApptList dateStr={str} max={10} />
              }
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-xl font-bold text-ink-900 capitalize">{title}</h1>

        <div className="flex items-center gap-2">
          {/* Toggle vista */}
          <div className="flex rounded-xl border border-lilac-200 overflow-hidden bg-white">
            <Link href={`/erp/calendario?view=month&date=${fmtDate(base)}`}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
                view === "month" ? "bg-lilac-600 text-white" : "text-ink-600 hover:bg-lilac-50"
              }`}>
              <LayoutGrid size={13} /> Mes
            </Link>
            <Link href={`/erp/calendario?view=week&date=${fmtDate(base)}`}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
                view === "week" ? "bg-lilac-600 text-white" : "text-ink-600 hover:bg-lilac-50"
              }`}>
              <Calendar size={13} /> Semana
            </Link>
          </div>

          {/* Navegación */}
          <Link href={`/erp/calendario?view=${view}&date=${fmtDate(prevDate)}`}
             className="w-8 h-8 flex items-center justify-center rounded-lg border border-lilac-200 hover:bg-lilac-50 transition-colors">
            <ChevronLeft size={16} />
          </Link>
          <Link href={`/erp/calendario?view=${view}&date=${new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" })}`}
            className="px-3 py-1.5 rounded-lg border border-lilac-200 text-xs font-semibold hover:bg-lilac-50 transition-colors">
            Hoy
          </Link>
          <Link href={`/erp/calendario?view=${view}&date=${fmtDate(nextDate)}`}
             className="w-8 h-8 flex items-center justify-center rounded-lg border border-lilac-200 hover:bg-lilac-50 transition-colors">
            <ChevronRight size={16} />
          </Link>
          
          {canModify && (
            <Link href={`/erp/citas/nueva?date=${fmtDate(base)}`}
              className="flex items-center gap-1.5 bg-lilac-600 text-white text-xs px-3.5 py-2 rounded-xl hover:bg-lilac-700 transition font-medium shadow-sm ml-2">
              <Plus size={14} /> Nueva Cita
            </Link>
          )}
        </div>
      </div>

      {view === "week" ? <WeekView /> : <MonthView />}
    </div>
  );
}
