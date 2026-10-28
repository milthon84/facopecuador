import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { hasPermission, getFirstAllowedPath } from "@/lib/roles";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";
import DashboardClient from "./DashboardClient";
import type {
  AppointmentData,
  DoctorOption,
  CourseSummaryData,
  DoctorExpenseData,
  OtherInvoiceData,
  CoworkingRentalData,
} from "./DashboardClient";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  // 1. Verificar autenticación y permisos de acceso al dashboard
  const authData = await getCachedUserAndPermissions();
  const { role, allowedPaths } = authData;

  const hasAccess =
    hasPermission(role, "/erp/dashboard", allowedPaths) ||
    hasPermission(role, "/erp", allowedPaths);

  if (!hasAccess) {
    const firstAllowed = getFirstAllowedPath(role, allowedPaths);
    if (firstAllowed !== "/erp/dashboard") {
      redirect(firstAllowed);
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-xl font-bold text-ink-900 mb-2">Acceso Denegado</h1>
        <p className="text-sm text-ink-600 max-w-md">
          No tienes permisos asignados para ver el Resumen y Estadísticas Clínicas.
        </p>
      </div>
    );
  }

  const supabase = createAdminClient();

  // 2. Cargar doctores, citas históricas, facturas emitidas, cursos, inscripciones, módulos, gastos y coworking
  const [apptsRes, doctorsRes, invoicesRes, cursosRes, enrolRes, moduloInscripcionesRes, expensesRes, coworkingRes] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, starts_at, ends_at, status, reason, patient_id, doctor_id, patient:patients(id, full_name, document_number, phone, email), doctor:profesores(id, full_name, specialty, photo_url), dental_consultation:dental_consultations(id, treatment_notes, created_at)"
      )
      .order("starts_at", { ascending: false }),
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
      .select("id, name, status, start_date, end_date, max_students, total_cost, curso_modulos(id, cost)")
      .order("start_date", { ascending: false }),
    supabase
      .from("curso_inscripciones")
      .select("id, course_id, status, invoice_id, invoices:invoices(id, total, sri_status)"),
    supabase
      .from("curso_modulo_inscripciones")
      .select("id, enrollment_id, module_id, invoice_id, billing_status, invoices:invoices(id, total, sri_status), curso_modulos:curso_modulos(course_id, cost)"),
    supabase
      .from("expenses")
      .select("id, expense_date, total, supplier_name, supplier_ruc, description, category, status, notes")
      .eq("status", "registered"),
    supabase
      .from("coworking_rentals")
      .select("id, rental_date, start_time, end_time, hours, status, resource_type, resource_identifier, doctor_name, doctor_document, doctor_phone, doctor_email, total_price, invoice_id, invoice_number, created_at")
      .order("rental_date", { ascending: false }),
  ]);

  const rawAppointments = apptsRes.data || [];
  const rawInvoices = invoicesRes.data || [];
  const rawCursos = cursosRes.data || [];
  const rawEnrollments = enrolRes.data || [];
  const rawModuloInscriptions = moduloInscripcionesRes.data || [];
  const rawRentals = coworkingRes.data || [];
  const { resolveExpenseArea } = await import("@/lib/expense-areas");
  const rawExpenses = (expensesRes.data || []).map((e: any) => ({
    ...e,
    resolvedArea: resolveExpenseArea(e),
  }));

  // Mapear cantidad de alumnos únicos por curso
  const studentCountMap: Record<string, Set<string>> = {};
  rawCursos.forEach((c: any) => {
    studentCountMap[c.id] = new Set();
  });

  rawEnrollments.forEach((e: any) => {
    if (e.course_id && e.status !== "dropped" && e.status !== "cancelled") {
      const studentId = e.student_id || e.id;
      if (!studentCountMap[e.course_id]) {
        studentCountMap[e.course_id] = new Set();
      }
      studentCountMap[e.course_id].add(studentId);
    }
  });

  rawModuloInscriptions.forEach((mi: any) => {
    const courseId = mi.curso_modulos?.course_id;
    if (courseId && mi.enrollment_id) {
      if (!studentCountMap[courseId]) {
        studentCountMap[courseId] = new Set();
      }
      studentCountMap[courseId].add(mi.enrollment_id);
    }
  });

  // Mapear facturas por appointment_id (guardado en xml_url)
  const invoiceMap = new Map<string, { id: string; total: number; invoice_number: string; sri_status: string }>();
  rawInvoices.forEach((inv: any) => {
    if (inv.xml_url) {
      const current = invoiceMap.get(inv.xml_url);
      const amount = Number(inv.total) || 0;
      if (!current) {
        invoiceMap.set(inv.xml_url, {
          id: inv.id,
          total: amount,
          invoice_number: inv.invoice_number,
          sri_status: inv.sri_status,
        });
      } else {
        current.total += amount;
      }
    }
  });

  // Calcular montos facturados por cada curso
  const courseBilledMap: Record<string, { total: number; invoiceIds: Set<string> }> = {};
  rawCursos.forEach((c: any) => {
    courseBilledMap[c.id] = { total: 0, invoiceIds: new Set() };
  });

  // 1. Por módulos facturados con invoice_id
  rawModuloInscriptions.forEach((mi: any) => {
    const courseId = mi.curso_modulos?.course_id;
    if (courseId && courseBilledMap[courseId] && mi.invoice_id) {
      if (!courseBilledMap[courseId].invoiceIds.has(mi.invoice_id)) {
        courseBilledMap[courseId].invoiceIds.add(mi.invoice_id);
        const invTotal = Number(mi.invoices?.total || 0);
        if (invTotal > 0 && mi.invoices?.sri_status !== "cancelled" && mi.invoices?.sri_status !== "rejected") {
          courseBilledMap[courseId].total += invTotal;
        }
      }
    }
  });

  // 2. Por inscripciones completas con invoice_id
  rawEnrollments.forEach((e: any) => {
    const courseId = e.course_id;
    if (courseId && courseBilledMap[courseId] && e.invoice_id) {
      if (!courseBilledMap[courseId].invoiceIds.has(e.invoice_id)) {
        courseBilledMap[courseId].invoiceIds.add(e.invoice_id);
        const invTotal = Number(e.invoices?.total || 0);
        if (invTotal > 0 && e.invoices?.sri_status !== "cancelled" && e.invoices?.sri_status !== "rejected") {
          courseBilledMap[courseId].total += invTotal;
        }
      }
    }
  });

  // 3. Por ítems de facturas cuyo texto coincida con el nombre del curso
  rawInvoices.forEach((inv: any) => {
    const items = inv.invoice_items || [];
    items.forEach((item: any) => {
      const desc = (item.description || "").toLowerCase();
      rawCursos.forEach((c: any) => {
        const courseName = (c.name || "").toLowerCase();
        if (courseName && desc.includes(courseName)) {
          if (!courseBilledMap[c.id].invoiceIds.has(inv.id)) {
            courseBilledMap[c.id].invoiceIds.add(inv.id);
            const itemTotal = Number(item.total || inv.total || 0);
            if (itemTotal > 0) {
              courseBilledMap[c.id].total += itemTotal;
            }
          }
        }
      });
    });
  });

  // Filtrar cursos no relevantes (cancelados/eliminados, o finalizados/borrador sin alumnos ni facturación)
  const relevantRawCursos = rawCursos.filter((c: any) => {
    if (c.status === "cancelled" || c.status === "deleted") return false;
    const billed = courseBilledMap[c.id]?.total || 0;
    const students = studentCountMap[c.id]?.size || 0;
    if (billed > 0) return true;
    if (c.status === "completed") return false;
    if (c.status === "draft" && students === 0 && billed === 0) return false;
    if (c.status === "active" || c.status === "in_progress") return true;
    return students > 0;
  });

  const courses: CourseSummaryData[] = relevantRawCursos.map((c: any) => {
    const billedInfo = courseBilledMap[c.id] || { total: 0, invoiceIds: new Set() };
    return {
      id: c.id,
      name: c.name,
      status: c.status || "draft",
      start_date: c.start_date || "",
      end_date: c.end_date || "",
      max_students: c.max_students ?? null,
      total_cost: Number(c.total_cost) || 0,
      enrolled_count: studentCountMap[c.id]?.size || 0,
      modules_count: Array.isArray(c.curso_modulos) ? c.curso_modulos.length : 0,
      billed_amount: billedInfo.total,
      formatted_billed: new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
      }).format(billedInfo.total),
      invoices_count: billedInfo.invoiceIds.size,
    };
  });

  const doctors: DoctorOption[] = (doctorsRes.data || []).map((d: any) => ({
    id: d.id,
    full_name: d.full_name,
    specialty: d.specialty,
    photo_url: d.photo_url,
  }));

  const appointments: AppointmentData[] = rawAppointments.map((a: any) => {
    const inv = invoiceMap.get(a.id) || null;
    return {
      id: a.id,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      status: a.status,
      reason: a.reason,
      patient_id: a.patient_id,
      doctor_id: a.doctor_id,
      patient: Array.isArray(a.patient) ? a.patient[0] : a.patient,
      doctor: Array.isArray(a.doctor) ? a.doctor[0] : a.doctor,
      dental_consultation: Array.isArray(a.dental_consultation)
        ? a.dental_consultation[0]
        : a.dental_consultation,
      invoice: inv,
      billed_amount: inv ? inv.total : 0,
    };
  });

  // Mapa de facturas por ID
  const invoiceByIdMap = new Map<string, any>();
  rawInvoices.forEach((inv: any) => {
    invoiceByIdMap.set(inv.id, inv);
  });

  // Mapear alquileres coworking
  const coworkingInvoiceIds = new Set<string>();
  const coworkingRentals: CoworkingRentalData[] = rawRentals.map((r: any) => {
    const inv = r.invoice_id ? invoiceByIdMap.get(r.invoice_id) : null;
    if (r.invoice_id) {
      coworkingInvoiceIds.add(r.invoice_id);
    }
    return {
      id: r.id,
      rental_date: r.rental_date,
      start_time: r.start_time,
      end_time: r.end_time,
      hours: Number(r.hours) || 0,
      status: r.status,
      resource_type: r.resource_type,
      resource_identifier: r.resource_identifier,
      doctor_name: r.doctor_name || "Profesional Externo",
      doctor_document: r.doctor_document,
      doctor_phone: r.doctor_phone,
      doctor_email: r.doctor_email,
      total_price: Number(r.total_price) || 0,
      invoice_id: r.invoice_id,
      invoice_number: r.invoice_number || inv?.invoice_number || null,
      created_at: r.created_at,
      invoice: inv
        ? {
            id: inv.id,
            total: Number(inv.total) || 0,
            invoice_number: inv.invoice_number,
            sri_status: inv.sri_status,
          }
        : null,
    };
  });

  // Identificar facturas que NO pertenezcan a clínica (citas), ni cursos, ni coworking
  const allCourseInvoiceIds = new Set<string>();
  Object.values(courseBilledMap).forEach((info) => {
    info.invoiceIds.forEach((id) => allCourseInvoiceIds.add(id));
  });

  const apptIds = new Set(rawAppointments.map((a: any) => a.id));

  const otherInvoices: OtherInvoiceData[] = rawInvoices
    .filter((inv: any) => {
      const isClinic = Boolean(inv.xml_url && apptIds.has(inv.xml_url));
      const isCourse = allCourseInvoiceIds.has(inv.id);
      const isCoworking = coworkingInvoiceIds.has(inv.id);
      return !isClinic && !isCourse && !isCoworking;
    })
    .map((inv: any) => ({
      id: inv.id,
      invoice_number: inv.invoice_number || "",
      total: Number(inv.total) || 0,
      created_at: inv.created_at,
      description: inv.invoice_items?.[0]?.description || "Factura General / Otros",
    }));

  return (
    <DashboardClient
      initialAppointments={appointments}
      doctors={doctors}
      courses={courses}
      expenses={rawExpenses}
      otherInvoices={otherInvoices}
      coworkingRentals={coworkingRentals}
    />
  );
}
