import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Landmark } from "lucide-react";
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
  const bank_account_id = (formData.get("bank_account_id") as string) || null;
  const payment_reference = (formData.get("payment_reference") as string)?.trim() || null;
  const supplier_name = (formData.get("supplier_name") as string)?.trim() || null;
  const supplier_ruc = (formData.get("supplier_ruc") as string)?.trim() || null;
  const invoice_number = (formData.get("invoice_number") as string)?.trim() || null;
  const register_in_expenses = formData.get("register_in_expenses") === "on";

  await createAssetAction({
    name,
    asset_type,
    purchase_date,
    purchase_value,
    bank_account_id,
    payment_reference,
    supplier_name,
    supplier_ruc,
    invoice_number,
    register_in_expenses,
  });

  redirect("/erp/activos");
}

export default async function NuevoActivoPage() {
  await assertWritePermission("/erp/activos");
  const supabase = createAdminClient();
  const { data: bankAccounts } = await supabase
    .from("bank_accounts")
    .select("id, bank_name, account_number")
    .eq("is_active", true)
    .order("bank_name");

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-2xl mx-auto">
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
            El código secuencial, vida útil y porcentaje SRI se asignan automáticamente según el tipo de bien.
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
              Tipo de Activo Fijo (Tabla Oficial SRI) *
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
                Fecha de Adquisición *
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
                Valor de Compra ($ Costo) *
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

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Forma de Pago / Origen de Fondos
            </label>
            <select
              name="bank_account_id"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-500 bg-white cursor-pointer"
            >
              <option value="">A crédito / Por pagar (Cuentas por Pagar Proveedores)</option>
              {(bankAccounts || []).map((b) => (
                <option key={b.id} value={b.id}>
                  Pago directo con Banco: {b.bank_name} {b.account_number ? `(${b.account_number})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2.5">
            <span className="text-xs font-semibold text-ink-700 block">Datos del Comprobante / Proveedor (Opcional)</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-ink-500 mb-0.5">
                  Proveedor
                </label>
                <input
                  name="supplier_name"
                  type="text"
                  placeholder="Empresa o persona"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-lilac-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-ink-500 mb-0.5">
                  N° Factura
                </label>
                <input
                  name="invoice_number"
                  type="text"
                  placeholder="001-002-000123456"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-lilac-500"
                />
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-ink-800">
                <input
                  name="register_in_expenses"
                  type="checkbox"
                  className="accent-lilac-600 rounded"
                />
                <span className="font-medium">
                  Registrar también como Factura de Compra en el módulo de Gastos
                </span>
              </label>
            </div>
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
