import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { assertWritePermission } from "@/lib/auth-action";
import { createAssetAction } from "../actions";
import { ASSET_TYPES } from "@/lib/fixed-assets-utils";

export const dynamic = "force-dynamic";

async function saveAsset(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/activos");

  const name = (formData.get("name") as string)?.trim();
  const asset_type = (formData.get("asset_type") as string) || "equipos_medicos";
  const purchase_date = formData.get("purchase_date") as string;
  const purchase_value = Number(formData.get("purchase_value"));
  const create_journal_entry = formData.get("create_journal_entry") === "true";

  await createAssetAction({
    name,
    asset_type,
    purchase_date,
    purchase_value,
    create_journal_entry,
  });

  redirect("/erp/activos");
}

export default async function NuevoActivoPage() {
  await assertWritePermission("/erp/activos");
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/erp/activos"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink-900">Registrar Activo Fijo</h1>
          <p className="text-xs text-ink-500">
            La cuenta del Plan de Cuentas define su código, vida útil y porcentaje de depreciación.
          </p>
        </div>
      </div>

      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4 sm:p-6">
        <form action={saveAsset} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Nombre o Descripción del Activo *
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="Ej. Sillón Odontológico Gnatus S300, Laptop MacBook Pro M3..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Cuenta de Activo Fijo (Plan de Cuentas) *
            </label>
            <select
              name="asset_type"
              required
              defaultValue="equipos_medicos"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-medium text-ink-900 bg-white cursor-pointer"
            >
              {Object.entries(ASSET_TYPES).map(([k, t]) => (
                <option key={k} value={k}>
                  {t.label} ({t.years} años · {t.percentage}%)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Fecha de Adquisición / Registro *
              </label>
              <input
                name="purchase_date"
                type="date"
                required
                defaultValue={today}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Valor del Activo ($ Costo) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs font-semibold">
                  $
                </span>
                <input
                  name="purchase_value"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono font-bold text-ink-900 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Opción de asiento contable */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="text-xs font-bold text-ink-900">
              ¿Generar asiento contable de compra en Libro Diario?
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer text-xs">
              <input
                type="radio"
                name="create_journal_entry"
                value="false"
                defaultChecked
                className="mt-0.5 text-lilac-600 focus:ring-lilac-500"
              />
              <div>
                <span className="font-semibold text-ink-800 block">
                  No generar asiento (Factura ya registrada previamente en Gastos/Compras)
                </span>
                <span className="text-[11px] text-ink-500 block">
                  Registra el activo para inventario y depreciaciones sin duplicar la contabilización de compra.
                </span>
              </div>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer text-xs pt-1.5 border-t border-slate-200">
              <input
                type="radio"
                name="create_journal_entry"
                value="true"
                className="mt-0.5 text-lilac-600 focus:ring-lilac-500"
              />
              <div>
                <span className="font-semibold text-ink-800 block">
                  Sí, generar nuevo asiento de compra en Libro Diario
                </span>
                <span className="text-[11px] text-ink-500 block">
                  Crea automáticamente el asiento de adquisición en el Libro Diario.
                </span>
              </div>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-md shadow-lilac-200 cursor-pointer"
            >
              <Save size={16} /> Registrar activo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
