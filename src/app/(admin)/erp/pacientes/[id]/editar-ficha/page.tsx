import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import EditarFichaClientPage from "./EditarFichaClientPage";
import { assertWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

export default async function EditarFichaPage({ params }: { params: Promise<{ id: string }> }) {
  await assertWritePermission("/erp/pacientes");
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();

  if (!patient) return notFound();

  return (
    <EditarFichaClientPage patient={patient} />
  );
}
