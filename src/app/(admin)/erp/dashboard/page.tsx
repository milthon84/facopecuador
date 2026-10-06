import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { hasPermission, getFirstAllowedPath } from "@/lib/roles";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";
import DashboardClient from "./DashboardClient";
import type { AppointmentData, DoctorOption } from "./DashboardClient";
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

  // 2. Cargar catálogo de doctores, citas históricas y facturas emitidas
  const [apptsRes, doctorsRes, invoicesRes] = await Promise.all([
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
      .select("id, xml_url, invoice_number, total, sri_status, created_at")
      .neq("sri_status", "cancelled")
      .neq("sri_status", "rejected"),
  ]);

  const rawAppointments = apptsRes.data || [];
  const rawInvoices = invoicesRes.data || [];

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

  return (
    <DashboardClient
      initialAppointments={appointments}
      doctors={doctors}
    />
  );
}
