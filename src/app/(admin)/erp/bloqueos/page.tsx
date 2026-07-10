import { createAdminClient } from "@/lib/supabase/admin";
import BloqueosEditor from "@/components/BloqueosEditor";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

export default async function BloqueosPage() {
  await assertPermission("/erp/bloqueos");
  const canEdit = await hasWritePermission("/erp/bloqueos");

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: exceptions } = await supabase
    .from("availability_exceptions")
    .select("*")
    .gte("date", today)
    .order("date");

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Bloqueos y excepciones</h1>
      <p className="text-sm text-ink-600 mb-6">Bloqueá días o rangos específicos (vacaciones, feriados, reuniones) o creá horarios extra puntuales.</p>
      <BloqueosEditor initialExceptions={JSON.parse(JSON.stringify(exceptions || []))} canEdit={canEdit} />
    </div>
  );
}
