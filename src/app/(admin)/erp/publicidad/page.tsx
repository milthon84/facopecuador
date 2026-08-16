import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertWritePermission } from "@/lib/auth-action";
import PublicidadClientPage from "./PublicidadClientPage";

export const dynamic = "force-dynamic";

export default async function PublicidadPage() {
  // Verificar permisos de escritura en la ruta de gestión de publicidad
  await assertWritePermission("/erp/publicidad");

  const sessionClient = createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  const isAdmin = (user?.app_metadata?.role as string) === "admin";

  const supabase = createAdminClient();

  // Obtener artículos/noticias de todas las secciones (Cursos, Clínica, CoWorking)
  const { data: postsData } = await supabase
    .from("web_posts")
    .select("*")
    .order("created_at", { ascending: false });

  const hasFacebookCredentials = !!(process.env.META_PAGE_ID && process.env.META_PAGE_ACCESS_TOKEN);
  const hasInstagramCredentials = !!(process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID && process.env.META_PAGE_ACCESS_TOKEN);

  return (
    <div className="pb-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Publicidad y Anuncios</h1>
          <p className="text-sm text-ink-600">
            Gestión de artículos y noticias públicas, más diagnóstico y análisis de consumos de anuncios.
          </p>
        </div>
      </div>

      <PublicidadClientPage 
        initialPosts={postsData || []} 
        hasFacebookCredentials={hasFacebookCredentials}
        hasInstagramCredentials={hasInstagramCredentials}
        isAdmin={isAdmin}
      />
    </div>
  );
}
