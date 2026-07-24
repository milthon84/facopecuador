import { createAdminClient } from "@/lib/supabase/admin";
import { formatTimeLocal } from "@/lib/availability";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, IdCard, Calendar, CheckCircle2, Receipt } from "lucide-react";
import AppointmentActions from "@/components/AppointmentActions";
import SendReminderButton from "@/components/SendReminderButton";
import EditPatientModal from "@/components/EditPatientModal";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/roles";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CitaDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Ejecutar consultas de cita, permisos, consulta y factura en paralelo
  const [apptRes, authData, consultationRes, invoiceRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, patient:patients(*)")
      .eq("id", id)
      .single(),
    getCachedUserAndPermissions(),
    supabase
      .from("dental_consultations")
      .select("*")
      .eq("appointment_id", id)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select("id, invoice_number")
      .eq("xml_url", id)
      .neq("sri_status", "cancelled")
      .limit(1)
  ]);

  const appt = apptRes.data;
  if (!appt) return notFound();
  const patient = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;

  const { role, allowedPaths } = authData;
  const canModifyPatient = hasPermission(role, "/erp/pacientes/modificar", allowedPaths);
  const canModifyCalendar = hasPermission(role, "/erp/modificar", allowedPaths) || 
                            hasPermission(role, "/erp/calendario/modificar", allowedPaths);
  const canModifyBilling = hasPermission(role, "/erp/facturacion/modificar", allowedPaths);

  const start = new Date(appt.starts_at);
  const end = new Date(appt.ends_at);

  // Historial del paciente (se ejecuta secuencial porque depende de patient.id)
  const { data: history } = patient
    ? await supabase
        .from("appointments")
        .select("id, starts_at, status, reason")
        .eq("patient_id", patient.id)
        .neq("id", appt.id)
        .order("starts_at", { ascending: false })
        .limit(10)
    : { data: [] };

  const consultation = consultationRes.data;
  const invoice = invoiceRes.data;

  const isBilled = !!(invoice && invoice.length > 0);
  const invoiceNumber = invoice && invoice.length > 0 ? invoice[0].invoice_number : null;

  return (
    <div className="max-w-3xl">
      <Link href="/erp/calendario" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-4">
        <ArrowLeft size={16} /> Volver
      </Link>

      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold mb-1">{patient.full_name}</h1>
            <div className="text-sm text-ink-600 capitalize">
              {start.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              {" · "}
              {formatTimeLocal(start)}
              {" – "}
              {formatTimeLocal(end)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={appt.status} />
            {appt.status === "scheduled" && new Date().getTime() < new Date(appt.starts_at).getTime() && (
              <SendReminderButton
                appointmentId={appt.id}
                reminderSentAt={appt.reminder_sent_at}
                patientEmail={patient.email}
                patientName={patient.full_name}
                patientPhone={patient.phone}
                startsAt={appt.starts_at}
                reason={appt.reason}
              />
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          {patient.document_number && (
            <InfoRow icon={<IdCard size={14} />} label="Cédula" value={patient.document_number} />
          )}
          {patient.phone && <InfoRow icon={<Phone size={14} />} label="Teléfono" value={patient.phone} />}
          {patient.email && <InfoRow icon={<Mail size={14} />} label="Email" value={patient.email} />}
        </div>

        {/* Botón editar datos del paciente */}
        {canModifyPatient && (
          <div className="mb-4">
            <EditPatientModal
              patient={{
                id: patient.id,
                full_name: patient.full_name,
                phone: patient.phone,
                email: patient.email,
                document_number: patient.document_number,
              }}
            />
          </div>
        )}

        {appt.reason && (
          <div className="bg-lilac-50 rounded-lg p-3 mb-4">
            <div className="text-xs text-lilac-700 uppercase mb-1">Motivo</div>
            <div className="text-sm">{appt.reason}</div>
          </div>
        )}

        <AppointmentActions 
          appointment={JSON.parse(JSON.stringify(appt))} 
          isBilled={isBilled} 
          invoiceNumber={invoiceNumber} 
          canModifyCalendar={canModifyCalendar}
          canModifyBilling={canModifyBilling}
        />
      </div>

      {appt.status === "attended" && !consultation && (
        <div className="bg-gold-50 border border-gold-200 rounded-2xl p-5 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gold-900 flex items-center gap-2">
              <CheckCircle2 className="text-gold-600" size={18} /> Registrar Ficha y Atención
            </h3>
            <p className="text-xs text-gold-800 mt-1">
              Esta cita ha sido marcada como atendida. Ahora puedes rellenar los antecedentes de salud, realizar el examen estomatognático, interactuar con el odontograma y guardar la evolución clínica.
            </p>
          </div>
          {canModifyPatient && (
            <div className="flex gap-2 shrink-0">
              <Link
                href={`/erp/citas/${appt.id}/atencion`}
                className="inline-flex items-center justify-center bg-gold-600 hover:bg-gold-700 text-white font-medium text-sm px-4 py-2 rounded-xl transition-all shadow-sm"
              >
                Registrar Ficha
              </Link>
            </div>
          )}
        </div>
      )}

      {appt.status === "attended" && consultation && (
        <div className="card p-6 mb-5 border-t-4 border-green-500">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
              <CheckCircle2 className="text-green-600" size={20} /> Detalles de la Atención Registrada
            </h2>
            {canModifyPatient && (
              <div className="flex gap-2">
                <Link
                  href={`/erp/citas/${appt.id}/atencion`}
                  className="inline-flex items-center justify-center bg-gold-600 hover:bg-gold-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                >
                  Editar Ficha
                </Link>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <div className="bg-lilac-50/50 rounded-xl p-4 border border-lilac-100">
              <h3 className="text-xs font-bold text-lilac-800 uppercase mb-2">Procedimientos Realizados</h3>
              <p className="text-sm text-ink-900 whitespace-pre-wrap leading-relaxed">{consultation.treatment_notes}</p>
            </div>

            {consultation.prescription && (
              <div className="bg-gold-50/50 rounded-xl p-4 border border-gold-100">
                <h3 className="text-xs font-bold text-gold-800 uppercase mb-2">Receta e Indicaciones</h3>
                <p className="text-sm text-ink-900 whitespace-pre-wrap leading-relaxed">{consultation.prescription}</p>
              </div>
            )}

            {consultation.odontogram_snapshot && Object.keys(consultation.odontogram_snapshot).length > 0 && (
              <div className="bg-ink-900/5 rounded-xl p-4 border border-ink-900/10">
                <h3 className="text-xs font-bold text-ink-700 uppercase mb-2">Resumen de Odontograma (Captura en Cita)</h3>
                <div className="text-sm text-ink-800 space-y-1">
                  {(() => {
                    const toothStates: Record<string, string> = {
                      caries: "Caries",
                      sellante_necesario: "Sellante necesario",
                      sellante_realizado: "Sellante realizado",
                      corona: "Corona",
                      perdida: "Ausente",
                      extraccion: "Extracción requerida"
                    };
                    const surfaceNames: Record<string, string> = {
                      center: "Centro",
                      top: "Superior",
                      bottom: "Inferior",
                      left: "Izquierda",
                      right: "Derecha"
                    };
                    const list: string[] = [];
                    Object.entries(consultation.odontogram_snapshot).forEach(([tooth, info]: [string, any]) => {
                      const conditions: string[] = [];
                      const toothInfo = info as any;
                      if (toothInfo.general && toothInfo.general !== "sano" && toothStates[toothInfo.general]) {
                        conditions.push(toothStates[toothInfo.general]);
                      }
                      Object.entries(toothInfo.surfaces || {}).forEach(([surf, cond]: [string, any]) => {
                        if (cond && cond !== "sano" && toothStates[cond]) {
                          const surfEs = surfaceNames[surf] || surf;
                          conditions.push(`${toothStates[cond]} (${surfEs})`);
                        }
                      });
                      if (conditions.length > 0) {
                        list.push(`Diente ${tooth}: ${conditions.join(", ")}`);
                      }
                    });
                    if (list.length === 0) {
                      return <span className="italic text-ink-600">Ningún diente con hallazgos o tratamientos registrados.</span>;
                    }
                    return list.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-gold-600"></span>
                        <span>{item}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {history && history.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-lilac-100">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Calendar size={14} /> Historial del paciente
            </h2>
          </div>
          <ul className="divide-y divide-lilac-50">
            {history.map((h) => (
              <li key={h.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <Link href={`/erp/citas/${h.id}`} className="hover:text-lilac-700">
                  {(() => {
                    const dt = new Date(h.starts_at);
                    const datePart = dt.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
                    return `${datePart} ${formatTimeLocal(dt)}`;
                  })()}
                </Link>
                <StatusBadge status={h.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-ink-600">{icon}</span>
      <span className="text-ink-600">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-lilac-100 text-lilac-700",
    attended: "bg-green-100 text-green-700",
    no_show: "bg-amber-100 text-amber-700",
    cancelled: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    scheduled: "Agendada", attended: "Atendida", no_show: "No asistió", cancelled: "Cancelada",
  };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${map[status] || map.scheduled}`}>{labels[status]}</span>;
}
