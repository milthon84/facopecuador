import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/auth-action";
import PlanCuentasClient from "./PlanCuentasClient";

export const dynamic = "force-dynamic";

export default async function PlanCuentasPage() {
  await assertPermission("/erp/contabilidad");
  const supabase = createAdminClient();
  
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .order("code", { ascending: true });

  if (error) {
    console.error("Error fetching accounts:", error);
  }

  return <PlanCuentasClient initialAccounts={accounts || []} />;
}
