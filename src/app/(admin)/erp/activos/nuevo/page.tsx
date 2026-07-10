import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { createAssetPurchaseJournalEntry } from "@/lib/accounting";
import { assertWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

const ASSET_CATEGORIES = [
  { label: "Inmuebles",                  years: 20 },
  { label: "Equipos odontológicos",      years: 10 },
  { label: "Equipos de computación",     years: 3  },
  { label: "Muebles y enseres",          years: 10 },
  { label: "Vehículos",                  years: 5  },
  { label: "Otros equipos y maquinaria", years: 10 },
];

async function saveAsset(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/activos");
  const supabase   = createAdminClient();
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const bank_account_id   = (formData.get("bank_account_id") as string) || null;
  const payment_reference = (formData.get("payment_reference") as string)?.trim() || null;
  const purchase_value    = Number(formData.get("purchase_value"));
  const purchase_date     = formData.get("purchase_date") as string;
  const category          = formData.get("category") as string;
  const name              = (formData.get("name") as string).trim();

  const { data: asset, error } = await supabase.from("fixed_assets").insert({
    name,
    category,
    description:        (formData.get("description") as string)?.trim() || null,
    purchase_date,
    purchase_value,
    salvage_value:      Number(formData.get("salvage_value") || 0),
    useful_life_years:  Number(formData.get("useful_life_years")),
    supplier_name:      (formData.get("supplier_name") as string)?.trim() || null,
    supplier_ruc:       (formData.get("supplier_ruc") as string)?.trim() || null,
    invoice_number:     (formData.get("invoice_number") as string)?.trim() || null,
    bank_account_id:    bank_account_id || null,
    payment_reference:  payment_reference || null,
    created_by_id:      user?.id ?? null,
  }).select().single();

  if (error) throw new Error(error.message);

  // Egreso bancario automático
  if (asset && bank_account_id) {
    try {
      await supabase.from("bank_transactions").insert({
        account_id:     bank_account_id,
        type:           "egreso",
        amount:         purchase_value,
        date:           purchase_date,
        description:    `Compra activo fijo: ${name}`,
        reference:      payment_reference,
        payment_method: "transferencia",
        status:         "confirmado",
      });
    } catch (e) { console.error("Transacción bancaria no creada:", e); }
  }

  // Asiento contable de compra
  if (asset) {
    try {
      await createAssetPurchaseJournalEntry({
        asset_id:       asset.id,
        purchase_date,
        asset_name:     name,
        category,
        purchase_value,
        on_credit:      !bank_account_id,
        user_id:        user?.id,
        user_email:     user?.email,
      });
    } catch (e) { console.error("Asiento no generado:", e); }
  }

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
        <Link href="/erp/activos"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink-900">Registrar Activo Fijo</h1>
          <p className="text-xs text-ink-500">Equipos, inmuebles, vehículos y otros bienes de capital.</p>
        </div>
      </div>

      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4 sm:p-6">
        <form action={saveAsset} className="space-y-5">

          {/* Identificación */}
          <div className="space-y-4">
            <p className="text-xs font-bold text-ink-400 uppercase tracking-wider">Identificación</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-ink-700">Nombre del activo *</label>
                <input name="name" required placeholder="Ej. Unidad dental GNATUS 6000"
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Categoría *</label>
                <select name="category" required
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white">
                  {ASSET_CATEGORIES.map(c => (
                    <option key={c.label} value={c.label}>{c.label} ({c.years} años SRI)</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Descripción</label>
                <input name="description" placeholder="Modelo, serie, características..."
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white" />
              </div>
            </div>
          </div>

          {/* Valores */}
          <div className="border border-lilac-100 rounded-xl p-4 bg-lilac-50/20 space-y-3">
            <p className="text-xs font-bold text-ink-400 uppercase tracking-wider">Valor y Depreciación</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Fecha de compra *</label>
                <input type="date" name="purchase_date" required defaultValue={today}
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Costo de adquisición *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">$</span>
                  <input type="number" name="purchase_value" required min="0.01" step="0.01"
                    className="w-full border border-lilac-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Valor residual</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">$</span>
                  <input type="number" name="salvage_value" min="0" step="0.01" defaultValue="0"
                    className="w-full border border-lilac-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Vida útil (años) *</label>
                <input type="number" name="useful_life_years" required min="1" max="50" defaultValue="10"
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono" />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-ink-700">Método de depreciación</label>
                <select name="depreciation_method"
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white">
                  <option value="linea_recta">Línea Recta (SRI Ecuador)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Proveedor */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-ink-400 uppercase tracking-wider">Proveedor / Factura</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-ink-700">Proveedor</label>
                <input name="supplier_name" placeholder="Nombre del proveedor"
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">RUC proveedor</label>
                <input name="supplier_ruc" maxLength={13} placeholder="0000000000001"
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono" />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <label className="text-xs font-semibold text-ink-700">N° Factura de compra</label>
                <input name="invoice_number" placeholder="001-001-000000001"
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono" />
              </div>
            </div>
          </div>

          {/* Pago */}
          <div className="border border-lilac-100 rounded-xl p-4 bg-lilac-50/20 space-y-3">
            <p className="text-xs font-bold text-ink-400 uppercase tracking-wider">Pago</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Cuenta bancaria de pago</label>
                <select name="bank_account_id"
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white">
                  <option value="">— Crédito / No aplica —</option>
                  {(bankAccounts || []).map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name}{b.account_number ? ` · ${b.account_number}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">N° Referencia / Transferencia</label>
                <input name="payment_reference" placeholder="Comprobante de pago"
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono" />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button type="submit"
              className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-md shadow-lilac-200">
              <Save size={16} /> Registrar activo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
