import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { Ruler, Trash2, Plus } from "lucide-react";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

async function addUnit(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/unidades");
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  const supabase = createAdminClient();
  await supabase.from("inventory_units").insert({ name });
  revalidatePath("/erp/unidades");
}

async function deleteUnit(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/unidades");
  const id = formData.get("id") as string;
  const supabase = createAdminClient();
  await supabase.from("inventory_units").delete().eq("id", id);
  revalidatePath("/erp/unidades");
}

export default async function UnidadesPage() {
  await assertPermission("/erp/unidades");
  const canEdit = await hasWritePermission("/erp/unidades");

  const supabase = createAdminClient();
  const { data: units } = await supabase
    .from("inventory_units")
    .select("*")
    .eq("active", true)
    .order("name");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Ruler size={20} className="text-lilac-600" />
        <div>
          <h1 className="text-xl font-bold text-ink-900">Unidades de Medida</h1>
          <p className="text-sm text-ink-500">Define las unidades para cuantificar los insumos del inventario.</p>
        </div>
      </div>

      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-ink-700">Unidades registradas</span>
          <span className="text-xs text-ink-400 bg-lilac-50 px-2 py-0.5 rounded-full">
            {units?.length ?? 0} unidades
          </span>
        </div>

        <div className="space-y-1.5 mb-5">
          {(units || []).length === 0 && (
            <p className="text-sm text-ink-400 text-center py-6">Sin unidades registradas.</p>
          )}
          {(units || []).map((unit) => (
            <div key={unit.id} className="flex items-center gap-3 px-3 py-2.5 bg-lilac-50 rounded-xl">
              <span className="text-sm text-ink-800 flex-1">{unit.name}</span>
              {canEdit && (
                <form action={deleteUnit}>
                  <input type="hidden" name="id" value={unit.id} />
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
          <form action={addUnit} className="flex gap-2">
            <input
              type="text"
              name="name"
              required
              placeholder="Nueva unidad (ej: Litros, Cajas...)"
              className="flex-1 text-sm border border-lilac-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-lilac-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-lilac-700 transition font-medium"
            >
              <Plus size={15} /> Agregar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
