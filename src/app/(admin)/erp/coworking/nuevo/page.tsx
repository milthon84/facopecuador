import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { assertWritePermission } from "@/lib/auth-action";
import NuevaReservaClientForm from "./NuevaReservaClientForm";

export const dynamic = "force-dynamic";

async function createRental(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/coworking");
  const supabase = createAdminClient();
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const resource_type = formData.get("resource_type") as string;
  const resource_identifier = (formData.get("resource_identifier") as string)?.trim() || null;
  const rental_date = formData.get("rental_date") as string;
  const start_time = formData.get("start_time") as string;
  const end_time = formData.get("end_time") as string;
  const hours = Number(formData.get("hours")) || 1.0;
  const rate_type = (formData.get("rate_type") as string) || "hora";
  const hourly_rate = Number(formData.get("hourly_rate")) || 0;
  const total_price = Number(formData.get("total_price")) || 0;

  const doctor_name = (formData.get("doctor_name") as string)?.trim();
  const doctor_document = (formData.get("doctor_document") as string)?.trim() || null;
  const doctor_phone = (formData.get("doctor_phone") as string)?.trim() || null;
  const doctor_email = (formData.get("doctor_email") as string)?.trim() || null;
  const doctor_specialty = (formData.get("doctor_specialty") as string)?.trim() || null;
  const doctor_registration_number = (formData.get("doctor_registration_number") as string)?.trim() || null;
  const doctor_id = (formData.get("doctor_id") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!doctor_name) {
    return { error: "El nombre del doctor es obligatorio." };
  }

  const { data, error } = await supabase
    .from("coworking_rentals")
    .insert({
      resource_type,
      resource_identifier,
      rental_date,
      start_time,
      end_time,
      hours,
      status: "reservado",
      rate_type,
      hourly_rate,
      total_price,
      doctor_name,
      doctor_document,
      doctor_phone,
      doctor_email,
      doctor_specialty,
      doctor_registration_number,
      doctor_id: doctor_id || null,
      notes,
      created_by_id: user?.id || null,
      created_by_email: user?.email || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message || "No se pudo registrar la reserva de alquiler." };
  }

  return { success: true, id: data.id };
}

export default async function NuevaReservaPage() {
  await assertWritePermission("/erp/coworking");
  const today = new Date().toISOString().split("T")[0];
  const supabase = createAdminClient();

  const { data: specialists } = await supabase
    .from("profesores")
    .select("id, full_name, document_number, email, phone, specialty")
    .order("full_name");

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/erp/coworking"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0 shadow-xs"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink-900 tracking-tight">Agendar Alquiler / Coworking</h1>
          <p className="text-xs text-ink-500">
            Reserva de puesto de trabajo (sillón), clínica completa o aulas para capacitaciones
          </p>
        </div>
      </div>

      <NuevaReservaClientForm
        today={today}
        specialists={(specialists || []) as any}
        createRental={createRental}
      />
    </div>
  );
}
