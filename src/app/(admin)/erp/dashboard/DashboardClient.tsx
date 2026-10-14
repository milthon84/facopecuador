"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Printer,
  CalendarDays,
  FileSpreadsheet,
  Award,
  GraduationCap,
  BookOpen,
  ArrowUpRight,
  Stethoscope,
  DollarSign,
  Wallet,
  Users,
  Building2,
  Coins,
  ArrowDownRight,
  PieChart
} from "lucide-react";
import { formatTimeLocal } from "@/lib/availability";
import { resolveExpenseArea, EXPENSE_AREA_CONFIG, ExpenseArea } from "@/lib/expense-areas";

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

export interface CourseSummaryData {
  id: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  max_students?: number | null;
  total_cost?: number;
  enrolled_count: number;
  modules_count: number;
  billed_amount: number;
  formatted_billed: string;
  invoices_count: number;
}

export interface DoctorExpenseData {
  id: string;
  expense_date: string;
  total: number;
  supplier_name: string | null;
  supplier_ruc?: string | null;
  description: string | null;
  category: string | null;
  area?: string | null;
  notes?: string | null;
  resolvedArea?: ExpenseArea;
}

export interface OtherInvoiceData {
  id: string;
  invoice_number: string;
  total: number;
  created_at: string;
  description?: string;
}

type PeriodType = "day" | "week" | "month" | "year" | "custom";

interface Props {
  initialAppointments: AppointmentData[];
  doctors: DoctorOption[];
  courses?: CourseSummaryData[];
  expenses?: DoctorExpenseData[];
  otherInvoices?: OtherInvoiceData[];
}

const COURSE_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:       { label: "Borrador", cls: "bg-gray-100 text-gray-700 border-gray-200" },
  active:      { label: "Abierto", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  in_progress: { label: "En Curso", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  completed:   { label: "Finalizado", cls: "bg-lilac-50 text-lilac-700 border-lilac-200" },
  cancelled:   { label: "Cancelado", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

const formatDateShort = (d: string) => {
  if (!d) return "—";
  try {
    const parts = d.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
    }
    return new Date(d + "T12:00:00").toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  } catch {
    return d;
  }
};

export default function DashboardClient({
  initialAppointments,
  doctors,
  courses = [],
  expenses = [],
  otherInvoices = []
}: Props) {
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

  // Helper date calculations
  const { dateRange, periodLabel } = useMemo(() => {
    if (period === "day") {
      const [y, m, d] = selectedDay.split("-").map(Number);
      const start = new Date(Date.UTC(y, m - 1, d, 5, 0, 0));
      const end = new Date(Date.UTC(y, m - 1, d + 1, 4, 59, 59));
      const label = new Date(selectedDay + "T12:00:00-05:00").toLocaleDateString("es-EC", {
        weekday: "short",
        day: "numeric",
        month: "short",
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

      const label = `${mon.getUTCDate()} ${mon.toLocaleDateString("es-EC", { month: "short" })} - ${sun.getUTCDate()} ${sun.toLocaleDateString("es-EC", { month: "short", year: "numeric" })}`;
      return { dateRange: { start, end }, periodLabel: label };
    }

    if (period === "month") {
      const [y, m] = selectedMonth.split("-").map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1, 5, 0, 0));
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const end = new Date(Date.UTC(y, m - 1, lastDay + 1, 4, 59, 59));
      const label = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0)).toLocaleDateString("es-EC", {
        month: "long",
        year: "numeric",
      });
      return { dateRange: { start, end }, periodLabel: label };
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
    const label = `${customStart} al ${customEnd}`;
    return { dateRange: { start, end }, periodLabel: label };
  }, [period, selectedDay, selectedMonth, selectedYear, customStart, customEnd]);

  // Filter Appointments by Selected Range
  const periodAppointments = useMemo(() => {
    return initialAppointments.filter((a) => {
      const apptDate = new Date(a.starts_at);
      return apptDate >= dateRange.start && apptDate <= dateRange.end;
    });
  }, [initialAppointments, dateRange]);

  // Filter Expenses by Selected Range
  const periodExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!e.expense_date) return false;
      const expDate = new Date(e.expense_date + "T12:00:00-05:00");
      return expDate >= dateRange.start && expDate <= dateRange.end;
    });
  }, [expenses, dateRange]);

  // Filter Other Invoices (facturación no vinculada a citas ni a cursos) by Selected Range
  const periodOtherInvoices = useMemo(() => {
    return (otherInvoices || []).filter((inv) => {
      if (!inv.created_at) return false;
      const invDate = new Date(inv.created_at);
      return invDate >= dateRange.start && invDate <= dateRange.end;
    });
  }, [otherInvoices, dateRange]);

  const otherBilled = useMemo(() => {
    return periodOtherInvoices.reduce((acc, inv) => acc + (Number(inv.total) || 0), 0);
  }, [periodOtherInvoices]);

  // Aggregate Metrics for Clinic
  const stats = useMemo(() => {
    const total = periodAppointments.length;
    const attended = periodAppointments.filter((a) => a.status === "attended").length;
    const scheduled = periodAppointments.filter((a) => a.status === "scheduled").length;

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

    return {
      total,
      attended,
      scheduled,
      completedConsultations,
      totalBilled,
      billedInvoicesCount,
      formattedTotalBilled,
    };
  }, [periodAppointments]);

  // Doctor Breakdown Stats & Doctor Expenses
  const doctorStats = useMemo(() => {
    const map = new Map<string, {
      doctor: DoctorOption;
      total: number;
      attended: number;
      billedTotal: number;
      formattedBilled: string;
      expensesPaid: number;
      formattedExpensesPaid: string;
      netTotal: number;
      formattedNetTotal: string;
      expensesCount: number;
    }>();

    let unassignedTotal = 0;
    let unassignedAttended = 0;
    let unassignedBilled = 0;

    // Inicializar doctores
    periodAppointments.forEach((a) => {
      const billed = Number(a.billed_amount || a.invoice?.total || 0);

      if (!a.doctor_id) {
        unassignedTotal++;
        if (a.status === "attended") unassignedAttended++;
        unassignedBilled += billed;
        return;
      }

      const docObj = a.doctor || doctors.find((d) => d.id === a.doctor_id) || {
        id: a.doctor_id,
        full_name: "Doctor Desconocido",
        specialty: "",
        photo_url: null,
      };

      const curr = map.get(a.doctor_id) || {
        doctor: docObj,
        total: 0,
        attended: 0,
        billedTotal: 0,
        formattedBilled: "$0.00",
        expensesPaid: 0,
        formattedExpensesPaid: "$0.00",
        netTotal: 0,
        formattedNetTotal: "$0.00",
        expensesCount: 0,
      };

      curr.total++;
      if (a.status === "attended") curr.attended++;
      curr.billedTotal += billed;

      map.set(a.doctor_id, curr);
    });

    // Mapear gastos asignados a cada doctor
    periodExpenses.forEach((exp) => {
      const sName = (exp.supplier_name || "").toLowerCase().trim();
      const desc = (exp.description || "").toLowerCase().trim();
      const expAmount = Number(exp.total || 0);

      for (const doc of doctors) {
        const docName = (doc.full_name || "").toLowerCase().trim();
        const parts = docName.split(" ").filter((p) => p.length > 2);

        let matches = false;
        if (sName && docName && sName.includes(docName)) matches = true;
        else if (desc && docName && desc.includes(docName)) matches = true;
        else if (parts.length >= 2) {
          if (sName.includes(parts[0]) && sName.includes(parts[parts.length - 1])) matches = true;
          else if (desc.includes(parts[0]) && desc.includes(parts[parts.length - 1])) matches = true;
        }

        if (matches) {
          let curr = map.get(doc.id);
          if (!curr) {
            curr = {
              doctor: doc,
              total: 0,
              attended: 0,
              billedTotal: 0,
              formattedBilled: "$0.00",
              expensesPaid: 0,
              formattedExpensesPaid: "$0.00",
              netTotal: 0,
              formattedNetTotal: "$0.00",
              expensesCount: 0,
            };
            map.set(doc.id, curr);
          }
          curr.expensesPaid += expAmount;
          curr.expensesCount++;
          break;
        }
      }
    });

    const list = Array.from(map.values()).map((item) => {
      const net = item.billedTotal - item.expensesPaid;
      return {
        ...item,
        netTotal: net,
        formattedBilled: new Intl.NumberFormat("es-EC", {
          style: "currency",
          currency: "USD",
        }).format(item.billedTotal),
        formattedExpensesPaid: new Intl.NumberFormat("es-EC", {
          style: "currency",
          currency: "USD",
        }).format(item.expensesPaid),
        formattedNetTotal: new Intl.NumberFormat("es-EC", {
          style: "currency",
          currency: "USD",
        }).format(net),
      };
    });

    list.sort((a, b) => b.billedTotal - a.billedTotal || b.netTotal - a.netTotal || b.attended - a.attended || b.total - a.total);

    const totalDoctorExpenses = list.reduce((acc, d) => acc + d.expensesPaid, 0);
    const totalDoctorExpensesCount = list.reduce((acc, d) => acc + d.expensesCount, 0);

    return {
      list,
      unassignedTotal,
      unassignedAttended,
      unassignedBilled,
      totalDoctorExpenses,
      totalDoctorExpensesCount,
      formattedTotalDoctorExpenses: new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
      }).format(totalDoctorExpenses),
      formattedUnassignedBilled: new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
      }).format(unassignedBilled),
    };
  }, [periodAppointments, periodExpenses, doctors]);

  // Desglose de Gastos por Área (Clínica, Cursos, General)
  const expenseAreaStats = useMemo(() => {
    let clinicaTotal = 0;
    let clinicaCount = 0;
    let cursosTotal = 0;
    let cursosCount = 0;
    let generalTotal = 0;
    let generalCount = 0;

    periodExpenses.forEach((exp) => {
      const area = exp.resolvedArea || resolveExpenseArea(exp);
      const amt = Number(exp.total || 0);
      if (area === "clinica") {
        clinicaTotal += amt;
        clinicaCount++;
      } else if (area === "cursos") {
        cursosTotal += amt;
        cursosCount++;
      } else {
        generalTotal += amt;
        generalCount++;
      }
    });

    const totalExpenses = clinicaTotal + cursosTotal + generalTotal;
    const totalCount = clinicaCount + cursosCount + generalCount;

    return {
      clinicaTotal,
      clinicaCount,
      cursosTotal,
      cursosCount,
      generalTotal,
      generalCount,
      totalExpenses,
      totalCount,
      formattedClinicaTotal: new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(clinicaTotal),
      formattedCursosTotal: new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(cursosTotal),
      formattedGeneralTotal: new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(generalTotal),
      formattedTotalExpenses: new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(totalExpenses),
    };
  }, [periodExpenses]);

  // Aggregate Metrics for Courses
  const courseStats = useMemo(() => {
    const activeOrProgress = courses.filter((c) => c.status === "active" || c.status === "in_progress");
    const totalStudents = courses.reduce((acc, c) => acc + (c.enrolled_count || 0), 0);
    const totalBilledCourses = courses.reduce((acc, c) => acc + (c.billed_amount || 0), 0);
    const totalCourseInvoices = courses.reduce((acc, c) => acc + (c.invoices_count || 0), 0);

    const totalCourseExpenses = expenseAreaStats.cursosTotal;
    const courseExpensesCount = expenseAreaStats.cursosCount;
    const courseProfit = totalBilledCourses - totalCourseExpenses;

    return {
      totalCourses: courses.length,
      activeCoursesCount: activeOrProgress.length,
      totalStudents,
      totalBilledCourses,
      totalCourseInvoices,
      totalCourseExpenses,
      courseExpensesCount,
      courseProfit,
      formattedTotalBilledCourses: new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
      }).format(totalBilledCourses),
      formattedTotalCourseExpenses: new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
      }).format(totalCourseExpenses),
      formattedCourseProfit: new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
      }).format(courseProfit),
    };
  }, [courses, expenseAreaStats]);

  // Consolidado Financiero Global (Clínica + Cursos + Otros/General)
  const globalFinancials = useMemo(() => {
    const totalBilled = stats.totalBilled + courseStats.totalBilledCourses + otherBilled;
    const totalExpenses = expenseAreaStats.totalExpenses;
    const netProfit = totalBilled - totalExpenses;

    // Utilidad Clínica (Facturación Clínica - Gastos de Clínica)
    const clinicNetProfit = stats.totalBilled - expenseAreaStats.clinicaTotal;
    // Utilidad Cursos (Facturación Cursos - Gastos de Cursos)
    const coursesNetProfit = courseStats.totalBilledCourses - expenseAreaStats.cursosTotal;
    // Utilidad General / Otros (Facturación Otros - Gastos Generales)
    const otherNetProfit = otherBilled - expenseAreaStats.generalTotal;

    return {
      totalBilled,
      totalExpenses,
      netProfit,
      clinicNetProfit,
      coursesNetProfit,
      otherNetProfit,
      otherBilled,
      otherInvoicesCount: periodOtherInvoices.length,
      formattedOtherBilled: new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(otherBilled),
      formattedTotalBilled: new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(totalBilled),
      formattedTotalExpenses: new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(totalExpenses),
      formattedNetProfit: new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(netProfit),
      formattedClinicNetProfit: new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(clinicNetProfit),
      formattedCoursesNetProfit: new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(coursesNetProfit),
      formattedOtherNetProfit: new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(otherNetProfit),
    };
  }, [stats.totalBilled, courseStats.totalBilledCourses, otherBilled, periodOtherInvoices.length, expenseAreaStats]);

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
    if (periodAppointments.length === 0) return;

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

    const rows = periodAppointments.map((a) => {
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
    link.setAttribute("download", `resumen_${periodLabel.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-3 pb-6 print:space-y-2 print:pb-0 print:max-w-full">
      {/* Barra Superior Compacta: Resumen */}
      <div className="bg-white px-4 py-2 sm:py-2.5 rounded-2xl border border-lilac-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2 print:border-none print:shadow-none print:p-0 print:mb-1">
        <div className="flex items-center justify-between gap-2 w-full md:w-auto">
          <div>
            <div className="hidden print:block text-xs font-black text-lilac-800 tracking-wider uppercase">
              FACOP ECUADOR QUITO
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-ink-950 tracking-tight">
              Dashboard
            </h1>
          </div>
          <span className="hidden print:inline-block text-[11px] font-semibold text-ink-600 border px-2 py-0.5 rounded-md">
            {periodLabel}
          </span>
        </div>

        {/* Filtros y Acciones */}
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          {/* Tabs Periodo */}
          <div className="flex items-center gap-0.5 p-0.5 bg-lilac-50/80 rounded-xl border border-lilac-100">
            {(["day", "week", "month", "year", "custom"] as const).map((p) => {
              const labels: Record<string, string> = {
                day: "Día",
                week: "Sem",
                month: "Mes",
                year: "Año",
                custom: "Personalizado"
              };
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    period === p
                      ? "bg-lilac-600 text-white shadow-xs"
                      : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>

          {/* Navegador de Fecha */}
          {period !== "custom" ? (
            <div className="flex items-center bg-white border border-lilac-200 rounded-xl overflow-hidden p-0.5 shadow-xs text-xs">
              <button
                type="button"
                onClick={handlePrevPeriod}
                className="p-1 hover:bg-lilac-50 rounded-lg text-ink-700 transition"
                title="Período anterior"
              >
                <ChevronLeft size={13} />
              </button>
              <div className="px-2 font-bold text-ink-900 flex items-center gap-1 capitalize whitespace-nowrap text-xs">
                <Calendar size={11} className="text-lilac-600" />
                <span>{periodLabel}</span>
              </div>
              <button
                type="button"
                onClick={handleNextPeriod}
                className="p-1 hover:bg-lilac-50 rounded-lg text-ink-700 transition"
                title="Período siguiente"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-1.5 py-0.5 border border-lilac-200 rounded-lg bg-white font-medium text-xs"
              />
              <span className="text-ink-400 font-semibold">-</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-1.5 py-0.5 border border-lilac-200 rounded-lg bg-white font-medium text-xs"
              />
            </div>
          )}

          {/* Botones de acción */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-white border border-lilac-200 text-ink-700 hover:bg-lilac-50 transition-colors shadow-xs"
            title="Descargar reporte en formato Excel/CSV"
          >
            <FileSpreadsheet size={13} className="text-emerald-600" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-white border border-lilac-200 text-ink-700 hover:bg-lilac-50 transition-colors shadow-xs"
            title="Imprimir resumen ejecutivo"
          >
            <Printer size={13} className="text-lilac-600" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>
      </div>

      {/* RESUMEN FINANCIERO CONSOLIDADO (CLÍNICA + CURSOS + GENERAL) */}
      <div className="bg-slate-900 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white p-3.5 sm:p-4 rounded-2xl border border-slate-800 shadow-md space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-lilac-500/20 text-lilac-300 flex items-center justify-center font-bold">
              <PieChart size={16} />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase flex items-center gap-2">
                <span>Resumen Financiero Consolidado</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/10 text-white/90 border border-white/15">
                  {periodLabel}
                </span>
              </h2>
            </div>
          </div>
        </div>

        {/* 3 Métricas Principales: Facturación Total, Gastos Totales, Utilidad Neta */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Facturación Global */}
          <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Facturación Total</span>
              <TrendingUp size={14} className="text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1">{globalFinancials.formattedTotalBilled}</div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between gap-1 flex-wrap">
              <span>🏥 Clínica: {stats.formattedTotalBilled}</span>
              <span>🎓 Cursos: {courseStats.formattedTotalBilledCourses}</span>
              <span className="text-amber-200">🏢 Otros: {globalFinancials.formattedOtherBilled}</span>
            </div>
          </div>

          {/* Gastos Globales con Desglose */}
          <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Gastos Totales ({expenseAreaStats.totalCount})</span>
              <DollarSign size={14} className="text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-300 mt-1">{globalFinancials.formattedTotalExpenses}</div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between gap-1 flex-wrap">
              <span className="text-teal-300">🏥 Clínica: {expenseAreaStats.formattedClinicaTotal}</span>
              <span className="text-indigo-300">🎓 Cursos: {expenseAreaStats.formattedCursosTotal}</span>
              <span className="text-amber-300">🏢 Otros: {expenseAreaStats.formattedGeneralTotal}</span>
            </div>
          </div>

          {/* Utilidad Neta Operativa */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            globalFinancials.netProfit >= 0
              ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-100"
              : "bg-rose-950/60 border-rose-500/40 text-rose-100"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/90">Utilidad Neta del Período</span>
              <Coins size={14} className={globalFinancials.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"} />
            </div>
            <div className={`text-2xl font-black mt-1 ${globalFinancials.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {globalFinancials.formattedNetProfit}
            </div>
            <div className="text-[10px] text-white/80 mt-1 flex items-center justify-between gap-1 flex-wrap">
              <span>🏥 Clínica: {globalFinancials.formattedClinicNetProfit}</span>
              <span>🎓 Cursos: {globalFinancials.formattedCoursesNetProfit}</span>
              <span className="text-amber-200">🏢 Otros: {globalFinancials.formattedOtherNetProfit}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE 1: CLÍNICA */}
      <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-lilac-100 shadow-xs space-y-2.5 print:border-gray-300 print:shadow-none print:p-2">
        <div className="flex items-center justify-between border-b border-lilac-50 pb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-lilac-900 uppercase tracking-wider">
            <Stethoscope size={15} className="text-lilac-600" />
            <span>CLÍNICA</span>
          </div>
          <span className="text-[11px] text-ink-500 font-medium">{periodLabel}</span>
        </div>

        {/* 4 KPIs de Clínica: Citas, Atenciones, Facturación y Gastos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 print:grid-cols-4 print:gap-1.5">
          {/* Citas Totales */}
          <div className="bg-lilac-50/40 p-2.5 rounded-xl border border-lilac-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">Citas Totales</div>
              <div className="text-xl font-black text-ink-950 leading-tight mt-0.5">{stats.total}</div>
              <div className="text-[10px] text-ink-500">
                <span className="text-lilac-700 font-semibold">{stats.scheduled} agendadas</span>
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-lilac-100 text-lilac-700 flex items-center justify-center shrink-0">
              <CalendarDays size={13} />
            </div>
          </div>

          {/* Atenciones */}
          <div className="bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Atenciones</div>
              <div className="text-xl font-black text-emerald-700 leading-tight mt-0.5">{stats.attended}</div>
              <div className="text-[10px] text-emerald-800 font-medium">
                {stats.completedConsultations} con evolución
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 size={13} />
            </div>
          </div>

          {/* Facturación */}
          <div className="bg-purple-50/40 p-2.5 rounded-xl border border-purple-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">Facturación</div>
              <div className="text-xl font-black text-ink-950 leading-tight mt-0.5">{stats.formattedTotalBilled}</div>
              <div className="text-[10px] text-ink-500">
                <span className="text-purple-700 font-semibold">{stats.billedInvoicesCount} facturas</span>
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <TrendingUp size={13} />
            </div>
          </div>

          {/* Gastos de Clínica */}
          <div className="bg-amber-50/40 p-2.5 rounded-xl border border-amber-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Gastos Clínica</div>
              <div className="text-xl font-black text-amber-900 leading-tight mt-0.5">{expenseAreaStats.formattedClinicaTotal}</div>
              <div className="text-[10px] text-amber-700 font-medium truncate">
                Utilidad: <b className="text-emerald-800">{globalFinancials.formattedClinicNetProfit}</b>
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <DollarSign size={13} />
            </div>
          </div>
        </div>

        {/* Tabla Desempeño por Doctor */}
        <div className="overflow-x-auto pt-1">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-lilac-100 text-ink-400 font-bold uppercase text-[10px]">
                <th className="pb-1 font-semibold">Doctor / Odontólogo</th>
                <th className="pb-1 text-center font-semibold">Citas Asignadas</th>
                <th className="pb-1 text-center font-semibold">Atenciones</th>
                <th className="pb-1 text-right font-bold text-ink-900">Total Facturado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lilac-50/70">
              {doctorStats.list.map((item) => (
                <tr key={item.doctor.id} className="hover:bg-lilac-50/30 transition">
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-2">
                      {item.doctor.photo_url ? (
                        <img
                          src={item.doctor.photo_url}
                          alt={item.doctor.full_name}
                          className="w-5 h-5 rounded-full object-cover border border-lilac-200 shrink-0"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-lilac-100 text-lilac-700 flex items-center justify-center font-bold text-[9px] shrink-0">
                          {item.doctor.full_name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-ink-900 leading-tight text-xs">{item.doctor.full_name}</div>
                        <div className="text-[10px] text-ink-400 leading-tight">{item.doctor.specialty || "Odontología General"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-1.5 text-center font-bold text-ink-900">{item.total}</td>
                  <td className="py-1.5 text-center">
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px]">
                      {item.attended}
                    </span>
                  </td>
                  <td className="py-1.5 text-right font-extrabold text-ink-950 text-xs">
                    {item.formattedBilled}
                  </td>
                </tr>
              ))}

              {doctorStats.unassignedTotal > 0 && (
                <tr className="bg-amber-50/30">
                  <td className="py-1.5 pr-2 font-medium text-amber-800 flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[9px] shrink-0">
                      ?
                    </div>
                    <div>
                      <div className="font-bold text-amber-900 leading-tight text-xs">Sin doctor asignado</div>
                      <div className="text-[10px] text-amber-700 leading-tight">Pendientes de asignación</div>
                    </div>
                  </td>
                  <td className="py-1.5 text-center font-bold text-amber-900">{doctorStats.unassignedTotal}</td>
                  <td className="py-1.5 text-center font-bold text-emerald-700">{doctorStats.unassignedAttended}</td>
                  <td className="py-1.5 text-right font-extrabold text-amber-900 text-xs">
                    {doctorStats.formattedUnassignedBilled}
                  </td>
                </tr>
              )}

              {doctorStats.list.length === 0 && doctorStats.unassignedTotal === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-xs text-ink-400 italic">
                    No hay registro de citas ni doctores en este período ({periodLabel}).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BLOQUE 2: CURSOS */}
      <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-indigo-100 shadow-xs space-y-2.5 print:border-gray-300 print:shadow-none print:p-2">
        <div className="flex items-center justify-between border-b border-indigo-50 pb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 uppercase tracking-wider">
            <GraduationCap size={15} className="text-indigo-600" />
            <span>CURSOS</span>
          </div>
        </div>

        {/* 4 KPIs de Cursos: Activos, Alumnos, Facturación y Gastos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 print:grid-cols-4 print:gap-1.5">
          {/* Cursos Activos */}
          <div className="bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">Cursos Activos</div>
              <div className="text-xl font-black text-indigo-950 leading-tight mt-0.5">{courseStats.activeCoursesCount}</div>
              <div className="text-[10px] text-indigo-700 font-medium">
                En ejecución / abiertos
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <GraduationCap size={13} />
            </div>
          </div>

          {/* Alumnos Matriculados */}
          <div className="bg-blue-50/40 p-2.5 rounded-xl border border-blue-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">Alumnos</div>
              <div className="text-xl font-black text-blue-950 leading-tight mt-0.5">{courseStats.totalStudents}</div>
              <div className="text-[10px] text-blue-700 font-medium">
                Matriculados
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Users size={13} />
            </div>
          </div>

          {/* Facturación Cursos */}
          <div className="bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">Facturación</div>
              <div className="text-xl font-black text-emerald-700 leading-tight mt-0.5">{courseStats.formattedTotalBilledCourses}</div>
              <div className="text-[10px] text-emerald-800 font-medium">
                {courseStats.totalCourseInvoices} cobros
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <TrendingUp size={13} />
            </div>
          </div>

          {/* Gastos Cursos */}
          <div className="bg-amber-50/40 p-2.5 rounded-xl border border-amber-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">Gastos Cursos</div>
              <div className="text-xl font-black text-amber-900 leading-tight mt-0.5">{courseStats.formattedTotalCourseExpenses}</div>
              <div className="text-[10px] text-amber-700 font-medium truncate">
                Utilidad: <b className="text-emerald-800">{globalFinancials.formattedCoursesNetProfit}</b>
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <DollarSign size={13} />
            </div>
          </div>
        </div>

        {/* Tabla Resumen de Cursos */}
        <div className="overflow-x-auto pt-1">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-indigo-100 text-ink-400 font-bold uppercase text-[10px]">
                <th className="pb-1 font-semibold">Curso</th>
                <th className="pb-1 text-center font-semibold">Estado</th>
                <th className="pb-1 text-center font-semibold">Fechas (Inicio - Fin)</th>
                <th className="pb-1 text-center font-semibold">Alumnos</th>
                <th className="pb-1 text-right font-bold text-ink-900">Total Facturado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-50/60">
              {courses.map((c) => {
                const badge = COURSE_STATUS_CONFIG[c.status] || COURSE_STATUS_CONFIG.draft;

                return (
                  <tr key={c.id} className="hover:bg-indigo-50/20 transition">
                    <td className="py-1 pr-2">
                      <div className="font-bold text-ink-900 leading-tight flex items-center gap-1.5 text-xs">
                        <BookOpen size={11} className="text-indigo-600 shrink-0" />
                        <span>{c.name}</span>
                      </div>
                      <div className="text-[10px] text-ink-400 pl-4">
                        {c.modules_count > 0 ? `${c.modules_count} módulos programados` : "Módulos por definir"}
                      </div>
                    </td>
                    <td className="py-1 text-center">
                      <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-1 text-center text-ink-600 font-medium text-[11px] whitespace-nowrap">
                      {formatDateShort(c.start_date)} - {formatDateShort(c.end_date)}
                    </td>
                    <td className="py-1 text-center">
                      <span className="font-bold text-xs text-ink-900">
                        {c.enrolled_count}
                      </span>
                    </td>
                    <td className="py-1 text-right">
                      <div className="font-extrabold text-ink-950 text-xs">
                        {c.formatted_billed}
                      </div>
                      <div className="text-[10px] text-ink-400">
                        {c.invoices_count > 0 ? `${c.invoices_count} factura(s)` : "Sin facturas"}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {courses.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-xs text-ink-400 italic">
                    No se han registrado cursos en el sistema actualmente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
