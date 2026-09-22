import { createAdminClient } from "@/lib/supabase/admin";
import { Tag } from "lucide-react";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import NuevaCategoriaModal from "@/components/NuevaCategoriaModal";
import EditarCategoriaModal from "@/components/EditarCategoriaModal";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { deleteCategoryAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  await assertPermission("/erp/categorias");
  const canEdit = await hasWritePermission("/erp/categorias");

  const supabase = createAdminClient();
  const { data: categories } = await supabase
    .from("inventory_categories")
    .select("*")
    .eq("active", true)
    .order("name");

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-lilac-50 border border-lilac-200 text-lilac-700 flex items-center justify-center shrink-0">
            <Tag size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-ink-950 tracking-tight">Categorías de Insumos</h1>
            <p className="text-xs text-ink-500 font-medium">Clasificación y códigos de prefijos para inventario.</p>
          </div>
        </div>

        {canEdit && <NuevaCategoriaModal />}
      </div>

      <div className="bg-white border border-lilac-100 rounded-3xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-lilac-50">
          <span className="text-xs font-bold text-ink-700 uppercase tracking-wider">Categorías registradas</span>
          <span className="text-xs text-lilac-700 bg-lilac-50 border border-lilac-200/80 px-2.5 py-0.5 rounded-full font-bold">
            {categories?.length ?? 0} {categories?.length === 1 ? "categoría" : "categorías"}
          </span>
        </div>

        <div className="space-y-2">
          {(categories || []).length === 0 && (
            <div className="text-center py-10">
              <Tag size={32} className="mx-auto text-lilac-300 mb-2" />
              <p className="text-sm font-semibold text-ink-800">Sin categorías registradas</p>
              <p className="text-xs text-ink-500 mt-1">Crea tu primera categoría con el botón superior.</p>
            </div>
          )}

          {(categories || []).map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between gap-3 px-4 py-3 bg-lilac-50/40 hover:bg-lilac-50/80 border border-lilac-100 rounded-2xl transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[11px] font-mono font-bold text-lilac-800 bg-lilac-100 border border-lilac-200 px-2.5 py-1 rounded-xl w-14 text-center shrink-0 shadow-2xs">
                  {cat.prefix}
                </span>
                <span className="text-sm font-bold text-ink-900 truncate">{cat.name}</span>
              </div>

              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <EditarCategoriaModal category={{ id: cat.id, name: cat.name, prefix: cat.prefix }} />
                  <ConfirmDeleteButton
                    action={deleteCategoryAction}
                    idName="id"
                    idValue={cat.id}
                    confirmMessage={`¿Estás seguro de eliminar la categoría "${cat.name}"?`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
