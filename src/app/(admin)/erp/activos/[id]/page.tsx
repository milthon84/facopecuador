import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import { ArrowLeft, TrendingDown, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { createDepreciationJournalEntry } from "@/lib/accounting";

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

  const start = new Date(asset.purchase_date);
  let accumulated = 0;
  const rows = [];

  for (let i = 0; i < totalMonths; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i + 1, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    accumulated = r2(accumulated + monthly);
    const bookValue = r2(Math.max(asset.purchase_value - accumulated, asset.salvage_value));
    rows.push({ period, monthly_amount: r2(monthly), accumulated, book_value: bookValue });
  }
  return rows;
}

// Registra un período de depreciación
async function registerDepreciation(formData: FormData) {
  "use server";
  const user = await assertWritePermission("/erp/activos");

  const supabase       = createAdminClient();
  const asset_id       = formData.get("asset_id") as string;
  const period         = formData.get("period") as string;
  const monthly_amount = Number(formData.get("monthly_amount"));
  const accumulated    = Number(formData.get("accumulated"));
  const book_value     = Number(formData.get("book_value"));

  // Obtener datos del activo para el asiento
  const { data: asset } = await supabase
    .from("fixed_assets")
    .select("name, category")
    .eq("id", asset_id)
    .single();

  if (!asset) throw new Error("Activo no encontrado");

  let journal_entry_id: string | null = null;
  try {
    journal_entry_id = await createDepreciationJournalEntry({
      asset_id, asset_name: asset.name, category: asset.category,
      period, monthly_amount, user_id: user?.id, user_email: user?.email,
    });
  } catch (e) { console.error("Asiento no generado:", e); }

  await supabase.from("asset_depreciations").upsert({
    asset_id, period, monthly_amount, accumulated, book_value,
    journal_entry_id,
  }, { onConflict: "asset_id,period" });

  redirect(`/erp/activos/${asset_id}`);
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

  const [{ data: asset }, { data: regPeriods }] = await Promise.all([
    supabase.from("fixed_assets").select("*").eq("id", id).single(),
    supabase.from("asset_depreciations").select("period").eq("asset_id", id),
  ]);

  if (!asset) notFound();

  const schedule = buildSchedule(asset);
  const registeredSet = new Set((regPeriods || []).map(r => r.period));

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Períodos vencidos no registrados (hasta el mes anterior al actual)
  const pendingPeriods = schedule.filter(s => s.period < currentPeriod && !registeredSet.has(s.period));

  const totalAccum = registeredSet.size > 0
    ? schedule.find(s => s.period === [...registeredSet].sort().at(-1))?.accumulated ?? 0
    : 0;
  const currentBookValue = r2(asset.purchase_value - totalAccum);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/erp/activos"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink-900">{asset.name}</h1>
          <p className="text-sm text-ink-500">{asset.category} · {asset.useful_life_years} años · Línea recta</p>
        </div>
        <span className={`ml-auto text-xs font-semibold px-3 py-1 rounded-full ${asset.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {asset.status === "active" ? "Activo" : "Dado de baja"}
        </span>
      </div>

      {/* Info + stats */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5">
          <p className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-3">Datos del activo</p>
          <dl className="space-y-1.5 text-sm">
            {[
              ["Fecha de compra",   new Date(asset.purchase_date + "T12:00:00").toLocaleDateString("es-EC")],
              ["Costo de adquisición", `$${Number(asset.purchase_value).toFixed(2)}`],
              ["Valor residual",    `$${Number(asset.salvage_value).toFixed(2)}`],
              ["Vida útil SRI",     `${asset.useful_life_years} años`],
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

      {/* Tabla de depreciación */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-lilac-50 flex items-center justify-between">
          <h2 className="font-semibold text-ink-900 flex items-center gap-2">
            <TrendingDown size={16} className="text-lilac-600" />
            Tabla de depreciación
          </h2>
          <span className="text-xs text-ink-400">{schedule.length} períodos · {asset.useful_life_years} años</span>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-lilac-50/50 text-xs text-ink-500 uppercase font-semibold sticky top-0">
              <tr>
                <th className="px-4 py-2.5 text-left">Período</th>
                <th className="px-4 py-2.5 text-right">Cuota mensual</th>
                <th className="px-4 py-2.5 text-right">Dep. acumulada</th>
                <th className="px-4 py-2.5 text-right">Valor en libros</th>
                <th className="px-4 py-2.5 text-center">Estado</th>
                {asset.status === "active" && canEdit && <th className="px-4 py-2.5"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-lilac-50">
              {schedule.map(row => {
                const isRegistered = registeredSet.has(row.period);
                const isFuture     = row.period > currentPeriod;
                const isCurrent    = row.period === currentPeriod;
                return (
                  <tr key={row.period} className={`transition-colors ${isCurrent ? "bg-lilac-50/40" : "hover:bg-lilac-50/20"}`}>
                    <td className="px-4 py-2 font-mono text-sm">
                      {row.period}
                      {isCurrent && <span className="ml-2 text-[10px] bg-lilac-100 text-lilac-700 px-1.5 py-0.5 rounded-full">actual</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">${row.monthly_amount.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono text-ink-600">${row.accumulated.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-bold font-mono text-green-700">${row.book_value.toFixed(2)}</td>
                    <td className="px-4 py-2 text-center">
                      {isRegistered ? (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                          <CheckCircle2 size={10} /> Registrado
                        </span>
                      ) : isFuture ? (
                        <span className="text-[10px] text-ink-300">Futuro</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                          <Clock size={10} /> Pendiente
                        </span>
                      )}
                    </td>
                    {asset.status === "active" && canEdit && (
                      <td className="px-4 py-2 text-right">
                        {!isRegistered && !isFuture && (
                          <form action={registerDepreciation}>
                            <input type="hidden" name="asset_id"       value={asset.id} />
                            <input type="hidden" name="period"         value={row.period} />
                            <input type="hidden" name="monthly_amount" value={row.monthly_amount} />
                            <input type="hidden" name="accumulated"    value={row.accumulated} />
                            <input type="hidden" name="book_value"     value={row.book_value} />
                            <button type="submit"
                              className="text-xs text-lilac-600 hover:text-lilac-800 border border-lilac-200 hover:bg-lilac-50 px-2 py-0.5 rounded-lg transition-colors font-medium">
                              Registrar
                            </button>
                          </form>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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
