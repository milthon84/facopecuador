import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Package, AlertTriangle, ArrowUpRight, Plus, Layers } from "lucide-react";
import InventoryFilters from "@/components/InventoryFilters";
import InventoryImportExport from "@/components/InventoryImportExport";
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

  // Ejecutar consulta de productos, permisos y categorías en paralelo
  const [authData, productsRes, categoriesRes] = await Promise.all([
    getCachedUserAndPermissions(),
    query,
    supabase.from("inventory_products").select("category")
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

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-lg font-bold text-ink-900 flex items-center gap-2">
          <Package size={20} className="text-lilac-600 shrink-0" />
          Inventario
        </h1>
        <div className="flex items-center gap-2">
          {canViewTx && (
            <Link
              href="/erp/inventario/transacciones"
              className="flex items-center gap-1.5 text-sm bg-white border border-lilac-200 hover:bg-lilac-50 px-3 py-1.5 rounded-xl transition-colors font-medium text-ink-700 shadow-sm"
            >
              <Layers size={15} />
              <span className="hidden sm:inline">Movimientos</span>
            </Link>
          )}
          {canEditProduct && (
            <Link
              href="/erp/inventario/nuevo"
              className="flex items-center gap-1.5 text-sm bg-lilac-600 hover:bg-lilac-700 text-white px-3 py-1.5 rounded-xl transition-colors font-medium shadow-sm"
            >
              <Plus size={15} />
              Nuevo
            </Link>
          )}
        </div>
      </div>

      {/* Import / Export Excel */}
      <div className="bg-white border border-lilac-100 rounded-xl shadow-sm px-4 py-3 mb-4">
        <InventoryImportExport canImport={canEditProduct} />
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
      <div className="bg-white border border-lilac-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-lilac-50/50 text-ink-600 text-xs uppercase font-semibold">
              <tr>
                <th className="px-5 py-4">Producto</th>
                <th className="px-5 py-4">Categoría</th>
                <th className="px-5 py-4 text-center">Stock Actual</th>
                <th className="px-5 py-4 text-center">Stock Mínimo</th>
                {(canRegisterTx || canViewTx) && <th className="px-5 py-4 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-lilac-50">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-ink-500">
                    <div className="flex flex-col items-center gap-3">
                      <Package size={40} className="text-lilac-200" />
                      <p>No se encontraron productos.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((p) => {
                  const isLow = Number(p.current_stock) <= Number(p.minimum_stock);
                  return (
                    <tr key={p.id} className="hover:bg-lilac-50/30 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="font-medium text-ink-900">{p.name}</div>
                        {p.sku && <div className="text-xs text-ink-500 mt-0.5">SKU: {p.sku}</div>}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-lilac-100 text-lilac-700">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold ${isLow ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                          {p.current_stock}
                          <span className="text-[10px] uppercase ml-1 opacity-70 font-semibold">{p.unit_of_measure}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center text-ink-500 font-medium">
                        {p.minimum_stock}
                      </td>
                      {(canRegisterTx || canViewTx) && (
                        <td className="px-5 py-4 text-right">
                          <Link
                            href={canRegisterTx ? `/erp/inventario/transacciones?product=${p.id}` : `/erp/inventario/transacciones`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-lilac-600 hover:text-lilac-800 transition-colors bg-lilac-50 px-2 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 animate-fade-in"
                          >
                            {canRegisterTx ? "Registrar" : "Ver historial"}
                            <ArrowUpRight size={14} />
                          </Link>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
