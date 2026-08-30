import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { assertPermission, assertWritePermission, hasWritePermission, getUserRole } from "@/lib/auth-action";
import { Wallet, Plus, TrendingDown, RefreshCw, ArrowRight, X, FileCheck, ShieldCheck, CheckCircle2, Lock } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;

// ── Server Actions ─────────────────────────────────────────────────────────

async function setupCajaChica(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/caja-chica");
  const supabase = createAdminClient();
  await supabase.from("bank_accounts").insert({
    bank_name: (formData.get("bank_name") as string).trim(),
    account_type: "caja",
    initial_balance: Number(formData.get("initial_balance") || 0),
    is_active: true,
    notes: "Caja chica para gastos menores en efectivo",
  });
  redirect("/erp/caja-chica");
}

async function addCashExpense(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/caja-chica");
  const supabase = createAdminClient();
  await supabase.from("bank_transactions").insert({
    account_id:  formData.get("account_id") as string,
    type:        "egreso",
    amount:      Number(formData.get("amount")),
    date:        formData.get("date") as string,
    description: (formData.get("description") as string).trim(),
    reference:   (formData.get("reference") as string)?.trim() || null,
    payment_method: "efectivo", status: "confirmado",
    origin: "manual", categoria: "Retiro en efectivo",
  });
  redirect("/erp/caja-chica");
}

async function replenishCajaChica(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/caja-chica");
  const supabase = createAdminClient();
  const caja_id = formData.get("caja_id") as string;
  const bank_id = formData.get("bank_id") as string;
  const amount  = Number(formData.get("amount"));
  const date    = formData.get("date") as string;

  const { data: sourceAcc } = await supabase
    .from("bank_accounts")
    .select("account_type")
    .eq("id", bank_id)
    .single();

  const isCashSource = sourceAcc?.account_type === "caja";
  const paymentMethod = isCashSource ? "efectivo" : "transferencia";
  const descriptionEgreso = isCashSource ? "Transferencia a caja chica — Reposición" : "Reposición caja chica";
  const descriptionIngreso = isCashSource ? "Reposición desde Caja General" : "Reposición desde banco";

  await supabase.from("bank_transactions").insert({
    account_id: bank_id, type: "egreso", amount, date,
    description: descriptionEgreso,
    payment_method: paymentMethod, status: "confirmado",
    origin: "manual", categoria: "Reposición caja chica",
  });
  await supabase.from("bank_transactions").insert({
    account_id: caja_id, type: "ingreso", amount, date,
    description: descriptionIngreso,
    payment_method: "efectivo", status: "confirmado",
    origin: "manual", categoria: "Reposición caja chica",
  });
  redirect("/erp/caja-chica");
}

// ── Page ───────────────────────────────────────────────────────────────────

type BankAccount = { id: string; bank_name: string; account_number: string | null; account_type: string; initial_balance: number; is_active: boolean };
type BankTx = { id: string; account_id: string; type: "ingreso" | "egreso"; amount: number; date: string; description: string; reference: string | null; status: string };

export default async function CajaChicaPage({
  searchParams: searchParamsPromise,
}: { searchParams: Promise<{ action?: string }> }) {
  await assertPermission("/erp/caja-chica");
  const canEdit = await hasWritePermission("/erp/caja-chica");
  const userRole = await getUserRole();
  const isContadorOrAdmin = userRole === "admin" || userRole === "contador";

  const searchParams = await searchParamsPromise;
  const supabase = createAdminClient();
  const [{ data: allAccounts }, { data: allTx }] = await Promise.all([
    supabase.from("bank_accounts").select("*").eq("is_active", true).order("bank_name"),
    supabase.from("bank_transactions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }).limit(200),
  ]);

  // Caja Chica: solo cuentas tipo "caja" que NO son Caja General.
  // La Caja General se identifica por is_caja_general=true O por nombre con "efectivo"/"general"
  const esCajaGeneral = (a: any) =>
    a.is_caja_general === true ||
    ["efectivo", "general"].some(k => a.bank_name.toLowerCase().includes(k));

  const cajaAccounts = (allAccounts as BankAccount[] || []).filter(a =>
    a.account_type === "caja" && !esCajaGeneral(a)
  );
  const bankAccounts = (allAccounts as BankAccount[] || []).filter(a => a.account_type !== "caja");
  const cajaGeneral = (allAccounts as BankAccount[] || []).find(esCajaGeneral);

  const sourceAccounts = [
    ...(cajaGeneral ? [{ id: cajaGeneral.id, bank_name: `Caja General — ${cajaGeneral.bank_name}`, account_number: null, account_type: "caja" }] : []),
    ...bankAccounts,
  ];

  const txMap = new Map<string, BankTx[]>();
  (allTx as BankTx[] || []).forEach(tx => {
    if (!txMap.has(tx.account_id)) txMap.set(tx.account_id, []);
    txMap.get(tx.account_id)!.push(tx);
  });

  function calcBalance(account: BankAccount): number {
    const txs = (txMap.get(account.id) || []).filter(t => t.status === "confirmado");
    return r2(account.initial_balance
      + txs.filter(t => t.type === "ingreso").reduce((s, t) => s + t.amount, 0)
      - txs.filter(t => t.type === "egreso").reduce((s, t) => s + t.amount, 0));
  }

  const today  = new Date().toISOString().split("T")[0];
  const action = canEdit ? searchParams.action : undefined; // "gasto" | "reponer"

  // ── Sin caja configurada ─────────────────────────────────────────────────
  if (cajaAccounts.length === 0) {
    return (
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2 mb-6">
          <Wallet className="text-lilac-600" /> Caja Chica
        </h1>
        {canEdit ? (
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-ink-900 mb-4">Configurar caja chica</h2>
            <form action={setupCajaChica} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Nombre *</label>
                <input name="bank_name" required defaultValue="Caja Chica Principal"
                  className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Fondo inicial ($)</label>
                <input type="number" name="initial_balance" min="0" step="0.01" defaultValue="100"
                  className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono" />
              </div>
              <button type="submit"
                className="w-full flex items-center justify-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                <Plus size={16} /> Crear caja chica
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-6 text-center">
            <h2 className="font-semibold text-ink-900 mb-2">No hay Caja Chica configurada</h2>
            <p className="text-sm text-ink-500">Contacta al administrador para configurar el fondo inicial de la Caja Chica.</p>
          </div>
        )}
      </div>
    );
  }

  // ── Vista principal ───────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto">
      {cajaAccounts.map(caja => {
        const balance = calcBalance(caja);
        const txs     = txMap.get(caja.id) || [];
        const isLow   = balance < caja.initial_balance * 0.2;
        const deficit = r2(Math.max(caja.initial_balance - balance, 0));

        return (
          <div key={caja.id}>
            {/* ── Balance + acciones ─────────────────────────────────────── */}
            <div className={`rounded-2xl p-5 mb-4 border shadow-sm ${isLow ? "bg-red-50 border-red-200" : "bg-green-50 border-green-100"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">{caja.bank_name}</p>
                  <p className={`text-4xl font-bold mt-1 tabular-nums ${isLow ? "text-red-700" : "text-green-800"}`}>
                    ${balance.toFixed(2)}
                  </p>
                  {isLow
                    ? <p className="text-xs text-red-600 mt-1 font-semibold">⚠ Saldo bajo · Reponer ${deficit.toFixed(2)}</p>
                    : <p className="text-xs text-green-700 mt-1">Fondo inicial: ${caja.initial_balance.toFixed(2)}</p>
                  }
                </div>

                {/* Botones de acción */}
                {canEdit && (
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <Link href={action === "gasto" ? "/erp/caja-chica" : "/erp/caja-chica?action=gasto"}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        action === "gasto"
                          ? "bg-red-600 text-white shadow-sm"
                          : "bg-white border border-red-300 text-red-700 hover:bg-red-50"
                      }`}>
                      <TrendingDown size={15} />
                      {action === "gasto" ? <X size={13} /> : "Registrar Gasto"}
                    </Link>
                    <Link href={action === "reponer" ? "/erp/caja-chica" : "/erp/caja-chica?action=reponer"}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        action === "reponer"
                          ? "bg-green-600 text-white shadow-sm"
                          : "bg-white border border-green-300 text-green-700 hover:bg-green-50"
                      }`}>
                      <RefreshCw size={15} />
                      {action === "reponer" ? <X size={13} /> : "Reponer Caja"}
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* ── Formulario de gasto ────────────────────────────────────── */}
            {action === "gasto" && (
              <div className="bg-white border border-red-200 rounded-2xl shadow-sm p-5 mb-4">
                <h3 className="font-semibold text-ink-900 mb-3 flex items-center gap-2 text-sm">
                  <TrendingDown size={15} className="text-red-500" /> Registrar gasto en efectivo
                </h3>
                <form action={addCashExpense} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <input type="hidden" name="account_id" value={caja.id} />
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-700">Monto *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">$</span>
                      <input type="number" name="amount" required min="0.01" step="0.01" autoFocus
                        className="w-full border border-red-200 rounded-xl pl-7 pr-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white font-mono" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-700">Fecha *</label>
                    <input type="date" name="date" required defaultValue={today}
                      className="w-full border border-red-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-ink-700">Descripción *</label>
                    <input name="description" required placeholder="Ej. Taxi, suministros, café..."
                      className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white" />
                  </div>
                  <div className="col-span-2 sm:col-span-3 space-y-1">
                    <label className="text-xs font-semibold text-ink-700">Recibo / Referencia</label>
                    <input name="reference" placeholder="Opcional"
                      className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white font-mono" />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex items-end">
                    <button type="submit"
                      className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl font-semibold text-sm transition-colors">
                      <TrendingDown size={14} /> Guardar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Formulario de reposición ───────────────────────────────── */}
            {action === "reponer" && (
              <div className="bg-white border border-green-200 rounded-2xl shadow-sm p-5 mb-4">
                <h3 className="font-semibold text-ink-900 mb-3 flex items-center gap-2 text-sm">
                  <RefreshCw size={15} className="text-green-600" /> Reponer caja chica
                </h3>
                <form action={replenishCajaChica} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <input type="hidden" name="caja_id" value={caja.id} />
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-ink-700">Cuenta de origen *</label>
                    <select name="bank_id" required
                      className="w-full border border-green-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                      <option value="">— Seleccionar cuenta origen —</option>
                      {sourceAccounts.map(b => (
                        <option key={b.id} value={b.id}>{b.bank_name}{b.account_number ? ` · ${b.account_number}` : ""}</option>
                      ))}
                    </select>
                    {sourceAccounts.length === 0 && (
                      <p className="text-[11px] text-amber-600"><a href="/erp/bancos" className="underline">Registra una cuenta</a> primero.</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-700">Monto *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">$</span>
                      <input type="number" name="amount" required min="0.01" step="0.01"
                        defaultValue={deficit > 0 ? deficit : undefined}
                        className="w-full border border-green-200 rounded-xl pl-7 pr-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white font-mono" />
                    </div>
                    {deficit > 0 && <p className="text-[11px] text-ink-400">Déficit: ${deficit.toFixed(2)}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-700">Fecha *</label>
                    <input type="date" name="date" required defaultValue={today}
                      className="w-full border border-green-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" />
                  </div>
                  <div className="col-span-2 sm:col-span-4 flex justify-end">
                    <button type="submit"
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl font-semibold text-sm transition-colors">
                      <RefreshCw size={14} /> Reponer
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Movimientos ───────────────────────────────────────────── */}
            <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-lilac-50 flex items-center justify-between">
                <h3 className="font-semibold text-ink-900 text-sm">Movimientos</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-400">{txs.length} registros</span>
                  <Link href="/erp/bancos" className="text-xs text-lilac-600 hover:underline flex items-center gap-1">
                    Ver cuenta <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
              {txs.length === 0 ? (
                <p className="text-center text-ink-400 text-sm py-10">Sin movimientos aún.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-lilac-50/50 text-xs text-ink-500 uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-2.5 text-left">Fecha</th>
                        <th className="px-4 py-2.5 text-left">Descripción</th>
                        <th className="px-4 py-2.5 text-left">Ref.</th>
                        <th className="px-4 py-2.5 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-lilac-50">
                      {txs.map(tx => (
                        <tr key={tx.id} className="hover:bg-lilac-50/20">
                          <td className="px-4 py-2.5 text-xs text-ink-500 whitespace-nowrap">
                            {new Date(tx.date + "T12:00:00").toLocaleDateString("es-EC")}
                          </td>
                          <td className="px-4 py-2.5 text-ink-800 text-sm">{tx.description}</td>
                          <td className="px-4 py-2.5 text-xs text-ink-400 font-mono">{tx.reference ?? "—"}</td>
                          <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${tx.type === "ingreso" ? "text-green-700" : "text-red-600"}`}>
                            {tx.type === "ingreso" ? "+" : "−"}${tx.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
