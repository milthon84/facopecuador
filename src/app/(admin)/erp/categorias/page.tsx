import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { Tag, Trash2, Plus } from "lucide-react";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

async function addCategory(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/categorias");
  const name   = (formData.get("name") as string)?.trim();
  const prefix = (formData.get("prefix") as string)?.trim().toUpperCase().slice(0, 4);
  if (!name || !prefix) return;
  const supabase = createAdminClient();
  await supabase.from("inventory_categories").insert({ name, prefix });
  revalidatePath("/erp/categorias");
}

async function deleteCategory(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/categorias");
  const id = formData.get("id") as string;
  const supabase = createAdminClient();
  await supabase.from("inventory_categories").delete().eq("id", id);
  revalidatePath("/erp/categorias");
}

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
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Tag size={20} className="text-lilac-600" />
        <div>
          <h1 className="text-xl font-bold text-ink-900">Categorías de Insumos</h1>
          <p className="text-sm text-ink-500">Gestiona las categorías para clasificar el inventario.</p>
        </div>
      </div>

      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-ink-700">Categorías registradas</span>
          <span className="text-xs text-ink-400 bg-lilac-50 px-2 py-0.5 rounded-full">
            {categories?.length ?? 0} categorías
          </span>
        </div>

        <div className="space-y-1.5 mb-5">
          {(categories || []).length === 0 && (
            <p className="text-sm text-ink-400 text-center py-6">Sin categorías registradas.</p>
          )}
          {(categories || []).map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 px-3 py-2.5 bg-lilac-50 rounded-xl">
              <span className="text-[11px] font-bold text-lilac-700 bg-lilac-200 px-2 py-0.5 rounded-md font-mono w-12 text-center">
                {cat.prefix}
              </span>
              <span className="text-sm text-ink-800 flex-1">{cat.name}</span>
              {canEdit && (
                <form action={deleteCategory}>
                  <input type="hidden" name="id" value={cat.id} />
                  <button
                    type="submit"
                    title="Eliminar"
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <>
            <form action={addCategory} className="flex gap-2">
              <input
                type="text"
                name="name"
                required
                placeholder="Nueva categoría"
                className="flex-1 text-sm border border-lilac-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
              />
              <input
                type="text"
                name="prefix"
                required
                maxLength={4}
                placeholder="SKU"
                title="Prefijo de 2-4 letras para el código (ej: CON)"
                className="w-16 text-sm border border-lilac-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white uppercase font-mono text-center"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 bg-lilac-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-lilac-700 transition font-medium"
              >
                <Plus size={15} /> Agregar
              </button>
            </form>
            <p className="text-xs text-ink-400 mt-2">
              El prefijo genera códigos SKU automáticos (ej: <strong>CON</strong> → <strong>CON-001</strong>).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
