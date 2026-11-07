import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import FacturacionClient from "./FacturacionClient";

export const dynamic = "force-dynamic";

export default async function BillingDashboard({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ tab?: string; month?: string }>;
}) {
  await assertPermission("/erp/facturacion");
  const canEdit = await hasWritePermission("/erp/facturacion");
  const searchParams = searchParamsPromise ? await searchParamsPromise : {};
  const activeTab = searchParams.tab || "facturas";

  const supabase = createAdminClient();

  // 1. Selector de Meses (Últimos 12 meses + opción 'Todos')
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const activeMonth = searchParams.month ?? currentMonthStr;

  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // Fechas de filtro si no es 'all'
  let startDate = "";
  let endDate = "";
  if (activeMonth !== "all") {
    const [year, monthNum] = activeMonth.split("-").map(Number);
    startDate = new Date(year, monthNum - 1, 1).toISOString().split("T")[0];
    endDate = new Date(year, monthNum, 0).toISOString().split("T")[0];
  }

  // 2. Consultas a Supabase
  let invoiceQuery = supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });

  let cnQuery = supabase
    .from("credit_notes")
    .select("*")
    .order("created_at", { ascending: false });

  if (activeMonth !== "all") {
    invoiceQuery = invoiceQuery.gte("issue_date", startDate).lte("issue_date", endDate);
    cnQuery = cnQuery.gte("issue_date", startDate).lte("issue_date", endDate);
  } else {
    invoiceQuery = invoiceQuery.limit(100);
    cnQuery = cnQuery.limit(100);
  }

  let invoices: any[] = [];
  let cnData: any[] = [];
  let allCreditNotes: any[] = [];

  try {
    const res = await invoiceQuery;
    invoices = res.data || [];
  } catch {}

  try {
    const res = await cnQuery;
    cnData = res.data || [];
  } catch {}

  try {
    const res = await supabase
      .from("credit_notes")
      .select("id, invoice_id, credit_note_number, sri_status, total");
    allCreditNotes = res.data || [];
  } catch {}

  return (
    <FacturacionClient
      initialInvoices={invoices}
      initialCreditNotes={cnData}
      allCreditNotes={allCreditNotes}
      activeMonth={activeMonth}
      months={months}
      canEdit={canEdit}
      initialTab={activeTab}
    />
  );
}
