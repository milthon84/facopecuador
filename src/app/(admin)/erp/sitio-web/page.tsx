import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import SitioWebClientPage from "./SitioWebClientPage";

export const dynamic = "force-dynamic";

export default async function SitioWebPage() {
  // Verificar permiso de lectura en la ruta de gestión web
  await assertPermission("/erp/sitio-web");
  const canEdit = await hasWritePermission("/erp/sitio-web");

  const supabase = createAdminClient();

  // Obtener configuraciones del sitio
  const { data: settingsData } = await supabase
    .from("web_settings")
    .select("key, value");

  // Mapear configuraciones a objeto estructurado
  const settings: Record<string, any> = {};
  settingsData?.forEach((item) => {
    settings[item.key] = item.value;
  });

  return (
    <div className="pb-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Gestión de Página Web (CMS)</h1>
          <p className="text-sm text-ink-600">
            Administra la configuración general del portal público: sección principal, misión/visión y datos de contacto.
          </p>
        </div>
      </div>

      <SitioWebClientPage initialSettings={settings} canEdit={canEdit} />
    </div>
  );
}
