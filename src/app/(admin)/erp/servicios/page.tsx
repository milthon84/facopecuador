import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Stethoscope, Trash2, Plus, Pencil, Search, X } from "lucide-react";
import Link from "next/link";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

async function addService(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/servicios");
  const name = (formData.get("name") as string)?.trim();
  const cashPrice = Number(formData.get("cash_price") || 0);
  if (!name) return;
  const supabase = createAdminClient();
  const { data: sriConfig } = await supabase.from("sri_configs").select("*").maybeSingle();
  const cashDiscountPercent = Number(sriConfig?.cash_discount_percent ?? sriConfig?.card_surcharge_percent ?? 6.0);
  const pvp = cashPrice / (1 - cashDiscountPercent / 100);

  await supabase.from("services").insert({
    name,
    price: pvp,
    discount_percent: 0,
    iva_code:  formData.get("iva_code") as string,
    category:  (formData.get("service_category") as string)?.trim() || "General",
  });
  redirect("/erp/servicios");
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
  const cashPrice = Number(formData.get("cash_price") || 0);
  if (!id || !name) return;
  const supabase = createAdminClient();
  const { data: sriConfig } = await supabase.from("sri_configs").select("*").maybeSingle();
  const cashDiscountPercent = Number(sriConfig?.cash_discount_percent ?? sriConfig?.card_surcharge_percent ?? 6.0);
  const pvp = cashPrice / (1 - cashDiscountPercent / 100);

  await supabase.from("services").update({
    name,
    price: pvp,
    discount_percent: 0,
    iva_code:  formData.get("iva_code") as string,
    category:  (formData.get("service_category") as string)?.trim() || "General",
  }).eq("id", id);
  redirect("/erp/servicios");
}

export default async function ServiciosPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ edit?: string, q?: string, new?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  await assertPermission("/erp/servicios");
  const canEdit = await hasWritePermission("/erp/servicios");
  const searchQuery = (searchParams.q || "").toLowerCase();

  const supabase = createAdminClient();
  const [{ data: services }, { data: sriConfig }] = await Promise.all([
    supabase.from("services").select("*").order("category").order("name"),
    supabase.from("sri_configs").select("*").maybeSingle(),
  ]);

  const cashDiscountPercent = sriConfig
    ? Number(sriConfig.cash_discount_percent ?? sriConfig.card_surcharge_percent ?? 6.0)
    : 6.0;

  type Service = {
    id: string;
    name: string;
    description: string | null;
    price: number;
    discount_percent: number;
    iva_code: string;
    category: string;
    active: boolean;
  };

  let filteredServices = (services as Service[] || []);
  const existingCategories = Array.from(
    new Set((services as Service[] || []).map((s) => s.category?.trim()).filter(Boolean))
  ).sort() as string[];

  if (searchQuery) {
    filteredServices = filteredServices.filter(s => 
      s.name.toLowerCase().includes(searchQuery) ||
      (s.category && s.category.toLowerCase().includes(searchQuery))
    );
  }

  const grouped = filteredServices.reduce(
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
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Stethoscope size={20} className="text-lilac-600 shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-ink-900">Catálogo de Servicios</h1>
            <p className="text-sm text-ink-500">Servicios disponibles para facturación y citas.</p>
          </div>
        </div>
        
        {cashDiscountPercent > 0 && (
          <div className="bg-green-50 border border-green-200 px-3 py-1.5 rounded-xl shrink-0 text-right">
            <p className="text-[10px] font-bold text-green-700 uppercase">Descuento Activo</p>
            <p className="text-sm font-bold text-green-800">{cashDiscountPercent}% en Efectivo</p>
          </div>
        )}
      </div>

      {/* Barra de Búsqueda y Botón Nuevo */}
      <div className="flex items-center gap-3 mb-4">
        <form method="GET" className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input 
            type="text" 
            name="q" 
            defaultValue={searchParams.q || ""}
            placeholder="Buscar por nombre o categoría... (Presiona Enter)" 
            className="w-full pl-9 pr-3 py-2 text-sm border border-lilac-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lilac-400 shadow-sm bg-white"
          />
        </form>
        {canEdit && (
          <Link 
            href="?new=true"
            className="shrink-0 flex items-center justify-center gap-1.5 bg-lilac-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-lilac-700 transition font-medium shadow-sm"
          >
            <Plus size={16} /> Nuevo
          </Link>
        )}
      </div>

      {/* Lista de servicios */}
      <datalist id="categories-datalist">
        {existingCategories.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>

      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-ink-700">Servicios registrados</span>
          <span className="text-xs text-ink-400 bg-lilac-50 px-2 py-0.5 rounded-full">
            {filteredServices.length} servicios
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
                            <div className="flex-1 min-w-[200px] gap-2">
                              <div className="space-y-0.5">
                                <label className="text-[10px] font-bold text-ink-500 uppercase">Nombre *</label>
                                <input
                                  type="text" name="name" required defaultValue={s.name}
                                  className="w-full text-xs border border-lilac-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lilac-400 bg-white text-ink-900"
                                />
                              </div>
                            </div>
                            <div className="w-28 space-y-0.5">
                              <label className="text-[10px] font-bold text-ink-500 uppercase">Categoría</label>
                              <input
                                type="text"
                                name="service_category"
                                defaultValue={s.category}
                                list="categories-datalist"
                                placeholder="Categoría"
                                className="w-full text-xs border border-lilac-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lilac-400 bg-white text-ink-900"
                                autoComplete="off"
                              />
                            </div>
                            <div className="w-28 space-y-0.5">
                              <label className="text-[10px] font-bold text-ink-500 uppercase" title="Precio Efectivo (Calcula el PVP)">Precio Efec.</label>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-400 text-[10px] font-bold">$</span>
                                <input
                                  type="number" name="cash_price" min="0" step="0.01" 
                                  defaultValue={(Number(s.price) * (1 - cashDiscountPercent / 100)).toFixed(2)}
                                  className="w-full text-xs border border-lilac-200 rounded-lg pl-5 pr-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-lilac-400 bg-white font-mono text-ink-900"
                                  required
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
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                              s.iva_code === "4" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"
                            }`}>
                              IVA {s.iva_code === "4" ? "15%" : "0%"}
                            </span>
                            <div className="text-right shrink-0 min-w-[90px]">
                              <p className="text-[10px] text-ink-400" title="Precio Base Oficial (Para Factura con Tarjeta)">
                                PVP: ${Number(s.price).toFixed(2)}
                              </p>
                              {cashDiscountPercent > 0 && (
                                <p className="text-[12px] font-bold text-green-700" title={`Precio Final al Contado (${cashDiscountPercent}% Desc)`}>
                                  Efectivo: ${(Number(s.price) * (1 - cashDiscountPercent / 100)).toFixed(2)}
                                </p>
                              )}
                            </div>
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

      {/* Formulario agregar servicio Modal */}
      {canEdit && searchParams.new === "true" && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          {/* Fondo oscuro con desenfoque (pantalla negra al hacer clic cierra el modal) */}
          <Link
            href="/erp/servicios"
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            aria-label="Cerrar modal"
          />

          {/* Tarjeta del Modal */}
          <div className="relative z-10 w-full max-w-md bg-white border border-lilac-100 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
            <div className="bg-lilac-50/70 border-b border-lilac-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center font-bold">
                  <Stethoscope size={18} />
                </div>
                <h3 className="font-bold text-ink-950 text-base">Nuevo Servicio</h3>
              </div>
              <Link
                href="/erp/servicios"
                className="text-ink-400 hover:text-ink-700 p-1.5 rounded-lg transition hover:bg-lilac-100"
              >
                <X size={18} />
              </Link>
            </div>

            <form action={addService} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">
                  Nombre del servicio <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Ej: Profilaxis Dental Profunda"
                  className="w-full text-sm border border-lilac-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">
                  Categoría
                </label>
                <input
                  type="text"
                  name="service_category"
                  list="categories-datalist"
                  placeholder="Selecciona una o escribe una nueva..."
                  className="w-full text-sm border border-lilac-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">
                  Precio Efectivo <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm font-bold">$</span>
                  <input
                    type="number"
                    name="cash_price"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full text-sm border border-lilac-200 rounded-xl pl-8 pr-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono"
                    required
                  />
                </div>
                <p className="text-[11px] text-ink-400 mt-1">
                  El sistema calculará automáticamente el PVP oficial sumando el descuento de efectivo.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">
                  Tarifa IVA <span className="text-red-500">*</span>
                </label>
                <select
                  name="iva_code"
                  className="w-full text-sm border border-lilac-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
                >
                  <option value="4">IVA 15%</option>
                  <option value="0">IVA 0%</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-lilac-100">
                <Link
                  href="/erp/servicios"
                  className="px-4 py-2.5 text-sm font-semibold text-ink-600 hover:text-ink-900 hover:bg-lilac-100 rounded-xl transition-colors"
                >
                  Cancelar
                </Link>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-1.5 bg-lilac-600 hover:bg-lilac-700 text-white text-sm px-5 py-2.5 rounded-xl transition font-medium shadow-sm hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Plus size={16} /> Guardar Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
