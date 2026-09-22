import { createAdminClient } from "@/lib/supabase/admin";
import { Ruler } from "lucide-react";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import NuevaUnidadModal from "@/components/NuevaUnidadModal";
import EditarUnidadModal from "@/components/EditarUnidadModal";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { deleteUnitAction } from "./actions";

export const dynamic = "force-dynamic";

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
    <div className="max-w-2xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-lilac-50 border border-lilac-200 text-lilac-700 flex items-center justify-center shrink-0">
            <Ruler size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-ink-950 tracking-tight">Unidades de Medida</h1>
            <p className="text-xs text-ink-500 font-medium">Unidades para cuantificar y controlar insumos de inventario.</p>
          </div>
        </div>

        {canEdit && <NuevaUnidadModal />}
      </div>

      <div className="bg-white border border-lilac-100 rounded-3xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-lilac-50">
          <span className="text-xs font-bold text-ink-700 uppercase tracking-wider">Unidades registradas</span>
          <span className="text-xs text-lilac-700 bg-lilac-50 border border-lilac-200/80 px-2.5 py-0.5 rounded-full font-bold">
            {units?.length ?? 0} {units?.length === 1 ? "unidad" : "unidades"}
          </span>
        </div>

        <div className="space-y-2">
          {(units || []).length === 0 && (
            <div className="text-center py-10">
              <Ruler size={32} className="mx-auto text-lilac-300 mb-2" />
              <p className="text-sm font-semibold text-ink-800">Sin unidades registradas</p>
              <p className="text-xs text-ink-500 mt-1">Crea tu primera unidad con el botón superior.</p>
            </div>
          )}

          {(units || []).map((unit) => (
            <div
              key={unit.id}
              className="flex items-center justify-between gap-3 px-4 py-3 bg-lilac-50/40 hover:bg-lilac-50/80 border border-lilac-100 rounded-2xl transition-colors group"
            >
              <span className="text-sm font-bold text-ink-900 truncate">{unit.name}</span>

              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <EditarUnidadModal unit={{ id: unit.id, name: unit.name }} />
                  <ConfirmDeleteButton
                    action={deleteUnitAction}
                    idName="id"
                    idValue={unit.id}
                    confirmMessage={`¿Estás seguro de eliminar la unidad "${unit.name}"?`}
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
