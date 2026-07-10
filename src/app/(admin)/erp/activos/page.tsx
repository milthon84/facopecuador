import { createAdminClient } from "@/lib/supabase/admin";
import { Landmark, Plus, TrendingDown, DollarSign, Package } from "lucide-react";
import Link from "next/link";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;

type FixedAsset = {
  id: string;
  name: string;
  category: string;
  purchase_date: string;
  purchase_value: number;
  salvage_value: number;
  useful_life_years: number;
  status: string;
  disposal_value: number | null;
};

/** Calcula el valor en libros actual según depreciación lineal */
function currentBookValue(asset: FixedAsset): number {
  if (asset.status === "disposed") return asset.disposal_value ?? asset.salvage_value;
  const start = new Date(asset.purchase_date);
  const now = new Date();
  const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  const totalMonths = asset.useful_life_years * 12;
  const depreciable = asset.purchase_value - asset.salvage_value;
  const monthly = depreciable / totalMonths;
  const accumulated = monthly * Math.min(monthsElapsed, totalMonths);
  return r2(Math.max(asset.purchase_value - accumulated, asset.salvage_value));
}

function pctDepreciated(asset: FixedAsset): number {
  if (asset.status === "disposed") return 100;
  const start = new Date(asset.purchase_date);
  const now = new Date();
  const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.min(Math.round((monthsElapsed / (asset.useful_life_years * 12)) * 100), 100);
}

const CATEGORY_COLOR: Record<string, string> = {
  "Inmuebles":                  "bg-blue-50 text-blue-700 border-blue-200",
  "Equipos odontológicos":      "bg-lilac-50 text-lilac-700 border-lilac-200",
  "Equipos de computación":     "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Muebles y enseres":          "bg-amber-50 text-amber-700 border-amber-200",
  "Vehículos":                  "bg-green-50 text-green-700 border-green-200",
  "Otros equipos y maquinaria": "bg-gray-50 text-gray-700 border-gray-200",
};

export default async function ActivosPage() {
  await assertPermission("/erp/activos");
  const canEdit = await hasWritePermission("/erp/activos");
  const supabase = createAdminClient();
  const { data: assets } = await supabase
    .from("fixed_assets")
    .select("id,name,category,purchase_date,purchase_value,salvage_value,useful_life_years,status,disposal_value")
    .order("purchase_date", { ascending: false });

  const list = (assets as FixedAsset[]) || [];
  const active = list.filter(a => a.status === "active");
  const totalCost = r2(active.reduce((s, a) => s + a.purchase_value, 0));
  const totalBookValue = r2(active.reduce((s, a) => s + currentBookValue(a), 0));
  const totalAccumDep = r2(totalCost - totalBookValue);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
            <Landmark className="text-lilac-600" />
            Activos Fijos
          </h1>
          <p className="text-sm text-ink-600">Registro, depreciación y gestión de bienes de capital.</p>
        </div>
        {canEdit && (
          <Link href="/erp/activos/nuevo"
            className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors shadow-md shadow-lilac-200 shrink-0">
            <Plus size={16} /> Registrar activo
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Activos en uso",         value: active.length.toString(),       icon: <Package size={18} className="text-lilac-600" />, bg: "bg-lilac-50" },
          { label: "Costo total",            value: `$${totalCost.toFixed(2)}`,     icon: <DollarSign size={18} className="text-blue-600" />, bg: "bg-blue-50" },
          { label: "Valor en libros",        value: `$${totalBookValue.toFixed(2)}`,icon: <Landmark size={18} className="text-green-600" />, bg: "bg-green-50" },
          { label: "Dep. acumulada",         value: `$${totalAccumDep.toFixed(2)}`, icon: <TrendingDown size={18} className="text-red-500" />, bg: "bg-red-50" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-lilac-100 shadow-sm flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>{s.icon}</div>
            <div>
              <div className="text-xs text-ink-500">{s.label}</div>
              <div className="text-base font-bold text-ink-900">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      {list.length === 0 ? (
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-12 text-center">
          <Landmark size={36} className="text-lilac-200 mx-auto mb-3" />
          <p className="text-ink-500 font-medium">Sin activos registrados</p>
          {canEdit && (
            <Link href="/erp/activos/nuevo" className="mt-3 inline-flex items-center gap-1.5 text-sm text-lilac-600 hover:underline">
              <Plus size={14} /> Registrar el primero
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-lilac-50/50 text-xs text-ink-500 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">Activo</th>
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-right">Costo</th>
                  <th className="px-4 py-3 text-center">Depreciado</th>
                  <th className="px-4 py-3 text-right">Valor en libros</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {list.map(asset => {
                  const bv  = currentBookValue(asset);
                  const pct = pctDepreciated(asset);
                  return (
                    <tr key={asset.id} className="hover:bg-lilac-50/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink-900">{asset.name}</p>
                        <p className="text-xs text-ink-400">
                          Adquirido {new Date(asset.purchase_date + "T12:00:00").toLocaleDateString("es-EC")}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_COLOR[asset.category] ?? "bg-gray-50 text-gray-700 border-gray-200"}`}>
                          {asset.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">${asset.purchase_value.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-red-400" : "bg-lilac-500"}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-ink-500 w-9 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold font-mono ${bv <= asset.salvage_value ? "text-red-500" : "text-green-700"}`}>
                        ${bv.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${asset.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {asset.status === "active" ? "Activo" : "Dado de baja"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/erp/activos/${asset.id}`}
                          className="text-xs text-lilac-600 hover:underline font-medium">Ver →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
