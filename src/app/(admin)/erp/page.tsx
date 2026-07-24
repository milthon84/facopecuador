import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatTimeLocal } from "@/lib/availability";
import { hasPermission } from "@/lib/roles";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";

// Ecuador siempre UTC-5, sin horario de verano
const EC_TZ = "America/Guayaquil";

/** Devuelve la fecha actual como string "YYYY-MM-DD" en zona Ecuador */
function todayInEcuador(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: EC_TZ });
}

/** Convierte una fecha "YYYY-MM-DD" en Ecuador al inicio de ese día en UTC */
function ecDayStartUTC(ecDateStr: string): string {
  const [y, m, d] = ecDateStr.split("-").map(Number);
  // Medianoche Ecuador = 05:00 UTC (UTC-5)
  return new Date(Date.UTC(y, m - 1, d, 5, 0, 0)).toISOString();
}

/** Convierte una fecha "YYYY-MM-DD" en Ecuador al fin de ese día en UTC */
function ecDayEndUTC(ecDateStr: string): string {
  const [y, m, d] = ecDateStr.split("-").map(Number);
  // 23:59:59 Ecuador = día siguiente a las 04:59:59 UTC
  return new Date(Date.UTC(y, m - 1, d + 1, 4, 59, 59)).toISOString();
}

import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import SendReminderButton from "@/components/SendReminderButton";
import QuickAppointmentActions from "@/components/QuickAppointmentActions";
import BillingPendingButton from "@/components/BillingPendingButton";

export const dynamic = "force-dynamic";

export default async function AdminDashboard({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const supabase = createAdminClient();

  // Determinar la fecha objetivo en timezone Ecuador
  const todayEc = todayInEcuador(); // "YYYY-MM-DD" en hora Ecuador
  const targetDateParam = searchParams?.date;
  // Usamos el param si viene, de lo contrario la fecha de hoy en Ecuador
  const targetEcDate = (targetDateParam && /^\d{4}-\d{2}-\d{2}$/.test(targetDateParam))
    ? targetDateParam
    : todayEc;

  // Rango del día completo en UTC, respetando la zona Ecuador
  const startOfDay = ecDayStartUTC(targetEcDate);
  const endOfDay   = ecDayEndUTC(targetEcDate);

  // Fechas de navegación (trabajamos solo con strings YYYY-MM-DD)
  const [ty, tm, td] = targetEcDate.split("-").map(Number);
  const prevDateObj = new Date(Date.UTC(ty, tm - 1, td - 1));
  const nextDateObj = new Date(Date.UTC(ty, tm - 1, td + 1));
  const prevDateStr = prevDateObj.toISOString().slice(0, 10);
  const nextDateStr = nextDateObj.toISOString().slice(0, 10);

  const isTargetToday = targetEcDate === todayEc;
  const displayTitle = isTargetToday
    ? "Hoy"
    : new Date(targetEcDate + "T12:00:00-05:00").toLocaleDateString("es-EC", {
        weekday: "long",
      });

  // Ejecutar consulta de citas y datos de usuario en paralelo
  const [authData, todayRes] = await Promise.all([
    getCachedUserAndPermissions(),
    supabase
      .from("appointments")
      .select(
        "id, starts_at, ends_at, status, reason, reminder_sent_at, patient:patients(id, full_name, phone, document_number, email), dental_consultation:dental_consultations(id)"
      )
      .gte("starts_at", startOfDay)
      .lte("starts_at", endOfDay)
      .order("starts_at")
  ]);

  const { role, allowedPaths } = authData;
  const canModify = hasPermission(role, "/erp/modificar", allowedPaths);
  const canModifyBilling = hasPermission(role, "/erp/facturacion/modificar", allowedPaths);

  const todayAppts = todayRes.data;
  const targetDateStr = targetEcDate;

  const appts = todayAppts || [];
  const apptIds = appts.map((a) => a.id);

  // Consultar facturas enlazadas a las citas de este día (usando la columna xml_url que guarda el appointment_id)
  const { data: matchedInvoices } = apptIds.length > 0
    ? await supabase
        .from("invoices")
        .select("xml_url, invoice_number")
        .in("xml_url", apptIds)
        .neq("sri_status", "cancelled")
    : { data: [] };
  
  const billedApptInvoices = new Map<string, string>();
  matchedInvoices?.forEach((inv) => {
    if (inv.xml_url && inv.invoice_number) {
      billedApptInvoices.set(inv.xml_url, inv.invoice_number);
    }
  });
  const scheduled = appts.filter((a) => a.status === "scheduled");
  const attended = appts.filter((a) => a.status === "attended");
  const noShow = appts.filter((a) => a.status === "no_show");
  const cancelled = appts.filter((a) => a.status === "cancelled");
  const total = appts.length;
  const processed = attended.length + noShow.length + cancelled.length;
  const processPct = total > 0 ? Math.round((processed / total) * 100) : 0;

  // Grupos para la lista (solo los que tienen citas)
  const groups = [
    {
      key: "scheduled",
      label: "Pendientes",
      items: scheduled,
      dotColor: "bg-lilac-400",
      headerColor: "bg-lilac-50 text-lilac-700",
    },
    {
      key: "attended",
      label: "Atendidas",
      items: attended,
      dotColor: "bg-green-400",
      headerColor: "bg-green-50 text-green-700",
    },
    {
      key: "no_show",
      label: "No asistieron",
      items: noShow,
      dotColor: "bg-amber-400",
      headerColor: "bg-amber-50 text-amber-700",
    },
    {
      key: "cancelled",
      label: "Canceladas",
      items: cancelled,
      dotColor: "bg-red-400",
      headerColor: "bg-red-50 text-red-700",
    },
  ].filter((g) => g.items.length > 0);

  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold capitalize">{displayTitle}</h1>
            <div className="flex items-center bg-white border border-lilac-100 rounded-lg overflow-hidden shadow-sm">
              <Link
                href={`/erp?date=${prevDateStr}`}
                className="p-1.5 hover:bg-lilac-50 text-ink-600 transition"
                title="Día anterior"
              >
                <ChevronLeft size={20} />
              </Link>
              {!isTargetToday && (
                <Link
                  href="/erp"
                  className="px-3 py-1.5 text-xs font-medium text-lilac-700 hover:bg-lilac-50 border-x border-lilac-100 transition"
                >
                  Hoy
                </Link>
              )}
              <Link
                href={`/erp?date=${nextDateStr}`}
                className="p-1.5 hover:bg-lilac-50 text-ink-600 transition"
                title="Día siguiente"
              >
                <ChevronRight size={20} />
              </Link>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {total > 0 && (
            <div className="shrink-0 text-right hidden sm:block">
              <div className="w-36 bg-lilac-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-lilac-500 h-2 rounded-full"
                  style={{ width: `${processPct}%` }}
                />
              </div>
              <div className="text-xs font-medium text-lilac-700 mt-1">
                {processPct}% del día completado
              </div>
            </div>
          )}
          {canModify && (
            <Link
              href={`/erp/citas/nueva?date=${targetDateStr}`}
              className="flex items-center gap-1.5 bg-lilac-600 text-white text-xs sm:text-sm px-3.5 py-2 rounded-xl hover:bg-lilac-700 transition font-medium shadow-sm"
            >
              <Plus size={15} /> Nueva Cita
            </Link>
          )}
        </div>
      </div>

      {/* Stats compactas */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: "Agendadas",  short: "Agendadas",  value: scheduled.length, bg: "bg-lilac-50", text: "text-lilac-600", icon: <Clock size={11} /> },
          { label: "Atendidas",  short: "Atendidas",  value: attended.length,  bg: "bg-green-50",  text: "text-green-600",  icon: <CheckCircle2 size={11} /> },
          { label: "No asistió", short: "No asistió", value: noShow.length,    bg: "bg-amber-50",  text: "text-amber-600",  icon: <AlertCircle size={11} /> },
          { label: "Canceladas", short: "Canceladas", value: cancelled.length, bg: "bg-red-50",    text: "text-red-600",    icon: <XCircle size={11} /> },
        ].map(({ label, short, value, bg, text, icon }) => (
          <div key={label} className={`rounded-xl p-3 ${bg}`}>
            <div className={`flex items-center gap-1 text-[10px] uppercase tracking-wide mb-1.5 opacity-70 ${text} truncate`}>
              {icon}
              <span className="truncate">{short}</span>
            </div>
            <div className={`text-2xl font-bold leading-none ${text}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Lista de citas */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-lilac-100 flex items-center justify-between">
          <h2 className="font-semibold">
            {isTargetToday ? "Citas de hoy" : `Citas del ${new Date(targetEcDate + "T12:00:00-05:00").toLocaleDateString("es-EC", { day: "numeric", month: "long" })}`}
          </h2>
          <Link
            href="/erp/calendario"
            className="text-sm text-lilac-700 hover:underline"
          >
            Ver calendario →
          </Link>
        </div>

        {total === 0 ? (
          <div className="p-8 text-center text-sm text-ink-600">
            {isTargetToday ? "No hay citas programadas para hoy." : "No hay citas programadas para este día."}
          </div>
        ) : (
          <ul className="divide-y divide-lilac-50">
            {appts.map((appt) => {
              const p = Array.isArray(appt.patient)
                ? appt.patient[0]
                : appt.patient;
              const dt = new Date(appt.starts_at);
              const hasFicha = Array.isArray(appt.dental_consultation)
                ? appt.dental_consultation.length > 0
                : !!appt.dental_consultation;

              const invoiceNumber = billedApptInvoices.get(appt.id);
              const isBilled = !!invoiceNumber;

              return (
                <li key={appt.id}>
                  <Link
                    href={`/erp/citas/${appt.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-lilac-50 transition flex-wrap md:flex-nowrap"
                  >
                    {/* Hora */}
                    <div className="w-12 md:w-16 shrink-0 text-center md:text-left">
                      <div className="font-bold text-sm leading-tight text-ink-900">
                        {formatTimeLocal(dt)}
                      </div>
                    </div>

                    {/* Info paciente */}
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-medium text-sm text-ink-900 truncate">
                        {p?.full_name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {p?.phone && (
                          <span className="text-xs text-ink-600">
                            {p.phone}
                          </span>
                        )}
                        {(p as any)?.document_number && (
                          <span className="text-xs text-ink-600 opacity-60">
                            CC {(p as any).document_number}
                          </span>
                        )}
                      </div>
                      {appt.reason && (
                        <div className="text-xs text-ink-600 mt-0.5 line-clamp-1 italic">
                          {appt.reason}
                        </div>
                      )}
                    </div>

                    {/* Botones de acción rápida (En el medio) */}
                    {canModify && (
                      <div className="shrink-0 w-full md:w-[320px] flex items-center md:justify-center mt-2 md:mt-0">
                        {appt.status === "scheduled" && (
                          <QuickAppointmentActions appointmentId={appt.id} />
                        )}
                      </div>
                    )}

                    {/* Badges */}
                    <div className="shrink-0 w-[220px] flex flex-col items-end gap-1.5 ml-auto md:ml-0 mt-2 md:mt-0">
                      <StatusBadge status={appt.status} />
                      {appt.status === "scheduled" && new Date().getTime() < new Date(appt.starts_at).getTime() && (
                        <SendReminderButton
                          appointmentId={appt.id}
                          reminderSentAt={appt.reminder_sent_at}
                          patientEmail={p?.email}
                          patientName={p?.full_name}
                          patientPhone={p?.phone}
                          startsAt={appt.starts_at}
                          reason={appt.reason}
                        />
                      )}
                      {hasFicha && (
                        isBilled ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border border-green-200 bg-green-50 text-green-700 shadow-sm whitespace-nowrap" title={`Factura No. ${invoiceNumber}`}>
                            <CheckCircle2 size={12} className="text-green-600" />
                            <span>Facturado ({invoiceNumber})</span>
                          </span>
                        ) : (
                          canModifyBilling ? (
                            <BillingPendingButton patientId={p?.id} appointmentId={appt.id} />
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-700 shadow-sm whitespace-nowrap">
                              <span>Pendiente Facturar</span>
                            </span>
                          )
                        )
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { label: string; cls: string; icon: React.ReactNode }
  > = {
    scheduled: {
      label: "Agendada",
      cls: "bg-lilac-100 text-lilac-700",
      icon: <Clock size={11} />,
    },
    attended: {
      label: "Atendida",
      cls: "bg-green-100 text-green-700",
      icon: <CheckCircle2 size={11} />,
    },
    no_show: {
      label: "No asistió",
      cls: "bg-amber-100 text-amber-700",
      icon: <AlertCircle size={11} />,
    },
    cancelled: {
      label: "Cancelada",
      cls: "bg-red-100 text-red-700",
      icon: <XCircle size={11} />,
    },
  };
  const cfg = map[status] ?? map.scheduled;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.cls}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
