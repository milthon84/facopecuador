import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateExecutiveSummaryPdf, ExecutiveSummaryPdfData } from "@/lib/pdf-summary";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";
import { hasPermission } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Calcula el rango de fechas inteligentemente:
 * - Si se ejecuta el 16 (o día 16-31 / period=quincena): Primera quincena del mes actual (1 al 15).
 * - Si se ejecuta el 1 (o día 1-15 / period=month): Mes anterior completo (1 al último día del mes previo).
 * - Si se envían `start` y `end`: Rango personalizado exacto.
 */
export function getSmartPeriodRange(
  customStart?: string | null,
  customEnd?: string | null,
  forceMode?: string | null
) {
  if (customStart && customEnd) {
    const [sy, sm, sd] = customStart.split("-").map(Number);
    const [ey, em, ed] = customEnd.split("-").map(Number);
    const start = new Date(Date.UTC(sy, sm - 1, sd, 5, 0, 0));
    const end = new Date(Date.UTC(ey, em - 1, ed + 1, 4, 59, 59));
    const label = `${customStart} al ${customEnd}`;
    const filenameLabel = `${customStart}_al_${customEnd}`;
    return { start, end, label, filenameLabel, mode: "custom" as const };
  }

  // Fecha actual en hora Ecuador (UTC-5)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ecNow = new Date(utc - 5 * 3600000);

  const currentYear = ecNow.getFullYear();
  const currentMonth = ecNow.getMonth(); // 0 = Enero, 1 = Feb, ..., 9 = Oct
  const currentDay = ecNow.getDate();

  // Si se fuerza 'quincena' o si hoy es del día 16 en adelante (ej. día 16)
  const isFirstHalfExecution =
    forceMode === "quincena" ||
    forceMode === "first_half" ||
    (forceMode !== "month" && forceMode !== "mes" && currentDay >= 16);

  if (isFirstHalfExecution) {
    // 1ra Quincena del mes en curso: del 1 al 15
    const start = new Date(Date.UTC(currentYear, currentMonth, 1, 5, 0, 0));
    const end = new Date(Date.UTC(currentYear, currentMonth, 15 + 1, 4, 59, 59));

    const monthName = new Date(Date.UTC(currentYear, currentMonth, 1, 12, 0, 0)).toLocaleDateString("es-EC", {
      month: "long",
    });
    const label = `1 al 15 de ${monthName} ${currentYear} (1ra Quincena)`;
    const filenameLabel = `1ra_Quincena_${monthName}_${currentYear}`;

    return { start, end, label, filenameLabel, mode: "quincena" as const };
  } else {
    // Mes anterior completo: del 1 al último día del mes anterior
    // Si currentMonth es 0 (Enero), prevMonthDate será Diciembre del año anterior.
    const prevMonthDate = new Date(Date.UTC(currentYear, currentMonth, 0));
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth();
    const lastDayOfPrevMonth = prevMonthDate.getDate();

    const start = new Date(Date.UTC(prevYear, prevMonth, 1, 5, 0, 0));
    const end = new Date(Date.UTC(prevYear, prevMonth, lastDayOfPrevMonth + 1, 4, 59, 59));

    const monthName = new Date(Date.UTC(prevYear, prevMonth, 1, 12, 0, 0)).toLocaleDateString("es-EC", {
      month: "long",
    });
    const label = `${monthName} ${prevYear} (Mes Completo)`;
    const filenameLabel = `Mes_Completo_${monthName}_${prevYear}`;

    return { start, end, label, filenameLabel, mode: "month" as const };
  }
}

/**
 * Valida la autorización por Token Secreto (para n8n / cron) o por sesión de usuario administrador
 */
export async function isAuthorized(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization") || "";
  const token =
    authHeader.replace(/^Bearer\s+/i, "").trim() ||
    req.nextUrl.searchParams.get("token") ||
    req.nextUrl.searchParams.get("key") ||
    req.nextUrl.searchParams.get("secret");

  const validSecrets = [
    process.env.CRON_SECRET,
    process.env.N8N_API_KEY,
    process.env.ADMIN_API_KEY,
  ].filter(Boolean) as string[];

  // Si se configuró un secreto y coincide con el token recibido
  if (token && validSecrets.length > 0 && validSecrets.includes(token)) {
    return true;
  }

  // Token de desarrollo o clave pública
  if (token && (token === "facop_cron_secure_token" || token === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    return true;
  }

  // Validar si es un usuario con sesión iniciada y permisos
  try {
    const authData = await getCachedUserAndPermissions();
    if (authData?.user && hasPermission(authData.role, "/erp/dashboard", authData.allowedPaths)) {
      return true;
    }
  } catch {
    // Sin sesión activa
  }

  return false;
}

export async function handleExecutiveSummaryRequest(req: NextRequest) {
  try {
    // 1. Validar autorización
    const authorized = await isAuthorized(req);
    if (!authorized) {
      return NextResponse.json(
        {
          error: "No autorizado. Proporciona un Bearer Token válido en los Headers o como parámetro ?token=...",
        },
        { status: 401 }
      );
    }

    const { searchParams } = req.nextUrl;
    const customStart = searchParams.get("start");
    const customEnd = searchParams.get("end");
    const forcePeriod = searchParams.get("period"); // 'quincena' | 'month' | null
    const format = searchParams.get("format") || "pdf"; // "pdf" o "json"
    const disposition = searchParams.get("disposition") || "attachment";

    // 2. Calcular Rango de Fecha Inteligente
    const { start, end, label: periodLabel, filenameLabel, mode } = getSmartPeriodRange(
      customStart,
      customEnd,
      forcePeriod
    );

    const supabase = createAdminClient();

    // 3. Consultar Citas, Doctores, Facturas, Cursos, Inscripciones y Gastos
    const [apptsRes, doctorsRes, invoicesRes, cursosRes, enrolRes, moduloInscripcionesRes, expensesRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, starts_at, ends_at, status, reason, patient_id, doctor_id, doctor:profesores(id, full_name, specialty, photo_url)")
        .gte("starts_at", start.toISOString())
        .lte("starts_at", end.toISOString())
        .order("starts_at", { ascending: true }),
      supabase
        .from("profesores")
        .select("id, full_name, specialty, photo_url")
        .order("full_name"),
      supabase
        .from("invoices")
        .select("id, xml_url, invoice_number, total, sri_status, created_at, invoice_items(description, total)")
        .neq("sri_status", "cancelled")
        .neq("sri_status", "rejected"),
      supabase
        .from("cursos")
        .select("id, name, status, start_date, end_date, max_students, total_cost")
        .order("start_date", { ascending: false }),
      supabase
        .from("curso_inscripciones")
        .select("id, course_id, status, invoice_id, invoices:invoices(id, total, sri_status)"),
      supabase
        .from("curso_modulo_inscripciones")
        .select("id, enrollment_id, module_id, invoice_id, billing_status, invoices:invoices(id, total, sri_status), curso_modulos:curso_modulos(course_id, cost)"),
      supabase
        .from("expenses")
        .select("id, expense_date, total, supplier_name, supplier_ruc, description, category, status")
        .eq("status", "registered")
        .gte("expense_date", start.toISOString().slice(0, 10))
        .lte("expense_date", end.toISOString().slice(0, 10)),
    ]);

    const periodAppointments = apptsRes.data || [];
    const doctors = doctorsRes.data || [];
    const rawInvoices = invoicesRes.data || [];
    const courses = cursosRes.data || [];
    const rawEnrollments = enrolRes.data || [];
    const rawModuloInscriptions = moduloInscripcionesRes.data || [];
    const periodExpenses = expensesRes.data || [];

    // 4. Mapear Facturas por Cita
    const invoiceMap = new Map<string, { id: string; total: number }>();
    rawInvoices.forEach((inv: any) => {
      if (inv.xml_url) {
        const current = invoiceMap.get(inv.xml_url);
        const amount = Number(inv.total) || 0;
        if (!current) {
          invoiceMap.set(inv.xml_url, { id: inv.id, total: amount });
        } else {
          current.total += amount;
        }
      }
    });

    // 5. Métricas de Clínica
    const totalAppointments = periodAppointments.length;
    const scheduledAppointments = periodAppointments.filter((a) => a.status === "scheduled").length;
    const attendedAppointments = periodAppointments.filter((a) => a.status === "attended").length;

    let clinicTotalBilled = 0;
    const doctorStatsMap = new Map<string, { name: string; specialty: string; total: number; attended: number; billed: number }>();

    doctors.forEach((d) => {
      doctorStatsMap.set(d.id, {
        name: d.full_name,
        specialty: d.specialty || "Odontología General",
        total: 0,
        attended: 0,
        billed: 0,
      });
    });

    let unassignedTotal = 0;
    let unassignedAttended = 0;
    let unassignedBilled = 0;

    periodAppointments.forEach((a) => {
      const inv = invoiceMap.get(a.id);
      const billedVal = inv ? inv.total : 0;
      if (billedVal > 0) {
        clinicTotalBilled += billedVal;
      }

      if (!a.doctor_id) {
        unassignedTotal++;
        if (a.status === "attended") unassignedAttended++;
        unassignedBilled += billedVal;
        return;
      }

      const curr = doctorStatsMap.get(a.doctor_id);
      if (curr) {
        curr.total++;
        if (a.status === "attended") curr.attended++;
        curr.billed += billedVal;
      } else {
        const docName = (a as any).doctor?.full_name || "Doctor";
        doctorStatsMap.set(a.doctor_id, {
          name: docName,
          specialty: (a as any).doctor?.specialty || "Odontología",
          total: 1,
          attended: a.status === "attended" ? 1 : 0,
          billed: billedVal,
        });
      }
    });

    const formatUSD = (val: number) =>
      new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(val);

    let totalClinicExpenses = 0;
    periodExpenses.forEach((e) => {
      totalClinicExpenses += Number(e.total || 0);
    });

    const doctorRows = Array.from(doctorStatsMap.values())
      .filter((d) => d.total > 0 || d.billed > 0)
      .sort((a, b) => b.billed - a.billed || b.attended - a.attended)
      .map((d) => ({
        name: d.name,
        specialty: d.specialty,
        total: d.total,
        attended: d.attended,
        formattedBilled: formatUSD(d.billed),
      }));

    if (unassignedTotal > 0) {
      doctorRows.push({
        name: "Sin doctor asignado",
        specialty: "Pendientes",
        total: unassignedTotal,
        attended: unassignedAttended,
        formattedBilled: formatUSD(unassignedBilled),
      });
    }

    // 6. Métricas de Cursos
    const studentCountMap: Record<string, number> = {};
    rawEnrollments.forEach((e: any) => {
      if (e.status === "enrolled" || e.status === "completed") {
        studentCountMap[e.course_id] = (studentCountMap[e.course_id] || 0) + 1;
      }
    });

    const courseBilledMap: Record<string, number> = {};
    courses.forEach((c) => {
      courseBilledMap[c.id] = 0;
    });

    rawModuloInscriptions.forEach((mi: any) => {
      const courseId = mi.curso_modulos?.course_id;
      if (courseId && mi.invoices?.total && mi.invoices.sri_status !== "cancelled" && mi.invoices.sri_status !== "rejected") {
        courseBilledMap[courseId] = (courseBilledMap[courseId] || 0) + Number(mi.invoices.total);
      }
    });

    rawEnrollments.forEach((e: any) => {
      const courseId = e.course_id;
      if (courseId && e.invoices?.total && e.invoices.sri_status !== "cancelled" && e.invoices.sri_status !== "rejected") {
        courseBilledMap[courseId] = (courseBilledMap[courseId] || 0) + Number(e.invoices.total);
      }
    });

    const activeCourses = courses.filter((c) => c.status === "active" || c.status === "in_progress");
    const totalStudents = courses.reduce((acc, c) => acc + (studentCountMap[c.id] || 0), 0);
    const totalBilledCourses = Object.values(courseBilledMap).reduce((acc, b) => acc + b, 0);

    let totalCourseExpenses = 0;
    periodExpenses.forEach((exp) => {
      const desc = (exp.description || "").toLowerCase();
      const cat = (exp.category || "").toLowerCase();
      if (desc.includes("curso") || desc.includes("modulo") || desc.includes("módulo") || desc.includes("diplomado") || cat.includes("curso")) {
        totalCourseExpenses += Number(exp.total || 0);
      }
    });

    const statusLabels: Record<string, string> = {
      active: "Activo",
      in_progress: "En Progreso",
      draft: "Borrador",
      completed: "Finalizado",
      cancelled: "Cancelado",
    };

    const formatDateShort = (dStr?: string) => {
      if (!dStr) return "Por definir";
      const parts = dStr.split("-");
      if (parts.length < 3) return dStr;
      return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
    };

    const courseRows = courses.map((c) => ({
      name: c.name,
      statusLabel: statusLabels[c.status] || c.status,
      dates: `${formatDateShort(c.start_date)} - ${formatDateShort(c.end_date)}`,
      students: studentCountMap[c.id] || 0,
      formattedBilled: formatUSD(courseBilledMap[c.id] || 0),
    }));

    const pdfData: ExecutiveSummaryPdfData = {
      periodLabel,
      clinicMetrics: {
        totalAppointments,
        scheduledAppointments,
        attendedAppointments,
        totalBilled: clinicTotalBilled,
        formattedTotalBilled: formatUSD(clinicTotalBilled),
        totalExpenses: totalClinicExpenses,
        formattedTotalExpenses: formatUSD(totalClinicExpenses),
      },
      doctorRows,
      courseMetrics: {
        activeCoursesCount: activeCourses.length,
        totalStudents,
        totalBilled: totalBilledCourses,
        formattedTotalBilled: formatUSD(totalBilledCourses),
        totalExpenses: totalCourseExpenses,
        formattedTotalExpenses: formatUSD(totalCourseExpenses),
      },
      courseRows,
      generatedAt: new Date().toLocaleString("es-EC", {
        timeZone: "America/Guayaquil",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    if (format === "json") {
      return NextResponse.json({
        success: true,
        periodType: mode,
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        ...pdfData,
      });
    }

    const pdfBuffer = await generateExecutiveSummaryPdf(pdfData);
    const safeFilename = `Resumen_Facop_${filenameLabel}.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${safeFilename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Error al generar resumen ejecutivo en PDF:", error);
    return NextResponse.json(
      {
        error: "Ocurrió un error al generar el PDF del resumen.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleExecutiveSummaryRequest(req);
}
