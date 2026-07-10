import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Stethoscope, Trash2, Plus, Pencil } from "lucide-react";
import Link from "next/link";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

async function addService(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/servicios");
  const name = (formData.get("name") as string)?.trim();
  const price = Number(formData.get("price") || 0);
  if (!name) return;
  const supabase = createAdminClient();
  await supabase.from("services").insert({
    name,
    description: (formData.get("description") as string)?.trim() || null,
    price,
    iva_code:  formData.get("iva_code") as string,
    category:  (formData.get("service_category") as string)?.trim() || "General",
  });
  revalidatePath("/erp/servicios");
}

async function toggleService(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/servicios");
  const id     = formData.get("id") as string;
  const active = formData.get("active") === "true";
  const supabase = createAdminClient();
  await supabase.from("services").update({ active: !active }).eq("id", id);
  revalidatePath("/erp/servicios");
}

async function deleteService(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/servicios");
  const id = formData.get("id") as string;
  const supabase = createAdminClient();
  await supabase.from("services").delete().eq("id", id);
  revalidatePath("/erp/servicios");
}

async function updateService(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/servicios");
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const price = Number(formData.get("price") || 0);
  if (!id || !name) return;
  const supabase = createAdminClient();
  await supabase.from("services").update({
    name,
    description: (formData.get("description") as string)?.trim() || null,
    price,
    iva_code:  formData.get("iva_code") as string,
    category:  (formData.get("service_category") as string)?.trim() || "General",
  }).eq("id", id);
  redirect("/erp/servicios");
}

export default async function ServiciosPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  await assertPermission("/erp/servicios");
  const canEdit = await hasWritePermission("/erp/servicios");

  const supabase = createAdminClient();
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .order("category")
    .order("name");

  type Service = {
    id: string;
    name: string;
    description: string | null;
    price: number;
    iva_code: string;
    category: string;
    active: boolean;
  };

  const grouped = (services as Service[] || []).reduce(
    (acc: Record<string, Service[]>, s) => {
      const cat = s.category ?? "General";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(s);
      return acc;
    },
    {}
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Stethoscope size={20} className="text-lilac-600" />
        <div>
          <h1 className="text-xl font-bold text-ink-900">Catálogo de Servicios</h1>
          <p className="text-sm text-ink-500">Servicios disponibles para facturación y citas.</p>
        </div>
      </div>

      {/* Lista de servicios */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-ink-700">Servicios registrados</span>
          <span className="text-xs text-ink-400 bg-lilac-50 px-2 py-0.5 rounded-full">
            {services?.length ?? 0} servicios
          </span>
        </div>

        {Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-6">
            Sin servicios. Ejecuta la migración SQL para cargar los iniciales.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-[11px] font-bold text-ink-400 uppercase tracking-wide mb-2">{cat}</p>
                <div className="space-y-1">
                  {items.map((s) => {
                    const isEditing = searchParams.edit === s.id;
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
                          isEditing
                            ? "bg-amber-50/50 border border-amber-200 animate-pulse-once"
                            : s.active
                            ? "bg-lilac-50"
                            : "bg-gray-50 opacity-60"
                        }`}
                      >
                        {isEditing ? (
                          <form action={updateService} className="flex-1 flex flex-wrap items-center gap-2">
                            <input type="hidden" name="id" value={s.id} />
                            <div className="flex-1 min-w-[200px] grid grid-cols-2 gap-2">
                              <div className="space-y-0.5">
                                <label className="text-[10px] font-bold text-ink-500 uppercase">Nombre *</label>
                                <input
                                  type="text" name="name" required defaultValue={s.name}
                                  className="w-full text-xs border border-lilac-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lilac-400 bg-white text-ink-900"
                                />
                              </div>
                              <div className="space-y-0.5">
                                <label className="text-[10px] font-bold text-ink-500 uppercase">Descripción</label>
                                <input
                                  type="text" name="description" defaultValue={s.description || ""}
                                  className="w-full text-xs border border-lilac-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lilac-400 bg-white text-ink-900"
                                />
                              </div>
                            </div>
                            <div className="w-24 space-y-0.5">
                              <label className="text-[10px] font-bold text-ink-500 uppercase">Categoría</label>
                              <input
                                type="text" name="service_category" defaultValue={s.category}
                                className="w-full text-xs border border-lilac-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lilac-400 bg-white text-ink-900"
                              />
                            </div>
                            <div className="w-20 space-y-0.5">
                              <label className="text-[10px] font-bold text-ink-500 uppercase">Precio</label>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-400 text-[10px]">$</span>
                                <input
                                  type="number" name="price" min="0" step="0.01" defaultValue={s.price}
                                  className="w-full text-xs border border-lilac-200 rounded-lg pl-5 pr-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lilac-400 bg-white font-mono text-ink-900"
                                />
                              </div>
                            </div>
                            <div className="w-16 space-y-0.5">
                              <label className="text-[10px] font-bold text-ink-500 uppercase">IVA</label>
                              <select
                                name="iva_code" defaultValue={s.iva_code}
                                className="w-full text-xs border border-lilac-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lilac-400 bg-white text-ink-900"
                              >
                                <option value="4">15%</option>
                                <option value="0">0%</option>
                              </select>
                            </div>
                            <div className="flex gap-1 shrink-0 pt-3">
                              <button
                                type="submit"
                                className="text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded-lg transition font-medium shadow-sm"
                              >
                                Guardar
                              </button>
                              <Link
                                href="/erp/servicios"
                                className="text-xs bg-white border border-lilac-200 text-ink-700 hover:bg-lilac-50 px-2.5 py-1.5 rounded-lg transition font-medium"
                              >
                                Cancelar
                              </Link>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-ink-800">{s.name}</span>
                              {s.description && (
                                <span className="text-xs text-ink-400 ml-2 truncate">{s.description}</span>
                              )}
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                              s.iva_code === "4" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"
                            }`}>
                              IVA {s.iva_code === "4" ? "15%" : "0%"}
                            </span>
                            <span className="text-sm font-bold text-lilac-700 w-16 text-right shrink-0">
                              ${Number(s.price).toFixed(2)}
                            </span>
                            {canEdit && (
                              <div className="flex gap-1 shrink-0">
                                <Link
                                  href={`/erp/servicios?edit=${s.id}`}
                                  title="Editar"
                                  className="p-1.5 text-lilac-600 hover:text-lilac-800 hover:bg-lilac-50 rounded-lg transition"
                                >
                                  <Pencil size={13} />
                                </Link>
                                <form action={toggleService}>
                                  <input type="hidden" name="id"     value={s.id} />
                                  <input type="hidden" name="active" value={String(s.active)} />
                                  <button
                                    type="submit"
                                    title={s.active ? "Desactivar" : "Activar"}
                                    className={`p-1.5 rounded-lg transition text-base leading-none ${
                                      s.active ? "text-amber-500 hover:bg-amber-50" : "text-green-600 hover:bg-green-50"
                                    }`}
                                  >
                                    {s.active ? "●" : "○"}
                                  </button>
                                </form>
                                <form action={deleteService}>
                                  <input type="hidden" name="id" value={s.id} />
                                  <button
                                    type="submit"
                                    title="Eliminar"
                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </form>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulario agregar servicio */}
      {canEdit && (
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-ink-700 mb-4 flex items-center gap-2">
            <Plus size={15} className="text-lilac-600" /> Nuevo servicio
          </h2>
          <form action={addService} className="grid grid-cols-2 gap-3">
            <input
              type="text" name="name" required
              placeholder="Nombre del servicio *"
              className="col-span-2 text-sm border border-lilac-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
            />
            <input
              type="text" name="description"
              placeholder="Descripción (opcional)"
              className="col-span-2 text-sm border border-lilac-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
            />
            <input
              type="text" name="service_category"
              placeholder="Categoría (ej: Cirugía)"
              className="text-sm border border-lilac-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
            />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">$</span>
              <input
                type="number" name="price" min="0" step="0.01" defaultValue="0"
                placeholder="Precio"
                className="w-full text-sm border border-lilac-200 rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono"
              />
            </div>
            <select
              name="iva_code"
              className="text-sm border border-lilac-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
            >
              <option value="4">IVA 15%</option>
              <option value="0">IVA 0%</option>
            </select>
            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 bg-lilac-600 text-white text-sm px-3 py-2.5 rounded-xl hover:bg-lilac-700 transition font-medium"
            >
              <Plus size={15} /> Agregar servicio
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
