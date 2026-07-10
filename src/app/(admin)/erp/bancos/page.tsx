import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import { Building2, Plus, Wallet } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ahorros:  "Cuenta de Ahorros",
  corriente: "Cuenta Corriente",
  caja:     "Caja / Efectivo",
};

async function createAccount(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/bancos");

  const supabase = createAdminClient();
  await supabase.from("bank_accounts").insert({
    bank_name:       (formData.get("bank_name") as string).trim(),
    account_number:  (formData.get("account_number") as string)?.trim() || null,
    account_type:    formData.get("account_type") as string,
    initial_balance: Number(formData.get("initial_balance") || 0),
    notes:           (formData.get("notes") as string)?.trim() || null,
  });

  redirect("/erp/bancos");
}

async function toggleAccount(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/bancos");

  const supabase = createAdminClient();
  const id = formData.get("id") as string;
  const is_active = formData.get("is_active") === "true";
  await supabase.from("bank_accounts").update({ is_active: !is_active }).eq("id", id);
  redirect("/erp/bancos");
}

async function setCajaGeneral(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/bancos");

  const supabase = createAdminClient();
  const id = formData.get("id") as string;
  // Desmarcar todas las cajas generales primero
  await supabase.from("bank_accounts").update({ is_caja_general: false }).eq("account_type", "caja");
  // Marcar la seleccionada
  await supabase.from("bank_accounts").update({ is_caja_general: true }).eq("id", id);
  redirect("/erp/bancos");
}

type BankAccount = {
  id: string;
  bank_name: string;
  account_number: string | null;
  account_type: string;
  initial_balance: number;
  is_active: boolean;
  is_caja_general: boolean | null;
  notes: string | null;
};

type BankTransaction = {
  account_id: string;
  type: "ingreso" | "egreso";
  amount: number;
  status: string;
};

export default async function BancosPage() {
  await assertPermission("/erp/bancos");
  const canEdit = await hasWritePermission("/erp/bancos");

  const supabase = createAdminClient();

  const [{ data: accounts }, { data: transactions }] = await Promise.all([
    supabase.from("bank_accounts").select("*").order("bank_name"),
    supabase.from("bank_transactions").select("account_id, type, amount, status").eq("status", "confirmado"),
  ]);

  // Calcular saldo actual por cuenta
  const balanceMap = new Map<string, number>();
  (accounts as BankAccount[] || []).forEach(a => {
    balanceMap.set(a.id, a.initial_balance);
  });
  (transactions as BankTransaction[] || []).forEach(t => {
    const prev = balanceMap.get(t.account_id) ?? 0;
    balanceMap.set(t.account_id, prev + (t.type === "ingreso" ? t.amount : -t.amount));
  });

  const totalBalance = Array.from(balanceMap.values()).reduce((s, v) => s + v, 0);
  const activeAccounts = (accounts as BankAccount[] || []).filter(a => a.is_active);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
          <Building2 className="text-lilac-600" />
          Cuentas Bancarias
        </h1>
        {canEdit && (
          <Link
            href="/erp/bancos/nueva"
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-colors bg-lilac-600 hover:bg-lilac-700 text-white shadow-md shadow-lilac-200">
            <Plus size={16} /> Agregar cuenta
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-lilac-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-lilac-50 flex items-center justify-center shrink-0">
            <Building2 size={20} className="text-lilac-600" />
          </div>
          <div>
            <div className="text-xs text-ink-500">Cuentas activas</div>
            <div className="text-xl font-bold text-ink-900">{activeAccounts.length}</div>
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl p-4 border border-lilac-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <Wallet size={20} className="text-green-600" />
          </div>
          <div>
            <div className="text-xs text-ink-500">Saldo total</div>
            <div className={`text-xl font-bold ${totalBalance >= 0 ? "text-green-700" : "text-red-600"}`}>
              ${totalBalance.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Lista de cuentas */}
      {(accounts as BankAccount[] || []).length === 0 ? (
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-12 text-center mb-6">
          <Building2 size={32} className="text-lilac-300 mx-auto mb-3" />
          <p className="text-ink-500 font-medium">Sin cuentas bancarias registradas</p>
          {canEdit && <p className="text-sm text-ink-400 mt-1">Agrega tu primera cuenta abajo.</p>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {(accounts as BankAccount[]).map(account => {
            const balance = balanceMap.get(account.id) ?? account.initial_balance;
            return (
              <div key={account.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${!account.is_active ? "opacity-60" : "border-lilac-100"}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-ink-900 flex items-center gap-2">
                        {account.bank_name}
                        {account.is_caja_general && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-semibold">
                            💵 Caja General
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-ink-400 mt-0.5">
                        {ACCOUNT_TYPE_LABELS[account.account_type]}
                        {account.account_number && ` · ${account.account_number}`}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${account.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {account.is_active ? "Activa" : "Inactiva"}
                    </span>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-ink-400 mb-0.5">Saldo actual</p>
                      <p className={`text-2xl font-bold ${balance >= 0 ? "text-green-700" : "text-red-600"}`}>
                        ${balance.toFixed(2)}
                      </p>
                      <p className="text-[11px] text-ink-400 mt-0.5">
                        Saldo inicial: ${account.initial_balance.toFixed(2)}
                      </p>
                    </div>
                    <Link
                      href={`/erp/bancos/${account.id}`}
                      className="flex items-center gap-1.5 text-xs bg-lilac-600 hover:bg-lilac-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      Ver movimientos
                    </Link>
                  </div>
                </div>

                <div className="px-5 py-2.5 bg-lilac-50/40 border-t border-lilac-100 flex items-center justify-between gap-2">
                  {account.notes && <p className="text-xs text-ink-400 truncate mr-2">{account.notes}</p>}
                  {canEdit && (
                    <div className="ml-auto flex items-center gap-3">
                      {/* Marcar como Caja General (solo para cuentas tipo caja) */}
                      {account.account_type === "caja" && !account.is_caja_general && (
                        <form action={setCajaGeneral}>
                          <input type="hidden" name="id" value={account.id} />
                          <button type="submit" className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
                            Marcar como Caja General
                          </button>
                        </form>
                      )}
                      <form action={toggleAccount}>
                        <input type="hidden" name="id" value={account.id} />
                        <input type="hidden" name="is_active" value={String(account.is_active)} />
                        <button type="submit" className="text-xs text-ink-400 hover:text-ink-600 transition-colors">
                          {account.is_active ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
