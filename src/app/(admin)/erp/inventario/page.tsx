import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Package, AlertTriangle, ArrowUpRight, Plus, Layers } from "lucide-react";
import InventoryFilters from "@/components/InventoryFilters";
import InventoryImportExport from "@/components/InventoryImportExport";
import InventoryProductList from "@/components/InventoryProductList";
import InventoryHeaderActions from "@/components/InventoryHeaderActions";
import { hasPermission } from "@/lib/roles";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";

export const dynamic = "force-dynamic";

export default async function InventoryDashboard({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const supabase = createAdminClient();
  const q = searchParams.q || "";
  const category = searchParams.category || "";

  let query = supabase
    .from("inventory_products")
    .select("*", { count: "exact" })
    .order("name");

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }
  if (category) {
    query = query.eq("category", category);
  }

  // Ejecutar consulta de productos, permisos, categorías y unidades en paralelo
  const [authData, productsRes, categoriesRes, allCategoriesRes, unitsRes] = await Promise.all([
    getCachedUserAndPermissions(),
    query,
    supabase.from("inventory_products").select("category"),
    supabase.from("inventory_categories").select("name, prefix").eq("active", true).order("name"),
    supabase.from("inventory_units").select("name").eq("active", true).order("name"),
  ]);

  const { role, allowedPaths } = authData;
  const canViewTx = hasPermission(role, "/erp/inventario/transacciones", allowedPaths);
  const canRegisterTx = hasPermission(role, "/erp/inventario/transacciones/crear", allowedPaths);
  const canEditProduct = hasPermission(role, "/erp/inventario/modificar", allowedPaths);

  const { data: products, count } = productsRes;
  const items = products || [];

  const lowStockCount = items.filter((p) => p.current_stock <= p.minimum_stock).length;
  const totalStock = items.reduce((acc, p) => acc + Number(p.current_stock), 0);

  const uniqueCategories = Array.from(new Set(categoriesRes.data?.map(c => c.category) || []));
  const categoriesList = allCategoriesRes.data || [];
  const unitsList = (unitsRes.data || []).map((u: any) => u.name);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-lg font-bold text-ink-900 flex items-center gap-2">
          <Package size={20} className="text-lilac-600 shrink-0" />
          Inventario
        </h1>
        <InventoryHeaderActions
          canEditProduct={canEditProduct}
          categories={categoriesList}
          units={unitsList}
        />
      </div>

      {/* Stats compactas */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl px-3 py-2.5 border border-lilac-100 shadow-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-lilac-50 flex items-center justify-center shrink-0">
            <Package size={16} className="text-lilac-600" />
          </div>
          <div>
            <div className="text-[11px] text-ink-500">Total</div>
            <div className="text-lg font-bold text-ink-900 leading-none">{count ?? 0}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl px-3 py-2.5 border border-lilac-100 shadow-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <div>
            <div className="text-[11px] text-ink-500">Stock bajo</div>
            <div className="text-lg font-bold text-amber-600 leading-none">{lowStockCount}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl px-3 py-2.5 border border-lilac-100 shadow-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
            <Layers size={16} className="text-green-600" />
          </div>
          <div>
            <div className="text-[11px] text-ink-500">Unidades</div>
            <div className="text-lg font-bold text-ink-900 leading-none">{totalStock}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <InventoryFilters q={q} category={category} uniqueCategories={uniqueCategories} />

      {/* Product List */}
      <InventoryProductList items={items} canRegisterTx={canRegisterTx} canViewTx={canViewTx} />
    </div>
  );
}
