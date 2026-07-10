import Link from "next/link";
import { CheckCircle2, Calendar, ArrowLeft, MapPin, Phone } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTimeLocal } from "@/lib/availability";
import { notFound } from "next/navigation";

export default async function ConfirmacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, reason, status, patient:patients(full_name, email)")
    .eq("id", id)
    .single();

  if (!appt) return notFound();

  const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME || "Consultorio";
  const address = process.env.NEXT_PUBLIC_CLINIC_ADDRESS || "";
  const phone = process.env.NEXT_PUBLIC_CLINIC_PHONE || "";
  const start = new Date(appt.starts_at);

  const dateLabel = start.toLocaleDateString("es-CO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const timeLabel = formatTimeLocal(start);
  const patient = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;

  return (
    <main className="min-h-screen bg-gradient-to-br from-lilac-50 via-white to-gold-50 px-4 py-10">
      <div className="max-w-xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-6">
          <ArrowLeft size={16} /> Volver al inicio
        </Link>

        <div className="card p-7 sm:p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gold-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="text-gold-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-2">¡Cita confirmada!</h1>
          <p className="text-sm text-ink-600 mb-6">
            Hola <strong>{patient?.full_name}</strong>, tu cita está reservada.
            Te enviamos los detalles a <strong>{patient?.email}</strong>.
          </p>

          <div className="bg-gold-50 border-l-4 border-gold-500 rounded-lg p-4 text-left mb-6">
            <div className="flex items-start gap-3">
              <Calendar className="text-gold-600 mt-0.5" size={18} />
              <div>
                <div className="text-xs uppercase tracking-wide text-lilac-700 mb-1">Fecha y hora</div>
                <div className="font-semibold capitalize">{dateLabel}</div>
                <div className="text-lg font-bold text-ink-900">{timeLabel}</div>
              </div>
            </div>
          </div>

          {appt.reason && (
            <div className="text-sm text-left text-ink-600 mb-6">
              <span className="font-medium text-ink-900">Motivo:</span> {appt.reason}
            </div>
          )}

          <div className="border-t border-lilac-100 pt-5 text-sm text-left space-y-2">
            <div className="mb-3">
              <img src="/logo.png" alt={clinicName} className="h-8 w-auto object-contain rounded" />
            </div>
            {address && (
              <div className="flex items-center gap-2 text-ink-600">
                <MapPin size={14} /> {address}
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2 text-ink-600">
                <Phone size={14} /> {phone}
              </div>
            )}
          </div>

          <div className="mt-6 text-xs text-ink-600/70">
            Si necesitás cancelar o reprogramar, escribinos al menos 24 horas antes de tu cita.
          </div>
        </div>
      </div>
    </main>
  );
}
