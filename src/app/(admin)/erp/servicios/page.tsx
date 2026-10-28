import { createAdminClient } from "@/lib/supabase/admin";
import { Stethoscope, Search } from "lucide-react";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import NuevoServicioModal from "@/components/NuevoServicioModal";
import ServiciosListClient from "./ServiciosListClient";

export const dynamic = "force-dynamic";

export default async function ServiciosPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ q?: string }>;
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
    <div className="max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-lilac-50 border border-lilac-200 text-lilac-700 flex items-center justify-center shrink-0">
            <Stethoscope size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-ink-950 tracking-tight">Catálogo de Servicios</h1>
            <p className="text-xs text-ink-500 font-medium">Servicios y tratamientos disponibles para facturación y citas.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {cashDiscountPercent > 0 && (
            <div className="bg-green-50 border border-green-200 px-3 py-1.5 rounded-xl shrink-0 text-right shadow-2xs">
              <p className="text-[10px] font-bold text-green-700 uppercase">Descuento Efectivo</p>
              <p className="text-xs sm:text-sm font-black text-green-800">{cashDiscountPercent}%</p>
            </div>
          )}

          {canEdit && (
            <NuevoServicioModal
              existingCategories={existingCategories}
              cashDiscountPercent={cashDiscountPercent}
            />
          )}
        </div>
      </div>

      {/* Barra de Búsqueda */}
      <div className="mb-6">
        <form method="GET" className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input 
            type="text" 
            name="q" 
            defaultValue={searchParams.q || ""}
            placeholder="Buscar por nombre o categoría... (Presiona Enter)" 
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-lilac-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-lilac-400 shadow-sm bg-white"
          />
        </form>
      </div>

      {/* Lista de Servicios agrupados con soporte para colapsar por categoría */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white border border-dashed border-lilac-200 rounded-3xl p-12 text-center shadow-xs">
          <Stethoscope size={36} className="mx-auto text-lilac-300 mb-2" />
          <p className="text-sm font-semibold text-ink-800">No se encontraron servicios</p>
          <p className="text-xs text-ink-500 mt-1">Prueba con otro término de búsqueda o crea uno nuevo.</p>
        </div>
      ) : (
        <ServiciosListClient
          grouped={grouped}
          existingCategories={existingCategories}
          cashDiscountPercent={cashDiscountPercent}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
