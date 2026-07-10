import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  IdCard, 
  Heart, 
  Activity, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  FileText, 
  PlusCircle 
} from "lucide-react";
import { formatTimeLocal } from "@/lib/availability";
import EditPatientModal from "@/components/EditPatientModal";
import { hasPermission } from "@/lib/roles";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";

export const dynamic = "force-dynamic";

export default async function PacienteDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  
  // Ejecutar todas las consultas del perfil del paciente y permisos en paralelo
  const [patientRes, authData, dentalRecordRes, apptsRes, consultationsRes] = await Promise.all([
    supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .single(),
    getCachedUserAndPermissions(),
    supabase
      .from("dental_records")
      .select("*")
      .eq("patient_id", id)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("id, starts_at, ends_at, status, reason")
      .eq("patient_id", id)
      .order("starts_at", { ascending: false }),
    supabase
      .from("dental_consultations")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
  ]);
    
  const patient = patientRes.data;
  if (!patient) return notFound();

  const { role, allowedPaths } = authData;
  const canModify = hasPermission(role, "/erp/pacientes/modificar", allowedPaths);

  const dentalRecord = dentalRecordRes.data;
  const appts = apptsRes.data;
  const consultations = consultationsRes.data;

  // Help format date nicely
  const formatDateES = (d: string) => {
    return new Date(d).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  // Compile medical history list
  const historyKeys: Record<string, string> = {
    alergia_antibiotico: "Alergia Antibióticos",
    alergia_anestesia: "Alergia Anestesia",
    hemorragias: "Hemorragias",
    vih_sida: "VIH/SIDA",
    tuberculosis: "Tuberculosis",
    diabetes: "Diabetes",
    asma: "Asma",
    hipertension: "Hipertensión",
    cardiovasculares: "Enfermedades Cardiovasculares"
  };

  const activeHistory: string[] = [];
  if (dentalRecord?.medical_history) {
    Object.entries(dentalRecord.medical_history).forEach(([k, v]) => {
      if (v === true && historyKeys[k]) {
        activeHistory.push(historyKeys[k]);
      }
    });
    const medHistoryObj = dentalRecord.medical_history as any;
    if (medHistoryObj?.otros) {
      activeHistory.push(`Otros: ${medHistoryObj.otros}`);
    }
  }

  // Compile odontogram summary
  const toothStates: Record<string, string> = {
    caries: "Caries",
    sellante_necesario: "Sellante necesario",
    sellante_realizado: "Sellante realizado",
    corona: "Corona",
    perdida: "Ausente",
    extraccion: "Extracción requerida"
  };

  const odontogramIssues: string[] = [];
  if (dentalRecord?.odontogram_state) {
    Object.entries(dentalRecord.odontogram_state).forEach(([tooth, info]: [string, any]) => {
      const conditions: string[] = [];
      if (info.general && info.general !== "sano" && toothStates[info.general]) {
        conditions.push(toothStates[info.general]);
      }
      Object.entries(info.surfaces || {}).forEach(([surf, cond]: [string, any]) => {
        if (cond && cond !== "sano" && toothStates[cond]) {
          conditions.push(`${toothStates[cond]} (${surf})`);
        }
      });
      if (conditions.length > 0) {
        odontogramIssues.push(`Diente ${tooth}: ${conditions.join(", ")}`);
      }
    });
  }

  // Find the next scheduled appointment to show quick-action banner if available
  const activeAppt = appts?.find((a) => a.status === "scheduled");

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <Link href="/erp/pacientes" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-4 transition-colors">
        <ArrowLeft size={16} /> Volver a Pacientes
      </Link>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Column: Core Patient Profile & Permanent Medical History */}
        <div className="space-y-6 md:col-span-1">
          {/* Core Info */}
          <div className="card p-6 bg-white border border-lilac-100 shadow-sm">
            <div className="flex flex-col gap-2 mb-4">
              <h1 className="text-xl font-bold text-ink-900 leading-tight">{patient.full_name}</h1>
              {canModify && (
                <>
                  <EditPatientModal
                    patient={{
                      id: patient.id,
                      full_name: patient.full_name,
                      phone: patient.phone,
                      email: patient.email,
                      document_number: patient.document_number,
                    }}
                  />
                  <Link
                    href={`/erp/pacientes/${patient.id}/editar-ficha`}
                    className="w-full inline-flex items-center justify-center bg-gold-600 hover:bg-gold-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-sm gap-1 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <PlusCircle size={14} /> Editar Ficha Permanente
                  </Link>
                </>
              )}
            </div>
            <div className="space-y-3 text-sm text-ink-800">
              {patient.document_number && (
                <div className="flex items-center gap-2">
                  <IdCard size={14} className="text-lilac-600 shrink-0" />
                  <span className="font-medium">{patient.document_number}</span>
                </div>
              )}
              {patient.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-lilac-600 shrink-0" />
                  <span>{patient.phone}</span>
                </div>
              )}
              {patient.email && (
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-lilac-600 shrink-0" />
                  <span className="truncate">{patient.email}</span>
                </div>
              )}
            </div>
            
            {patient.notes && (
              <div className="bg-lilac-50/50 rounded-xl p-3 text-xs text-ink-700 mt-4 border border-lilac-50">
                <div className="text-[10px] font-bold uppercase text-lilac-800 mb-1">Notas Administrativas</div>
                {patient.notes}
              </div>
            )}
          </div>

          {/* Permanent Medical Background */}
          <div className="card p-6 bg-white border border-lilac-100 shadow-sm">
            <h2 className="text-sm font-bold text-ink-950 flex items-center gap-2 mb-3 border-b border-lilac-50 pb-2">
              <Heart className="text-red-500 animate-pulse" size={16} /> Antecedentes Médicos
            </h2>
            {activeHistory.length === 0 ? (
              <div className="text-xs text-ink-500 italic py-2">Sin antecedentes patológicos registrados en la ficha.</div>
            ) : (
              <div className="flex flex-wrap gap-1.5 py-1">
                {activeHistory.map((h, i) => (
                  <span key={i} className="bg-red-50 text-red-700 border border-red-100 text-[11px] font-semibold px-2.5 py-1 rounded-lg">
                    {h}
                  </span>
                ))}
              </div>
            )}

            {/* Physical Details */}
            {dentalRecord && (
              <div className="mt-4 pt-4 border-t border-lilac-50 text-xs space-y-2 text-ink-700">
                {dentalRecord.date_of_birth && (
                  <div>
                    <span className="font-bold">Fecha de Nacimiento:</span>{" "}
                    {formatDateES(dentalRecord.date_of_birth)}
                  </div>
                )}
                {dentalRecord.sex && (
                  <div>
                    <span className="font-bold">Sexo:</span> {dentalRecord.sex === "M" ? "Masculino" : dentalRecord.sex === "F" ? "Femenino" : "Otro"}
                  </div>
                )}
                {dentalRecord.address && (
                  <div>
                    <span className="font-bold">Dirección:</span> {dentalRecord.address}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stomatognathic Exam Exceptions */}
          <div className="card p-6 bg-white border border-lilac-100 shadow-sm">
            <h2 className="text-sm font-bold text-ink-950 flex items-center gap-2 mb-3 border-b border-lilac-50 pb-2">
              <Activity className="text-gold-600" size={16} /> Examen Estomatognático
            </h2>
            {(() => {
              if (!dentalRecord?.stomatognathic_exam) {
                return <div className="text-xs text-ink-500 italic py-1">Examen físico no registrado aún.</div>;
              }
              const abnormalities = Object.entries(dentalRecord.stomatognathic_exam)
                .filter(([_, v]: [string, any]) => v?.status === "alteracion");

              if (abnormalities.length === 0) {
                return <div className="text-xs text-green-700 bg-green-50/50 p-2 rounded-xl border border-green-100 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-green-600" /> Todo evaluado normal.
                </div>;
              }
              return (
                <div className="space-y-2 text-xs">
                  {abnormalities.map(([k, v]: [string, any]) => (
                    <div key={k} className="bg-amber-50 border border-amber-100 p-2 rounded-xl">
                      <div className="font-bold text-amber-900 capitalize">{k.replace("_", " ")}</div>
                      <div className="text-ink-700 text-[11px] mt-0.5">{v.desc || "Sin detalle"}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Right Column: Active Odontogram State, Current Actions, & Appointment History */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Quick attention action banner */}
          {activeAppt && (
            <div className="bg-gold-50 border border-gold-200 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-bold text-gold-950 text-sm flex items-center gap-2">
                  <Clock className="text-gold-600 shrink-0" size={18} /> Cita Pendiente de Atención
                </h3>
                <p className="text-xs text-gold-900 mt-1 max-w-md">
                  El paciente tiene una cita programada para el{" "}
                  <strong>{formatDateES(activeAppt.starts_at)} {formatTimeLocal(activeAppt.starts_at)}</strong>. 
                  {canModify ? "Puedes registrar su atención y odontograma directamente." : "La atención y odontograma se encuentran pendientes de registro."}
                </p>
              </div>
              {canModify && (
                <Link
                  href={`/erp/citas/${activeAppt.id}/atencion`}
                  className="inline-flex items-center justify-center bg-gold-600 hover:bg-gold-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0 gap-1.5"
                >
                  <PlusCircle size={14} /> Registrar Atención
                </Link>
              )}
            </div>
          )}

          {/* Consolidated Odontogram Record */}
          <div className="card p-6 bg-white border border-lilac-100 shadow-sm">
            <h2 className="text-base font-bold text-ink-900 mb-3 flex items-center gap-2 border-b border-lilac-50 pb-2.5">
              <Sparkles className="text-gold-600" size={18} /> Estado del Odontograma Consolidado
            </h2>
            {odontogramIssues.length === 0 ? (
              <div className="text-sm text-green-700 bg-green-50/50 p-3 rounded-2xl border border-green-100 italic">
                Todos los dientes sanos o sin novedades clínicas activas registradas.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2 mt-2">
                {odontogramIssues.map((issue, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-lilac-50/30 p-2.5 rounded-xl border border-lilac-50 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0 mt-1.5"></span>
                    <span className="text-ink-800 font-medium leading-relaxed">{issue}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historical Appointments & Session Evolutions */}
          <div className="card overflow-hidden bg-white border border-lilac-100 shadow-sm">
            <div className="px-5 py-3 border-b border-lilac-100 bg-lilac-50/20">
              <h2 className="font-bold text-sm text-ink-950 flex items-center gap-2">
                <FileText size={15} className="text-lilac-700" /> Evoluciones e Historial de Tratamientos ({appts?.length || 0})
              </h2>
            </div>
            
            {!appts || appts.length === 0 ? (
              <div className="p-6 text-center text-sm text-ink-600">Sin citas registradas en el historial.</div>
            ) : (
              <div className="divide-y divide-lilac-50">
                {appts.map((a) => {
                  const consultation = consultations?.find((c) => c.appointment_id === a.id);
                  return (
                    <div key={a.id} className="p-5 hover:bg-lilac-50/10 transition-colors">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <Link href={`/erp/citas/${a.id}`} className="text-sm hover:text-lilac-700 font-bold text-ink-900 transition-colors">
                            {formatDateES(a.starts_at)} {formatTimeLocal(a.starts_at)}
                          </Link>
                          {a.reason && (
                            <div className="text-xs text-ink-600 mt-1">
                              <span className="font-semibold">Motivo:</span> {a.reason}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <StatusBadge status={a.status} />
                          {a.status === "attended" && canModify && (
                            <Link
                              href={`/erp/citas/${a.id}/atencion`}
                              className="text-[10px] bg-lilac-50 text-lilac-700 border border-lilac-200 hover:bg-lilac-100 hover:text-lilac-900 px-2.5 py-1 rounded-lg font-bold transition-all shadow-sm"
                            >
                              Editar Consulta
                            </Link>
                          )}
                        </div>
                      </div>


                      {/* Display consultation evolutionary details if attended */}
                      {a.status === "attended" && consultation && (
                        <div className="mt-3 bg-lilac-50/30 rounded-xl p-3 border border-lilac-50 space-y-2 text-xs">
                          <div>
                            <span className="font-bold text-lilac-900 uppercase text-[9px] block mb-0.5">Evolución</span>
                            <p className="text-ink-800 whitespace-pre-wrap leading-relaxed">{consultation.treatment_notes}</p>
                          </div>
                          {consultation.prescription && (
                            <div className="pt-2 border-t border-lilac-50/80">
                              <span className="font-bold text-gold-800 uppercase text-[9px] block mb-0.5">Receta / Indicaciones</span>
                              <p className="text-ink-800 whitespace-pre-wrap leading-relaxed">{consultation.prescription}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-lilac-100 text-lilac-700 border-lilac-200",
    attended: "bg-green-100 text-green-700 border-green-200",
    no_show: "bg-amber-100 text-amber-700 border-amber-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };
  const labels: Record<string, string> = {
    scheduled: "Agendada", 
    attended: "Atendida", 
    no_show: "No asistió", 
    cancelled: "Cancelada",
  };
  return (
    <span className={`px-2 py-0.5 border rounded-full text-[10px] font-semibold tracking-wide ${map[status] || map.scheduled}`}>
      {labels[status]}
    </span>
  );
}

