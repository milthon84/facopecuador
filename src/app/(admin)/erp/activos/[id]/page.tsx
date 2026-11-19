import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { extractAssetCode, getAssetAccountInfo } from "@/lib/fixed-assets-utils";
import DepreciationScheduleTable from "@/components/DepreciationScheduleTable";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;

// Genera la tabla de depreciación completa del activo
function buildSchedule(asset: {
  purchase_date: string;
  purchase_value: number;
  salvage_value: number;
  useful_life_years: number;
}) {
  const depreciable = asset.purchase_value - asset.salvage_value;
  const totalMonths = asset.useful_life_years * 12;
  const monthly = depreciable / totalMonths;

  const start = new Date(asset.purchase_date + "T12:00:00");
  let accumulated = 0;
  const rows = [];

  for (let i = 0; i < totalMonths; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    accumulated = r2(accumulated + monthly);
    const bookValue = r2(Math.max(asset.purchase_value - accumulated, asset.salvage_value));
    rows.push({ period, monthly_amount: r2(monthly), accumulated, book_value: bookValue });
  }
  return rows;
}

// Dar de baja el activo
async function disposeAsset(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/activos");

  const supabase      = createAdminClient();
  const asset_id      = formData.get("asset_id") as string;
  const disposal_date = formData.get("disposal_date") as string;
  const disposal_value = Number(formData.get("disposal_value") || 0);
  const disposal_notes = (formData.get("disposal_notes") as string)?.trim() || null;

  await supabase.from("fixed_assets").update({
    status: "disposed", disposal_date, disposal_value, disposal_notes,
  }).eq("id", asset_id);

  redirect("/erp/activos");
}

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await assertPermission("/erp/activos");
  const canEdit = await hasWritePermission("/erp/activos");
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: asset }, { data: regDepreciations }] = await Promise.all([
    supabase.from("fixed_assets").select("*").eq("id", id).single(),
    supabase
      .from("asset_depreciations")
      .select("id, period, monthly_amount, accumulated, book_value, journal_entry_id")
      .eq("asset_id", id),
  ]);

  if (!asset) notFound();

  // Buscar asientos contables relacionados con este activo
  const journalEntryIds = (regDepreciations || [])
    .map((r) => r.journal_entry_id)
    .filter(Boolean);

  let journalEntries: any[] = [];
  if (journalEntryIds.length > 0) {
    const { data: entriesById } = await supabase
      .from("journal_entries")
      .select(
        "id, entry_number, entry_code, entry_date, description, lines:journal_lines(id, account_code, account_name, debit, credit, description)"
      )
      .in("id", journalEntryIds);
    journalEntries = entriesById || [];
  }

  // Complementar por reference_id si algún asiento no guardó id en asset_depreciations
  const { data: entriesByRef } = await supabase
    .from("journal_entries")
    .select(
      "id, entry_number, entry_code, entry_date, description, lines:journal_lines(id, account_code, account_name, debit, credit, description)"
    )
    .eq("reference_type", "depreciation")
    .eq("reference_id", id);

  const allEntriesMap = new Map<string, any>();
  for (const e of journalEntries) allEntriesMap.set(e.id, e);
  for (const e of entriesByRef || []) allEntriesMap.set(e.id, e);

  // Mapear cada período a su información de depreciación y asiento contable
  const registeredMap: Record<string, any> = {};
  for (const dep of regDepreciations || []) {
    let matchedEntry = dep.journal_entry_id
      ? allEntriesMap.get(dep.journal_entry_id)
      : null;
    if (!matchedEntry) {
      matchedEntry = [...allEntriesMap.values()].find(
        (e) =>
          e.description?.includes(dep.period) ||
          e.entry_date?.startsWith(dep.period)
      );
    }
    registeredMap[dep.period] = {
      ...dep,
      journal_entry: matchedEntry || null,
    };
  }

  const schedule = buildSchedule(asset);
  const registeredSet = new Set((regDepreciations || []).map((r) => r.period));

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Períodos vencidos no registrados (hasta el mes anterior al actual)
  const pendingPeriods = schedule.filter(s => s.period < currentPeriod && !registeredSet.has(s.period));

  const totalAccum = registeredSet.size > 0
    ? schedule.find(s => s.period === [...registeredSet].sort().at(-1))?.accumulated ?? 0
    : 0;
  const currentBookValue = r2(asset.purchase_value - totalAccum);

  const today = new Date().toISOString().split("T")[0];
  const assetCode = extractAssetCode(asset);
  const acctInfo = getAssetAccountInfo(asset);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/erp/activos"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0 shadow-xs">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {assetCode && (
                <span className="font-mono text-xs font-bold text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-lg border border-purple-200">
                  {assetCode}
                </span>
              )}
              <h1 className="text-xl font-bold text-ink-900 truncate">{asset.name}</h1>
            </div>
            <p className="text-sm text-ink-500 mt-0.5">
              <span className="font-semibold text-purple-900">{acctInfo.full}</span> · {asset.useful_life_years} años · Línea recta
            </p>
          </div>
        </div>
        <span className={`self-start sm:self-auto text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${asset.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {asset.status === "active" ? "Activo" : "Dado de baja"}
        </span>
      </div>

      {/* Info + stats */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5">
          <p className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-3">Datos del activo</p>
          <dl className="space-y-1.5 text-sm">
            {[
              ...(assetCode ? [["Código oficial", assetCode]] : []),
              ["Fecha de compra",   new Date(asset.purchase_date + "T12:00:00").toLocaleDateString("es-EC")],
              ["Costo de adquisición", `$${Number(asset.purchase_value).toFixed(2)}`],
              ["Vida útil SRI",     `${asset.useful_life_years} años`],
              ["Depreciación anual", `${asset.useful_life_years === 3 ? "33.33%" : (100 / asset.useful_life_years).toFixed(0) + "%"}`],
              ...(asset.supplier_name ? [["Proveedor", asset.supplier_name]] : []),
              ...(asset.invoice_number ? [["Factura compra", asset.invoice_number]] : []),
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-2">
                <dt className="text-ink-500">{k}</dt>
                <dd className="font-medium text-ink-900 text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-3">
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
            <p className="text-xs text-green-700 font-medium mb-1">Valor en libros actual</p>
            <p className="text-3xl font-bold text-green-800">${currentBookValue.toFixed(2)}</p>
            <p className="text-xs text-green-600 mt-1">Dep. acumulada registrada: ${totalAccum.toFixed(2)}</p>
          </div>
          {pendingPeriods.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800">{pendingPeriods.length} período(s) pendiente(s)</p>
                <p className="text-xs text-amber-700 mt-0.5">Registra la depreciación de los meses anteriores.</p>
              </div>
            </div>
          )}
          <div className="bg-white border border-lilac-100 rounded-2xl p-4">
            <p className="text-xs text-ink-500 mb-1">Cuota mensual</p>
            <p className="text-xl font-bold text-ink-900">
              ${schedule[0]?.monthly_amount.toFixed(2) ?? "—"} <span className="text-xs font-normal text-ink-400">/ mes</span>
            </p>
            <p className="text-xs text-ink-400 mt-1">
              {registeredSet.size} de {schedule.length} períodos registrados
            </p>
          </div>
        </div>
      </div>

      {/* Tabla de depreciación interactiva con visualizador de asientos */}
      <DepreciationScheduleTable
        assetId={asset.id}
        assetName={asset.name}
        assetCode={assetCode}
        usefulLifeYears={asset.useful_life_years}
        schedule={schedule}
        registeredMap={registeredMap}
        currentPeriod={currentPeriod}
        canEdit={canEdit}
      />

      {/* Dar de baja */}
      {asset.status === "active" && canEdit && (
        <div className="bg-white border border-red-100 rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-red-800 mb-1">Dar de baja el activo</h2>
          <p className="text-sm text-ink-500 mb-4">Úsalo cuando el bien sea vendido, robado, destruido o retirado de uso.</p>
          <form action={disposeAsset} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input type="hidden" name="asset_id" value={asset.id} />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Fecha de baja *</label>
              <input type="date" name="disposal_date" required defaultValue={today}
                className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Valor de recuperación</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">$</span>
                <input type="number" name="disposal_value" min="0" step="0.01" defaultValue="0"
                  className="w-full border border-red-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white font-mono" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Motivo</label>
              <input name="disposal_notes" placeholder="Venta, robo, obsolescencia..."
                className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white" />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button type="submit"
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl font-semibold text-sm transition-colors">
                Dar de baja
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
