import { createAdminClient } from "@/lib/supabase/admin";
import { assertWritePermission } from "@/lib/auth-action";
import SitioWebClientPage from "./SitioWebClientPage";

export const dynamic = "force-dynamic";

export default async function SitioWebPage() {
  // Verificar permisos de escritura en la ruta de gestión web
  await assertWritePermission("/erp/sitio-web");

  const supabase = createAdminClient();

  // Obtener configuraciones del sitio
  const { data: settingsData } = await supabase
    .from("web_settings")
    .select("key, value");

  // Obtener artículos/noticias
  const { data: postsData } = await supabase
    .from("web_posts")
    .select("*")
    .order("created_at", { ascending: false });

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
            Administra los contenidos dinámicos del portal público: información general, noticias e imágenes.
          </p>
        </div>
      </div>

      <SitioWebClientPage
        initialSettings={settings}
        initialPosts={postsData || []}
      />
    </div>
  );
}
