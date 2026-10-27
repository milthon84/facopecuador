import { createAdminClient } from "@/lib/supabase/admin";
import NewInvoiceForm from "./NewInvoiceForm";
import { assertWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ 
    patient_id?: string; 
    appointment_id?: string;
    client_name?: string;
    client_document?: string;
    client_email?: string;
    client_phone?: string;
    client_address?: string;
    module_enrollment_ids?: string;
    course_enrollment_id?: string;
    full_course_payment?: string;
    item_description?: string;
    item_price?: string;
    rental_id?: string;
    return_url?: string;
  }>;
}) {
  await assertWritePermission("/erp/facturacion");
  const searchParams = await searchParamsPromise;
  const supabase = createAdminClient();

  const [{ data: patients }, preselectedResult, { data: services }, { data: bankAccounts }, { data: sriConfig }] = await Promise.all([
    supabase.from("patients").select("id, full_name, document_number, email, phone").order("full_name"),
    searchParams.patient_id
      ? supabase.from("patients").select("id, full_name, document_number, email, phone").eq("id", searchParams.patient_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("services").select("id, name, description, price, iva_code, category").eq("active", true).order("category").order("name"),
    supabase.from("bank_accounts").select("id, bank_name, account_number, account_type, notes").eq("is_active", true).order("bank_name"),
    supabase.from("sri_configs").select("*").maybeSingle(),
  ]);

  let cashDiscountPercent = 6.0;
  if (sriConfig) {
    if ("cash_discount_percent" in sriConfig && sriConfig.cash_discount_percent != null) {
      cashDiscountPercent = Number(sriConfig.cash_discount_percent);
    } else if ("card_surcharge_percent" in sriConfig && sriConfig.card_surcharge_percent != null) {
      cashDiscountPercent = Number(sriConfig.card_surcharge_percent);
    }
  }

  // Pre-cargar datos del doctor desde la reserva de alquiler si viene rental_id
  let rentalDoctor = {
    name: searchParams.client_name || "",
    document: searchParams.client_document || "",
    email: searchParams.client_email || "",
    phone: searchParams.client_phone || "",
    address: searchParams.client_address || "",
  };

  if (searchParams.rental_id) {
    try {
      const { data: rental } = await supabase
        .from("coworking_rentals")
        .select("*, doctor:doctor_id(*)")
        .eq("id", searchParams.rental_id)
        .maybeSingle();

      if (rental) {
        const doc = rental.doctor as any;
        if (!rentalDoctor.name) rentalDoctor.name = rental.doctor_name || doc?.full_name || "";
        if (!rentalDoctor.document) rentalDoctor.document = rental.doctor_document || doc?.document_number || "";
        if (!rentalDoctor.email) rentalDoctor.email = rental.doctor_email || doc?.email || "";
        if (!rentalDoctor.phone) rentalDoctor.phone = rental.doctor_phone || doc?.phone || "";
        if (!rentalDoctor.address) rentalDoctor.address = doc?.address || "";
      }
    } catch (rErr) {
      console.warn("No se pudo pre-cargar datos de la reserva de alquiler:", rErr);
    }
  }

  // Si tenemos cédula o RUC pero falta dirección o datos fiscales, buscar en la última factura previa
  if (rentalDoctor.document && (!rentalDoctor.address || !rentalDoctor.email || !rentalDoctor.phone)) {
    try {
      const cleanDoc = rentalDoctor.document.replace(/[\s\-]/g, "");
      const variants = /^\d{10}$/.test(cleanDoc) ? [cleanDoc, `${cleanDoc}001`] : [cleanDoc];
      const { data: lastInv } = await supabase
        .from("invoices")
        .select("client_name, client_document, client_email, client_phone, client_address")
        .in("client_document", variants)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastInv) {
        if (!rentalDoctor.address && lastInv.client_address) rentalDoctor.address = lastInv.client_address;
        if (!rentalDoctor.email && lastInv.client_email) rentalDoctor.email = lastInv.client_email;
        if (!rentalDoctor.phone && lastInv.client_phone) rentalDoctor.phone = lastInv.client_phone;
        if (!rentalDoctor.name && lastInv.client_name) rentalDoctor.name = lastInv.client_name;
      }
    } catch {
      // Ignorar fallback de factura previa
    }
  }

  return (
    <NewInvoiceForm
      patients={patients ?? []}
      initialPatient={preselectedResult.data ?? null}
      services={services ?? []}
      bankAccounts={bankAccounts ?? []}
      cashDiscountPercent={cashDiscountPercent}
      appointmentId={searchParams.appointment_id ?? null}
      initialClientName={rentalDoctor.name || searchParams.client_name}
      initialClientDocument={rentalDoctor.document || searchParams.client_document}
      initialClientEmail={rentalDoctor.email || searchParams.client_email}
      initialClientPhone={rentalDoctor.phone || searchParams.client_phone}
      initialClientAddress={rentalDoctor.address || searchParams.client_address}
      initialModuleEnrollmentIds={searchParams.module_enrollment_ids}
      initialCourseEnrollmentId={searchParams.course_enrollment_id}
      initialFullCoursePayment={searchParams.full_course_payment === "true"}
      initialItemDescription={searchParams.item_description}
      initialItemPrice={searchParams.item_price ? Number(searchParams.item_price) : undefined}
      rentalId={searchParams.rental_id}
      returnUrl={searchParams.return_url}
    />
  );
}
