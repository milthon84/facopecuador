"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Users,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  Printer,
  Search,
  ArrowRight,
  Activity,
  CalendarDays,
  Sparkles,
  Percent,
  FileSpreadsheet,
  Award
} from "lucide-react";
import { formatTimeLocal } from "@/lib/availability";

export interface AppointmentData {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "attended" | "no_show" | "cancelled";
  reason: string | null;
  patient_id: string;
  doctor_id: string | null;
  patient: {
    id: string;
    full_name: string;
    document_number: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  doctor: {
    id: string;
    full_name: string;
    specialty: string | null;
    photo_url: string | null;
  } | null;
  dental_consultation: {
    id: string;
    treatment_notes?: string;
    created_at?: string;
  } | null;
  invoice?: {
    id: string;
    total: number;
    invoice_number: string;
    sri_status: string;
  } | null;
  billed_amount?: number;
}

export interface DoctorOption {
  id: string;
  full_name: string;
  specialty?: string | null;
  photo_url?: string | null;
}

type PeriodType = "day" | "week" | "month" | "year" | "custom";

interface Props {
  initialAppointments: AppointmentData[];
  doctors: DoctorOption[];
}

export default function DashboardClient({ initialAppointments, doctors }: Props) {
  // Period Mode
  const [period, setPeriod] = useState<PeriodType>("month");
  
  // Date anchors (Ecuador UTC-5 base)
  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
  }, []);

  const [selectedDay, setSelectedDay] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayStr.slice(0, 7)); // YYYY-MM
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Custom range
  const [customStart, setCustomStart] = useState<string>(todayStr);
  const [customEnd, setCustomEnd] = useState<string>(todayStr);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Helper date calculations
  const { dateRange, periodLabel } = useMemo(() => {
    if (period === "day") {
      const [y, m, d] = selectedDay.split("-").map(Number);
      const start = new Date(Date.UTC(y, m - 1, d, 5, 0, 0));
      const end = new Date(Date.UTC(y, m - 1, d + 1, 4, 59, 59));
      const label = new Date(selectedDay + "T12:00:00-05:00").toLocaleDateString("es-EC", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
      return { dateRange: { start, end }, periodLabel: label };
    }

    if (period === "week") {
      const [y, m, d] = selectedDay.split("-").map(Number);
      const cur = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const dayOfWeek = cur.getUTCDay(); // 0 is Sun, 1 is Mon
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      
      const mon = new Date(cur);
      mon.setUTCDate(cur.getUTCDate() + diffToMon);
      
      const sun = new Date(mon);
      sun.setUTCDate(mon.getUTCDate() + 6);

      const start = new Date(Date.UTC(mon.getUTCFullYear(), mon.getUTCMonth(), mon.getUTCDate(), 5, 0, 0));
      const end = new Date(Date.UTC(sun.getUTCFullYear(), sun.getUTCMonth(), sun.getUTCDate() + 1, 4, 59, 59));

      const label = `Semana del ${mon.getUTCDate()} ${mon.toLocaleDateString("es-EC", { month: "short" })} al ${sun.getUTCDate()} ${sun.toLocaleDateString("es-EC", { month: "short", year: "numeric" })}`;
      return { dateRange: { start, end }, periodLabel: label };
    }

    if (period === "month") {
      const [y, m] = selectedMonth.split("-").map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1, 5, 0, 0));
      const lastDay = new Date(y, m, 0).getDate();
      const end = new Date(Date.UTC(y, m - 1, lastDay + 1, 4, 59, 59));
      const label = new Date(y, m - 1, 1).toLocaleDateString("es-EC", { month: "long", year: "numeric" });
      return { dateRange: { start, end }, periodLabel: label.charAt(0).toUpperCase() + label.slice(1) };
    }

    if (period === "year") {
      const start = new Date(Date.UTC(selectedYear, 0, 1, 5, 0, 0));
      const end = new Date(Date.UTC(selectedYear, 11, 31 + 1, 4, 59, 59));
      return { dateRange: { start, end }, periodLabel: `Año ${selectedYear}` };
    }

    // Custom
    const [sy, sm, sd] = customStart.split("-").map(Number);
    const [ey, em, ed] = customEnd.split("-").map(Number);
    const start = new Date(Date.UTC(sy, sm - 1, sd, 5, 0, 0));
    const end = new Date(Date.UTC(ey, em - 1, ed + 1, 4, 59, 59));
    return { dateRange: { start, end }, periodLabel: `${customStart} a ${customEnd}` };
  }, [period, selectedDay, selectedMonth, selectedYear, customStart, customEnd]);

  // Filtered appointments by dateRange
  const periodAppointments = useMemo(() => {
    const sTime = dateRange.start.getTime();
    const eTime = dateRange.end.getTime();

    return initialAppointments.filter((a) => {
      const t = new Date(a.starts_at).getTime();
      return t >= sTime && t <= eTime;
    });
  }, [initialAppointments, dateRange]);

  // Key Metrics for Period
  const stats = useMemo(() => {
    const total = periodAppointments.length;
    const attended = periodAppointments.filter((a) => a.status === "attended").length;
    const scheduled = periodAppointments.filter((a) => a.status === "scheduled").length;
    const noShow = periodAppointments.filter((a) => a.status === "no_show").length;
    const cancelled = periodAppointments.filter((a) => a.status === "cancelled").length;

    const completedConsultations = periodAppointments.filter((a) => {
      return a.status === "attended" && a.dental_consultation;
    }).length;

    let totalBilled = 0;
    let billedInvoicesCount = 0;

    periodAppointments.forEach((a) => {
      const b = Number(a.billed_amount || a.invoice?.total || 0);
      if (b > 0) {
        totalBilled += b;
        billedInvoicesCount++;
      }
    });

    const formattedTotalBilled = new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: "USD",
    }).format(totalBilled);

    const attendedPct = total > 0 ? Math.round((attended / total) * 100) : 0;
    const lossPct = total > 0 ? Math.round(((noShow + cancelled) / total) * 100) : 0;

    // Unique Patients
    const uniquePatientIds = new Set(periodAppointments.map((a) => a.patient_id).filter(Boolean));
    const uniquePatientsCount = uniquePatientIds.size;

    return {
      total,
      attended,
      scheduled,
      noShow,
      cancelled,
      completedConsultations,
      totalBilled,
      billedInvoicesCount,
      formattedTotalBilled,
      attendedPct,
      lossPct,
      uniquePatientsCount,
    };
  }, [periodAppointments]);

  // Doctor Breakdown Stats (Only doctors with appointments in this period)
  const doctorStats = useMemo(() => {
    const map = new Map<string, {
      doctor: DoctorOption;
      total: number;
      attended: number;
      scheduled: number;
      noShow: number;
      cancelled: number;
      consultations: number;
      billedTotal: number;
    }>();

    let unassignedTotal = 0;
    let unassignedAttended = 0;
    let unassignedBilled = 0;

    periodAppointments.forEach((a) => {
      const billed = Number(a.billed_amount || a.invoice?.total || 0);

      if (a.doctor_id) {
        if (!map.has(a.doctor_id)) {
          const docObj: DoctorOption = a.doctor || doctors.find((d) => d.id === a.doctor_id) || {
            id: a.doctor_id,
            full_name: "Doctor asignado",
            specialty: "Odontología",
          };
          map.set(a.doctor_id, {
            doctor: docObj,
            total: 0,
            attended: 0,
            scheduled: 0,
            noShow: 0,
            cancelled: 0,
            consultations: 0,
            billedTotal: 0,
          });
        }
        const item = map.get(a.doctor_id)!;
        item.total++;
        item.billedTotal += billed;
        if (a.status === "attended") {
          item.attended++;
          if (a.dental_consultation) item.consultations++;
        }
        if (a.status === "scheduled") item.scheduled++;
        if (a.status === "no_show") item.noShow++;
        if (a.status === "cancelled") item.cancelled++;
      } else {
        unassignedTotal++;
        unassignedBilled += billed;
        if (a.status === "attended") unassignedAttended++;
      }
    });

    // Solo los doctores que tienen citas / atenciones en este periodo
    const list = Array.from(map.values())
      .filter((item) => item.total > 0)
      .map((item) => ({
        ...item,
        formattedBilled: new Intl.NumberFormat("es-EC", {
          style: "currency",
          currency: "USD",
        }).format(item.billedTotal),
      }));

    // Sort by total billed descending (or total appointments if equal)
    list.sort((a, b) => b.billedTotal - a.billedTotal || b.total - a.total);

    return {
      list,
      unassignedTotal,
      unassignedAttended,
      unassignedBilled,
      formattedUnassignedBilled: new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
      }).format(unassignedBilled),
    };
  }, [periodAppointments, doctors]);

  // Time Slot Distribution (Morning, Midday, Afternoon)
  const timeDistribution = useMemo(() => {
    let morning = 0; // 07:00 - 11:59
    let midday = 0;  // 12:00 - 14:59
    let afternoon = 0; // 15:00 - 20:00

    periodAppointments.forEach((a) => {
      const dt = new Date(a.starts_at);
      // In Ecuador timezone UTC-5
      const hours = dt.getUTCHours() - 5;
      const normalizedHours = hours < 0 ? hours + 24 : hours;
      if (normalizedHours < 12) morning++;
      else if (normalizedHours < 15) midday++;
      else afternoon++;
    });

    return { morning, midday, afternoon };
  }, [periodAppointments]);

  // Weekday Activity Distribution
  const weekdayDistribution = useMemo(() => {
    const days = [
      { name: "Lun", count: 0, attended: 0 },
      { name: "Mar", count: 0, attended: 0 },
      { name: "Mié", count: 0, attended: 0 },
      { name: "Jue", count: 0, attended: 0 },
      { name: "Vie", count: 0, attended: 0 },
      { name: "Sáb", count: 0, attended: 0 },
      { name: "Dom", count: 0, attended: 0 },
    ];

    periodAppointments.forEach((a) => {
      const dt = new Date(a.starts_at);
      const ecDate = new Date(dt.toLocaleString("en-US", { timeZone: "America/Guayaquil" }));
      const day = ecDate.getDay(); // 0 is Sun, 1 is Mon
      const idx = day === 0 ? 6 : day - 1;
      if (days[idx]) {
        days[idx].count++;
        if (a.status === "attended") days[idx].attended++;
      }
    });

    return days;
  }, [periodAppointments]);

  // Final table list with search and status filter
  const displayTableList = useMemo(() => {
    return periodAppointments.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pName = a.patient?.full_name?.toLowerCase() || "";
        const pDoc = a.patient?.document_number?.toLowerCase() || "";
        const pPhone = a.patient?.phone?.toLowerCase() || "";
        const dName = a.doctor?.full_name?.toLowerCase() || "";
        const reason = a.reason?.toLowerCase() || "";
        return (
          pName.includes(q) ||
          pDoc.includes(q) ||
          pPhone.includes(q) ||
          dName.includes(q) ||
          reason.includes(q)
        );
      }
      return true;
    });
  }, [periodAppointments, statusFilter, searchQuery]);

  // Navigation handlers
  const handlePrevPeriod = () => {
    if (period === "day") {
      const [y, m, d] = selectedDay.split("-").map(Number);
      const dt = new Date(y, m - 1, d - 1);
      setSelectedDay(dt.toISOString().slice(0, 10));
    } else if (period === "week") {
      const [y, m, d] = selectedDay.split("-").map(Number);
      const dt = new Date(y, m - 1, d - 7);
      setSelectedDay(dt.toISOString().slice(0, 10));
    } else if (period === "month") {
      const [y, m] = selectedMonth.split("-").map(Number);
      const dt = new Date(y, m - 2, 1);
      const nextM = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      setSelectedMonth(nextM);
    } else if (period === "year") {
      setSelectedYear((y) => y - 1);
    }
  };

  const handleNextPeriod = () => {
    if (period === "day") {
      const [y, m, d] = selectedDay.split("-").map(Number);
      const dt = new Date(y, m - 1, d + 1);
      setSelectedDay(dt.toISOString().slice(0, 10));
    } else if (period === "week") {
      const [y, m, d] = selectedDay.split("-").map(Number);
      const dt = new Date(y, m - 1, d + 7);
      setSelectedDay(dt.toISOString().slice(0, 10));
    } else if (period === "month") {
      const [y, m] = selectedMonth.split("-").map(Number);
      const dt = new Date(y, m, 1);
      const nextM = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      setSelectedMonth(nextM);
    } else if (period === "year") {
      setSelectedYear((y) => y + 1);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (displayTableList.length === 0) return;

    const headers = [
      "Fecha",
      "Hora",
      "Paciente",
      "Cédula",
      "Teléfono",
      "Doctor",
      "Especialidad",
      "Estado",
      "Motivo",
      "Ficha_Atendida",
      "Facturado"
    ];

    const rows = displayTableList.map((a) => {
      const dt = new Date(a.starts_at);
      const dateStr = dt.toLocaleDateString("es-EC");
      const timeStr = formatTimeLocal(dt);
      const p = a.patient;
      const doc = a.doctor;
      const billedVal = Number(a.billed_amount || a.invoice?.total || 0);
      return [
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${p?.full_name || ""}"`,
        `"${p?.document_number || ""}"`,
        `"${p?.phone || ""}"`,
        `"${doc?.full_name || "Sin asignar"}"`,
        `"${doc?.specialty || ""}"`,
        `"${a.status}"`,
        `"${(a.reason || "").replace(/"/g, '""')}"`,
        `"${a.dental_consultation ? "Sí" : "No"}"`,
        `"${billedVal > 0 ? `$${billedVal.toFixed(2)}` : "$0.00"}"`
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `resumen_citas_atenciones_${periodLabel.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-lilac-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-lilac-700 uppercase tracking-wider mb-1">
            <TrendingUp size={16} className="text-lilac-600" />
            Panel Ejecutivo y Estadísticas
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-ink-950 tracking-tight">
            Resumen de Citas y Atenciones
          </h1>
          <p className="text-xs sm:text-sm text-ink-500 mt-0.5">
            Métricas de productividad clínica, efectividad de turnos y desempeño por doctor.
          </p>
        </div>

        {/* Acciones de exportar e imprimir */}
        <div className="flex items-center gap-2 self-start md:self-center print:hidden">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-lilac-200 text-ink-700 hover:bg-lilac-50 transition-colors shadow-sm"
            title="Descargar reporte en formato Excel/CSV"
          >
            <FileSpreadsheet size={15} className="text-green-600" />
            <span className="hidden sm:inline">Exportar</span> CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-lilac-200 text-ink-700 hover:bg-lilac-50 transition-colors shadow-sm"
            title="Imprimir resumen ejecutivo"
          >
            <Printer size={15} className="text-lilac-600" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>
      </div>

      {/* Selector de Período */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-lilac-100 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Tabs de Periodo */}
          <div className="flex items-center gap-1 p-1 bg-lilac-50/70 rounded-2xl border border-lilac-100 overflow-x-auto">
            <button
              type="button"
              onClick={() => setPeriod("day")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                period === "day"
                  ? "bg-lilac-600 text-white shadow-sm"
                  : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
              }`}
            >
              Día
            </button>
            <button
              type="button"
              onClick={() => setPeriod("week")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                period === "week"
                  ? "bg-lilac-600 text-white shadow-sm"
                  : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setPeriod("month")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                period === "month"
                  ? "bg-lilac-600 text-white shadow-sm"
                  : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
              }`}
            >
              Mes
            </button>
            <button
              type="button"
              onClick={() => setPeriod("year")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                period === "year"
                  ? "bg-lilac-600 text-white shadow-sm"
                  : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
              }`}
            >
              Año
            </button>
            <button
              type="button"
              onClick={() => setPeriod("custom")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                period === "custom"
                  ? "bg-lilac-600 text-white shadow-sm"
                  : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
              }`}
            >
              Personalizado
            </button>
          </div>

          {/* Navegación y Fecha Seleccionada */}
          <div className="flex items-center gap-2 flex-wrap">
            {period !== "custom" ? (
              <div className="flex items-center bg-lilac-50/50 border border-lilac-200 rounded-2xl overflow-hidden p-1 shadow-sm">
                <button
                  type="button"
                  onClick={handlePrevPeriod}
                  className="p-1.5 hover:bg-white rounded-xl text-ink-700 transition"
                  title="Período anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="px-3 text-xs font-bold text-ink-900 flex items-center gap-1.5 capitalize">
                  <Calendar size={13} className="text-lilac-600" />
                  <span>{periodLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={handleNextPeriod}
                  className="p-1.5 hover:bg-white rounded-xl text-ink-700 transition"
                  title="Período siguiente"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="text-xs px-2.5 py-1.5 border border-lilac-200 rounded-xl bg-white font-medium"
                />
                <span className="text-xs text-ink-400">a</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="text-xs px-2.5 py-1.5 border border-lilac-200 rounded-xl bg-white font-medium"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Layout Principal: Columna Izquierda (KPIs + Desempeño por Doctor) y Columna Derecha (Estado de Citas & Distribución) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Columna Izquierda (2 spans) */}
        <div className="lg:col-span-2 space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Total Citas */}
            <div className="bg-white p-5 rounded-3xl border border-lilac-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">Total Citas</span>
                <div className="w-8 h-8 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center">
                  <CalendarDays size={16} />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-ink-950">{stats.total}</div>
                <div className="text-xs text-ink-500 mt-1 flex items-center gap-1.5">
                  <span className="text-lilac-600 font-semibold">{stats.scheduled} agendadas</span>
                  <span>·</span>
                  <span>{stats.uniquePatientsCount} pacientes</span>
                </div>
              </div>
              <div className="absolute right-0 bottom-0 w-24 h-24 bg-lilac-50/50 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* Total Atenciones Realizadas */}
            <div className="bg-white p-5 rounded-3xl border border-green-200 shadow-sm relative overflow-hidden flex flex-col justify-between bg-gradient-to-br from-white to-green-50/20">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold text-green-800 uppercase tracking-wider">Atenciones Realizadas</span>
                <div className="w-8 h-8 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-green-700">{stats.attended}</div>
                <div className="text-xs text-green-800 font-medium mt-1 flex items-center gap-1">
                  <span>{stats.completedConsultations} con evolución clínica guardada</span>
                </div>
              </div>
            </div>

            {/* Total Facturado */}
            <div className="bg-white p-5 rounded-3xl border border-lilac-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">Total Facturado</span>
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-ink-950">{stats.formattedTotalBilled}</div>
                <div className="text-xs text-ink-500 mt-1 flex items-center gap-1.5">
                  <span className="text-purple-700 font-semibold">{stats.billedInvoicesCount} facturas</span>
                  <span>·</span>
                  <span>{stats.attended} atenciones</span>
                </div>
              </div>
            </div>
          </div>

          {/* Desglose y Ranking por Doctor */}
          <div className="bg-white p-6 rounded-3xl border border-lilac-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-lilac-50 pb-3">
              <div className="flex items-center gap-2">
                <Award size={18} className="text-lilac-600" />
                <h2 className="text-base font-bold text-ink-950">Desempeño y Facturación por Doctor</h2>
              </div>
              <span className="text-xs text-ink-500">{periodLabel}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-lilac-100 text-ink-400 font-bold uppercase text-[10px]">
                    <th className="pb-2.5">Doctor / Odontólogo</th>
                    <th className="pb-2.5 text-center">Citas Asignadas</th>
                    <th className="pb-2.5 text-center">Atenciones</th>
                    <th className="pb-2.5 text-center">Inasistencias</th>
                    <th className="pb-2.5 text-right font-bold text-ink-900">Total Facturado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lilac-50">
                  {doctorStats.list.map((item) => (
                    <tr key={item.doctor.id} className="hover:bg-lilac-50/40 transition">
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-2.5">
                          {item.doctor.photo_url ? (
                            <img
                              src={item.doctor.photo_url}
                              alt={item.doctor.full_name}
                              className="w-7 h-7 rounded-full object-cover border border-lilac-200 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-lilac-100 text-lilac-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                              {item.doctor.full_name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-ink-900">{item.doctor.full_name}</div>
                            <div className="text-[10px] text-ink-500">{item.doctor.specialty || "Odontología General"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-center font-bold text-ink-900">{item.total}</td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                          {item.attended}
                        </span>
                      </td>
                      <td className="py-3 text-center text-amber-700 font-medium">
                        {item.noShow + item.cancelled}
                      </td>
                      <td className="py-3 text-right">
                        <div className="font-extrabold text-ink-950 text-sm">
                          {item.formattedBilled}
                        </div>
                        <div className="text-[10px] text-ink-400 font-medium">
                          {item.attended > 0
                            ? `Prom. $${(item.billedTotal / item.attended).toFixed(2)}/atención`
                            : "Sin atenciones"}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {doctorStats.unassignedTotal > 0 && (
                    <tr className="bg-amber-50/30">
                      <td className="py-3 pr-2 font-medium text-amber-800 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                          ?
                        </div>
                        <div>
                          <div className="font-bold text-amber-900">Sin doctor asignado</div>
                          <div className="text-[10px] text-amber-700">Pendientes de asignación</div>
                        </div>
                      </td>
                      <td className="py-3 text-center font-bold text-amber-900">{doctorStats.unassignedTotal}</td>
                      <td className="py-3 text-center font-bold text-green-700">{doctorStats.unassignedAttended}</td>
                      <td className="py-3 text-center text-amber-700">—</td>
                      <td className="py-3 text-right font-extrabold text-amber-900 text-sm">
                        {doctorStats.formattedUnassignedBilled}
                      </td>
                    </tr>
                  )}

                  {doctorStats.list.length === 0 && doctorStats.unassignedTotal === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-ink-500 italic bg-lilac-50/20">
                        No hay registro de citas ni atenciones para ningún doctor en este período ({periodLabel}).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Columna Derecha (1 span): Distribución por Estado y Horarios alineada con KPIs */}
        <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-lilac-100 shadow-sm space-y-6">
          {/* Distribución por Estado */}
          <div>
            <div className="flex items-center justify-between border-b border-lilac-50 pb-2.5 mb-3">
              <h3 className="text-sm font-bold text-ink-950">Estado de Citas</h3>
              <span className="text-[11px] text-ink-400">{stats.total} en total</span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-green-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500" /> Atendidas
                  </span>
                  <span className="text-ink-900">{stats.attended} ({stats.attendedPct}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-green-500 h-full rounded-full" style={{ width: `${stats.attendedPct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-lilac-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-lilac-500" /> Agendadas pendientes
                  </span>
                  <span className="text-ink-900">
                    {stats.scheduled} ({stats.total > 0 ? Math.round((stats.scheduled / stats.total) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-lilac-500 h-full rounded-full"
                    style={{ width: `${stats.total > 0 ? Math.round((stats.scheduled / stats.total) * 100) : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-amber-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> No Asistieron
                  </span>
                  <span className="text-ink-900">
                    {stats.noShow} ({stats.total > 0 ? Math.round((stats.noShow / stats.total) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{ width: `${stats.total > 0 ? Math.round((stats.noShow / stats.total) * 100) : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-red-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" /> Canceladas
                  </span>
                  <span className="text-ink-900">
                    {stats.cancelled} ({stats.total > 0 ? Math.round((stats.cancelled / stats.total) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-red-500 h-full rounded-full"
                    style={{ width: `${stats.total > 0 ? Math.round((stats.cancelled / stats.total) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Franjas Horarias */}
          <div className="pt-4 border-t border-lilac-50">
            <h3 className="text-sm font-bold text-ink-950 mb-3">Franjas Horarias con Mayor Afluencia</h3>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-3 bg-lilac-50/50 rounded-2xl border border-lilac-100">
                <div className="text-[10px] text-ink-500 font-bold uppercase">Mañana</div>
                <div className="text-lg font-black text-ink-900 mt-0.5">{timeDistribution.morning}</div>
                <div className="text-[10px] text-ink-400">07:00 - 12:00</div>
              </div>
              <div className="p-3 bg-lilac-50/50 rounded-2xl border border-lilac-100">
                <div className="text-[10px] text-ink-500 font-bold uppercase">Mediodía</div>
                <div className="text-lg font-black text-ink-900 mt-0.5">{timeDistribution.midday}</div>
                <div className="text-[10px] text-ink-400">12:00 - 15:00</div>
              </div>
              <div className="p-3 bg-lilac-50/50 rounded-2xl border border-lilac-100">
                <div className="text-[10px] text-ink-500 font-bold uppercase">Tarde</div>
                <div className="text-lg font-black text-ink-900 mt-0.5">{timeDistribution.afternoon}</div>
                <div className="text-[10px] text-ink-400">15:00 - 20:00</div>
              </div>
            </div>
          </div>

          {/* Días de Mayor Actividad */}
          <div className="pt-4 border-t border-lilac-50">
            <h3 className="text-sm font-bold text-ink-950 mb-2">Actividad por Día de la Semana</h3>
            <div className="grid grid-cols-7 gap-1 text-center">
              {weekdayDistribution.map((d) => (
                <div key={d.name} className="bg-gray-50 rounded-xl p-2 border border-gray-100">
                  <div className="text-[10px] font-bold text-ink-500 uppercase">{d.name}</div>
                  <div className="text-xs font-black text-ink-900 mt-1">{d.count}</div>
                  <div className="text-[9px] text-green-700 font-semibold">{d.attended} ok</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla Detallada de Citas y Atenciones */}
      <div className="bg-white rounded-3xl border border-lilac-100 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-lilac-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-ink-950">Registro Detallado del Periodo</h2>
            <p className="text-xs text-ink-500">
              Mostrando {displayTableList.length} de {periodAppointments.length} citas registradas
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap print:hidden">
            {/* Buscador */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                placeholder="Buscar paciente, cédula o doctor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs pl-8 pr-3 py-2 border border-lilac-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-lilac-400 w-56 sm:w-64"
              />
            </div>

            {/* Filtro por estado */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 border border-lilac-200 rounded-xl bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-lilac-400"
            >
              <option value="all">Todos los estados</option>
              <option value="attended">Solo Atendidas</option>
              <option value="scheduled">Solo Agendadas</option>
              <option value="no_show">No asistieron</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </div>
        </div>

        {displayTableList.length === 0 ? (
          <div className="p-12 text-center text-sm text-ink-500 bg-lilac-50/20">
            No se encontraron citas ni atenciones para el período o filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-lilac-50/60 text-ink-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-5 py-3">Fecha y Hora</th>
                  <th className="px-5 py-3">Paciente</th>
                  <th className="px-5 py-3">Doctor Asignado</th>
                  <th className="px-5 py-3">Motivo</th>
                  <th className="px-5 py-3">Facturación</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3 text-right print:hidden">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {displayTableList.map((a) => {
                  const dt = new Date(a.starts_at);
                  const p = a.patient;
                  const doc = a.doctor;
                  const hasConsultation = !!a.dental_consultation;

                  return (
                    <tr key={a.id} className="hover:bg-lilac-50/30 transition">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="font-bold text-ink-900">
                          {dt.toLocaleDateString("es-EC", { day: "2-digit", month: "short" })}
                        </div>
                        <div className="text-[11px] text-ink-500 font-medium">
                          {formatTimeLocal(dt)}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <Link href={`/erp/pacientes/${p?.id || ""}`} className="font-bold text-ink-900 hover:text-lilac-700 transition">
                          {p?.full_name || "Paciente no registrado"}
                        </Link>
                        <div className="text-[11px] text-ink-500 flex items-center gap-2 mt-0.5">
                          {p?.document_number && <span>CC {p.document_number}</span>}
                          {p?.phone && <span>Tel: {p.phone}</span>}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {doc ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-lilac-50 text-lilac-800 border border-lilac-200">
                              <Stethoscope size={11} className="text-lilac-600" />
                              {doc.full_name}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            ⚠️ Sin doctor
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 max-w-xs truncate text-ink-600 italic">
                        {a.reason || "Consulta odontológica general"}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {a.invoice ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-lg border border-green-200 text-xs w-fit">
                              ${Number(a.invoice.total).toFixed(2)}
                            </span>
                            <span className="text-[10px] text-ink-400 mt-0.5">
                              {a.invoice.invoice_number}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-ink-400 italic">
                            No facturada
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <StatusBadge status={a.status} hasConsultation={hasConsultation} />
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap print:hidden">
                        <div className="flex items-center justify-end gap-2">
                          {a.status === "attended" && (
                            <Link
                              href={`/erp/citas/${a.id}/atencion`}
                              className="text-[11px] font-bold text-gold-700 hover:text-gold-900 bg-gold-50 hover:bg-gold-100 border border-gold-200 px-2.5 py-1 rounded-xl transition shadow-sm"
                            >
                              Ver Ficha
                            </Link>
                          )}
                          <Link
                            href={`/erp/citas/${a.id}`}
                            className="text-[11px] font-semibold text-lilac-700 hover:text-lilac-900 bg-lilac-50 hover:bg-lilac-100 border border-lilac-200 px-2.5 py-1 rounded-xl transition"
                          >
                            Detalles →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, hasConsultation }: { status: string; hasConsultation?: boolean }) {
  const map: Record<string, string> = {
    scheduled: "bg-lilac-100 text-lilac-700 border-lilac-200",
    attended: "bg-green-100 text-green-700 border-green-200",
    no_show: "bg-amber-100 text-amber-700 border-amber-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };
  const labels: Record<string, string> = {
    scheduled: "Agendada",
    attended: hasConsultation ? "Atendida (Ficha OK)" : "Atendida",
    no_show: "No asistió",
    cancelled: "Cancelada",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${map[status] || map.scheduled}`}>
      {labels[status] || status}
    </span>
  );
}
