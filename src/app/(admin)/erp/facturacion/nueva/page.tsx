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

  return (
    <NewInvoiceForm
      patients={patients ?? []}
      initialPatient={preselectedResult.data ?? null}
      services={services ?? []}
      bankAccounts={bankAccounts ?? []}
      cashDiscountPercent={cashDiscountPercent}
      appointmentId={searchParams.appointment_id ?? null}
      initialClientName={searchParams.client_name}
      initialClientDocument={searchParams.client_document}
      initialClientEmail={searchParams.client_email}
      initialClientPhone={searchParams.client_phone}
      initialClientAddress={searchParams.client_address}
      initialModuleEnrollmentIds={searchParams.module_enrollment_ids}
      initialCourseEnrollmentId={searchParams.course_enrollment_id}
      initialFullCoursePayment={searchParams.full_course_payment === "true"}
      initialItemDescription={searchParams.item_description}
      initialItemPrice={searchParams.item_price ? Number(searchParams.item_price) : undefined}
      returnUrl={searchParams.return_url}
    />
  );
}
