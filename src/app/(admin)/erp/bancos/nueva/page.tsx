import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Save, AlertCircle } from "lucide-react";
import { assertPermission, assertWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

const BANKS_EC = [
  "Banco Pichincha",
  "Banco Guayaquil",
  "Produbanco",
  "Banco del Pacífico",
  "Banco Internacional",
  "Banco Bolivariano",
  "Banco Solidario",
  "Banco General Rumiñahui",
  "Banco del Austro",
  "Cooperativa JEP",
  "Cooperativa 29 de Octubre",
  "Mutualista Pichincha",
];

async function createAccount(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/bancos");

  const account_type = formData.get("account_type") as string;
  const supabase = createAdminClient();

  // Validar que no exista duplicado de tipo caja
  if (account_type === "caja") {
    const { data: existing } = await supabase
      .from("bank_accounts")
      .select("id")
      .eq("account_type", "caja")
      .eq("is_active", true);
    if ((existing || []).length >= 2) {
      throw new Error("Ya existe el máximo de cajas permitidas (Caja General + Caja Chica)");
    }
  }

  await supabase.from("bank_accounts").insert({
    bank_name:       (formData.get("bank_name") as string).trim(),
    account_number:  (formData.get("account_number") as string)?.trim() || null,
    account_type,
    initial_balance: Number(formData.get("initial_balance") || 0),
    notes:           (formData.get("notes") as string)?.trim() || null,
  });

  redirect("/erp/bancos");
}

export default async function NuevaCuentaBancariaPage() {
  await assertWritePermission("/erp/bancos");
  const supabase = createAdminClient();

  // Verificar cuántas cajas existen para mostrar/ocultar la opción
  const { data: cajas } = await supabase
    .from("bank_accounts")
    .select("id, bank_name, is_caja_general")
    .eq("account_type", "caja")
    .eq("is_active", true);

  const cajaCount       = (cajas || []).length;
  const hasCajaGeneral  = (cajas || []).some(c => (c as any).is_caja_general);
  const hasCajaChica    = (cajas || []).some(c => !(c as any).is_caja_general);
  const canAddCaja      = cajaCount < 2; // máximo: 1 Caja General + 1 Caja Chica

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/erp/bancos"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink-900 flex items-center gap-2">
            <Building2 size={20} className="text-lilac-600" />
            Nueva Cuenta Bancaria
          </h1>
          <p className="text-xs text-ink-500">Registra una cuenta bancaria.</p>
        </div>
      </div>

      {/* Info sobre límites de caja */}
      {!canAddCaja && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Ya tienes la <strong>Caja General</strong> y la <strong>Caja Chica</strong> configuradas.
            No se puede crear más cuentas de tipo caja.
          </p>
        </div>
      )}

      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-6">
        <form action={createAccount} className="space-y-4">

          {/* Banco */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink-700">Banco / Entidad *</label>
            <input name="bank_name" required list="bancos-ec"
              placeholder="Selecciona o escribe el banco"
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500" />
            <datalist id="bancos-ec">
              {BANKS_EC.map(b => <option key={b} value={b} />)}
            </datalist>
          </div>

          {/* Tipo + Número */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-ink-700">Tipo de cuenta *</label>
              <select name="account_type"
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500">
                <option value="ahorros">Cuenta de Ahorros</option>
                <option value="corriente">Cuenta Corriente</option>
                {canAddCaja && (
                  <option value="caja">
                    {hasCajaGeneral ? "Caja Chica" : hasCajaChica ? "Caja General" : "Caja"}
                  </option>
                )}
              </select>
              {!canAddCaja && (
                <p className="text-[11px] text-amber-600">Tipo "Caja" no disponible — límite alcanzado</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-ink-700">N° de Cuenta</label>
              <input name="account_number" placeholder="Ej. 2100123456"
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono" />
            </div>
          </div>

          {/* Saldo inicial */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink-700">Saldo inicial</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 text-sm">$</span>
              <input name="initial_balance" type="number" min="0" step="0.01" defaultValue="0"
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono" />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink-700">Notas</label>
            <input name="notes" placeholder="Ej. Cuenta principal de operaciones"
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500" />
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/erp/bancos"
              className="flex-1 flex items-center justify-center px-4 py-2.5 rounded-xl border border-lilac-200 text-ink-700 font-medium hover:bg-lilac-50 transition-colors text-sm">
              Cancelar
            </Link>
            <button type="submit"
              className="flex-1 flex items-center justify-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-md shadow-lilac-200">
              <Save size={16} /> Crear cuenta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
