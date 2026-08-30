import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, CheckCircle2, Lock, Wallet } from "lucide-react";
import { assertPermission, assertWritePermission, getUserRole } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;

async function processLiquidation(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/contabilidad");
  const role = await getUserRole();
  if (role !== "admin" && role !== "contador") {
    throw new Error("Solo el Contador o Administrador tienen permisos para procesar la Liquidación de Caja Chica.");
  }

  const supabase = createAdminClient();
  const caja_id = formData.get("caja_id") as string;
  const bank_id = formData.get("bank_id") as string;
  const amount  = Number(formData.get("amount"));
  const date    = formData.get("date") as string;
  const liquidation_code = formData.get("liquidation_code") as string;

  const { data: sourceAcc } = await supabase
    .from("bank_accounts")
    .select("account_type")
    .eq("id", bank_id)
    .single();

  const isCashSource = sourceAcc?.account_type === "caja";
  const paymentMethod = isCashSource ? "efectivo" : "transferencia";

  // 1. Desembolso/Reposición en cuenta origen
  await supabase.from("bank_transactions").insert({
    account_id: bank_id,
    type: "egreso",
    amount,
    date,
    description: `Reposición por Liquidación ${liquidation_code}`,
    payment_method: paymentMethod,
    status: "confirmado",
    origin: "manual",
    categoria: "Liquidación Caja Chica",
  });

  // 2. Ingreso/Restitución de dinero en la Caja Chica
  await supabase.from("bank_transactions").insert({
    account_id: caja_id,
    type: "ingreso",
    amount,
    date,
    description: `Restitución de Fondo — ${liquidation_code}`,
    payment_method: "efectivo",
    status: "confirmado",
    origin: "manual",
    categoria: "Liquidación Caja Chica",
    reference: liquidation_code,
  });

  redirect("/erp/contabilidad/caja-chica-liquidaciones");
}

async function cancelPettyCashFund(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/contabilidad");
  const role = await getUserRole();
  if (role !== "admin" && role !== "contador") {
    throw new Error("Solo el Contador o Administrador tienen permisos para cancelar el Fondo de Caja Chica.");
  }

  const supabase = createAdminClient();
  const caja_id = formData.get("caja_id") as string;
  const destination_account_id = formData.get("destination_account_id") as string;
  const remaining_balance = Number(formData.get("remaining_balance") || 0);
  const date = formData.get("date") as string;

  if (remaining_balance > 0 && destination_account_id) {
    await supabase.from("bank_transactions").insert({
      account_id: caja_id,
      type: "egreso",
      amount: remaining_balance,
      date,
      description: "Devolución de saldo por Cancelación de Fondo de Caja Chica",
      payment_method: "efectivo",
      status: "confirmado",
      origin: "manual",
      categoria: "Cierre Caja Chica",
    });

    await supabase.from("bank_transactions").insert({
      account_id: destination_account_id,
      type: "ingreso",
      amount: remaining_balance,
      date,
      description: "Ingreso por Cancelación de Fondo de Caja Chica",
      payment_method: "efectivo",
      status: "confirmado",
      origin: "manual",
      categoria: "Cierre Caja Chica",
    });
  }

  await supabase.from("bank_accounts").update({ is_active: false }).eq("id", caja_id);
  redirect("/erp/contabilidad/caja-chica-liquidaciones");
}

type BankAccount = { id: string; bank_name: string; account_number: string | null; account_type: string; initial_balance: number; is_active: boolean };
type BankTx = { id: string; account_id: string; type: "ingreso" | "egreso"; amount: number; date: string; description: string; reference: string | null; status: string };

export default async function CajaChicaLiquidacionesPage() {
  await assertPermission("/erp/contabilidad");
  const userRole = await getUserRole();
  if (userRole !== "admin" && userRole !== "contador") {
    throw new Error("Acceso no autorizado: La Liquidación de Caja Chica es exclusiva para el rol de Contador o Administrador.");
  }

  const supabase = createAdminClient();
  const [{ data: allAccounts }, { data: allTx }] = await Promise.all([
    supabase.from("bank_accounts").select("*").eq("is_active", true).order("bank_name"),
    supabase.from("bank_transactions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }).limit(300),
  ]);

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

  const today = new Date().toISOString().split("T")[0];
  const liquidationCode = `LQD-${today.replace(/-/g, "")}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/erp/contabilidad"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink-900 flex items-center gap-2">
            <ShieldCheck className="text-purple-600" size={22} /> Liquidación y Rendición de Caja Chica
          </h1>
          <p className="text-xs text-ink-500">Módulo exclusivo de Contabilidad para rendición de cuentas, legalización tributaria y restitución de fondos</p>
        </div>
      </div>

      {cajaAccounts.length === 0 ? (
        <div className="bg-white border border-lilac-100 rounded-2xl p-8 text-center space-y-2 shadow-sm">
          <Wallet size={32} className="text-lilac-400 mx-auto" />
          <h2 className="text-base font-bold text-ink-900">No hay Fondos de Caja Chica Activos</h2>
          <p className="text-xs text-ink-500 max-w-sm mx-auto">
            Actualmente no existen fondos fijos de caja chica activos para liquidar o rendir cuentas.
          </p>
        </div>
      ) : (
        cajaAccounts.map(caja => {
          const balance = calcBalance(caja);
          const txs = txMap.get(caja.id) || [];
          const unliquidatedEgresoTxs = txs.filter(t => t.type === "egreso" && t.status === "confirmado");
          const totalEgresoLiquidar = r2(unliquidatedEgresoTxs.reduce((s, t) => s + t.amount, 0));
          const effectiveCashRemaining = r2(balance);

          return (
            <div key={caja.id} className="bg-white border border-purple-200 rounded-2xl shadow-md p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-purple-100 pb-4">
                <div>
                  <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Fondo Auditado</span>
                  <h2 className="text-lg font-bold text-ink-900">{caja.bank_name}</h2>
                </div>
                <span className="text-xs font-mono font-bold bg-purple-50 text-purple-800 border border-purple-200 px-3 py-1 rounded-full">
                  {liquidationCode}
                </span>
              </div>

              {/* Resumen Financiero */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-purple-50/50 border border-purple-100 rounded-xl p-4 text-xs">
                <div>
                  <span className="text-ink-500 block mb-0.5">Fondo Fijo Asignado</span>
                  <span className="text-sm font-bold font-mono text-ink-900">${caja.initial_balance.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-ink-500 block mb-0.5">(-) Comprobantes Rendidos</span>
                  <span className="text-sm font-bold font-mono text-red-600">${totalEgresoLiquidar.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-ink-500 block mb-0.5">(=) Efectivo Físico en Caja</span>
                  <span className="text-sm font-bold font-mono text-green-700">${effectiveCashRemaining.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-purple-800 font-bold block mb-0.5">Monto a Restituir / Reponer</span>
                  <span className="text-base font-bold font-mono text-purple-700">
                    ${(totalEgresoLiquidar > 0 ? totalEgresoLiquidar : caja.initial_balance).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Tabla de comprobantes presentados */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-ink-700 uppercase tracking-wide">
                  Documentación Tributaria y Comprobantes a Legalizar ({unliquidatedEgresoTxs.length})
                </h3>
                {unliquidatedEgresoTxs.length === 0 ? (
                  <p className="text-xs text-ink-400 italic py-2">No se registran comprobantes pendientes de rendimiento en este ciclo.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto border border-lilac-100 rounded-xl divide-y divide-lilac-50 text-xs">
                    {unliquidatedEgresoTxs.map((t) => (
                      <div key={t.id} className="p-3 flex items-center justify-between hover:bg-lilac-50/40">
                        <div>
                          <span className="font-semibold text-ink-900">{t.description}</span>
                          <span className="block text-[11px] text-ink-400">
                            {new Date(t.date + "T12:00:00").toLocaleDateString("es-EC")} {t.reference ? `· Recibo/Ref: ${t.reference}` : ""}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-red-600">-${t.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Opciones de Aprobación de Liquidación */}
              <div className="pt-4 border-t border-purple-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Opción A: Restituir Dinero */}
                <form action={processLiquidation} className="bg-green-50/60 border border-green-200 rounded-xl p-4 space-y-3">
                  <input type="hidden" name="caja_id" value={caja.id} />
                  <input type="hidden" name="amount" value={totalEgresoLiquidar > 0 ? totalEgresoLiquidar : caja.initial_balance} />
                  <input type="hidden" name="date" value={today} />
                  <input type="hidden" name="liquidation_code" value={liquidationCode} />

                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-600" />
                    <span className="text-xs font-bold text-green-900">Opción A: Restituir Dinero (Reponer Fondo)</span>
                  </div>
                  <p className="text-[11px] text-green-800 leading-relaxed">
                    Legaliza los comprobantes auditados, restituye los <strong>${(totalEgresoLiquidar > 0 ? totalEgresoLiquidar : caja.initial_balance).toFixed(2)}</strong> desde la cuenta seleccionada y restaura el fondo fijo.
                  </p>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-green-900">Cuenta de origen de fondos *</label>
                    <select name="bank_id" required className="w-full border border-green-300 rounded-xl px-2.5 py-1.5 text-xs bg-white">
                      <option value="">— Seleccionar cuenta origen —</option>
                      {sourceAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name}{b.account_number ? ` · ${b.account_number}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-xs py-2 rounded-xl transition-colors shadow-xs">
                    Aprobar Liquidación y Restituir Dinero
                  </button>
                </form>

                {/* Opción B: Cancelar y Cerrar Fondo */}
                <form action={cancelPettyCashFund} className="bg-red-50/60 border border-red-200 rounded-xl p-4 space-y-3">
                  <input type="hidden" name="caja_id" value={caja.id} />
                  <input type="hidden" name="remaining_balance" value={effectiveCashRemaining} />
                  <input type="hidden" name="date" value={today} />

                  <div className="flex items-center gap-2">
                    <Lock size={16} className="text-red-600" />
                    <span className="text-xs font-bold text-red-900">Opción B: Cancelar y Cerrar Fondo</span>
                  </div>
                  <p className="text-[11px] text-red-800 leading-relaxed">
                    Legaliza los comprobantes, devuelve el saldo sobrante de <strong>${effectiveCashRemaining.toFixed(2)}</strong> a la cuenta asignada y cierra formalmente la Caja Chica.
                  </p>

                  {effectiveCashRemaining > 0 && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-red-900">Cuenta para devolución del sobrante *</label>
                      <select name="destination_account_id" required className="w-full border border-red-300 rounded-xl px-2.5 py-1.5 text-xs bg-white">
                        <option value="">— Seleccionar cuenta destino —</option>
                        {sourceAccounts.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.bank_name}{b.account_number ? ` · ${b.account_number}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-2 rounded-xl transition-colors shadow-xs">
                    Aprobar Liquidación y Cancelar Fondo
                  </button>
                </form>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
