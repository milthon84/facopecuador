import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import { ArrowLeft, Plus, TrendingUp, TrendingDown, Building2 } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAYMENT_LABELS: Record<string, string> = {
  efectivo:        "Efectivo",
  transferencia:   "Transferencia",
  cheque:          "Cheque",
  tarjeta_debito:  "Tarjeta Débito",
  tarjeta_credito: "Tarjeta Crédito",
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ahorros:  "Ahorros",
  corriente: "Corriente",
  caja:     "Caja",
};

async function addTransaction(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/bancos");

  const account_id     = formData.get("account_id") as string;
  const type           = formData.get("type") as string;
  const amount         = Number(formData.get("amount"));
  const date           = formData.get("date") as string;
  const categoria      = formData.get("categoria") as string;
  const description    = (formData.get("description") as string)?.trim() || categoria;
  const reference      = (formData.get("reference") as string)?.trim() || null;
  const payment_method = formData.get("payment_method") as string;
  const status         = formData.get("status") as string;

  if (!categoria || amount <= 0) throw new Error("Datos inválidos");

  const supabase = createAdminClient();
  await supabase.from("bank_transactions").insert({
    account_id, type, amount, date,
    description: description || categoria,
    reference, payment_method, status,
    origin: "manual",
    categoria,
  });

  redirect(`/erp/bancos/${account_id}`);
}

const CATEGORIAS_MANUAL = [
  "Comisión bancaria",
  "Ajuste de saldo",
  "Transferencia interna",
  "Reposición caja chica",
  "Depósito en efectivo",
  "Retiro en efectivo",
  "Pago a proveedor",
  "Cobro a cliente",
  "Otros",
];

type Transaction = {
  id: string;
  type: "ingreso" | "egreso";
  amount: number;
  date: string;
  description: string;
  reference: string | null;
  payment_method: string;
  status: string;
  origin: string | null;
  categoria: string | null;
  invoice_id: string | null;
  expense_id: string | null;
  invoices: { invoice_number: string } | null;
  expenses: { supplier_name: string; document_number: string | null } | null;
};

async function transferToBankAction(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/bancos");

  const supabase    = createAdminClient();
  const caja_id     = formData.get("caja_id") as string;
  const bank_id     = formData.get("bank_id") as string;
  const amount      = Number(formData.get("amount"));
  const date        = formData.get("date") as string;
  const reference   = (formData.get("reference") as string)?.trim() || null;

  if (amount <= 0) throw new Error("Monto inválido");

  await supabase.from("bank_transactions").insert({
    account_id: caja_id, type: "egreso", amount, date,
    description: "Depósito en banco desde Caja General",
    reference, payment_method: "transferencia",
    status: "confirmado", origin: "automatico",
  });
  await supabase.from("bank_transactions").insert({
    account_id: bank_id, type: "ingreso", amount, date,
    description: "Depósito desde Caja General",
    reference, payment_method: "transferencia",
    status: "confirmado", origin: "automatico",
  });

  redirect(`/erp/bancos/${caja_id}`);
}

export default async function BancoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  await assertPermission("/erp/bancos");
  const canEdit = await hasWritePermission("/erp/bancos");

  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const showForm = canEdit && resolvedSearchParams.action === "manual";
  const showDepositForm = canEdit && resolvedSearchParams.action === "depositar";
  const supabase = createAdminClient();

  const [{ data: account }, { data: rawTransactions }, { data: allBanks }] = await Promise.all([
    supabase.from("bank_accounts").select("*").eq("id", id).single(),
    supabase.from("bank_transactions")
      .select("*, invoices(invoice_number), expenses(supplier_name, document_number)")
      .eq("account_id", id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("bank_accounts")
      .select("id, bank_name, account_number")
      .eq("is_active", true)
      .neq("account_type", "caja")
      .order("bank_name"),
  ]);

  if (!account) notFound();

  const transactions = (rawTransactions as Transaction[]) || [];

  // Calcular saldo actual
  const confirmedTxs = transactions.filter(t => t.status === "confirmado");
  const totalIngresos = confirmedTxs.filter(t => t.type === "ingreso").reduce((s, t) => s + t.amount, 0);
  const totalEgresos  = confirmedTxs.filter(t => t.type === "egreso").reduce((s, t) => s + t.amount, 0);
  const balance = account.initial_balance + totalIngresos - totalEgresos;

  const today         = new Date().toISOString().split("T")[0];
  const isCajaGeneral = !!(account as any).is_caja_general;
  const bankAccounts  = (allBanks || []) as { id: string; bank_name: string; account_number: string | null }[];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/erp/bancos"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
            <Building2 size={22} className="text-lilac-600" />
            {account.bank_name}
          </h1>
          <p className="text-sm text-ink-500">
            {ACCOUNT_TYPE_LABELS[account.account_type]}
            {account.account_number && ` · ${account.account_number}`}
          </p>
        </div>
        {canEdit && (isCajaGeneral ? (
          /* Caja General: solo permite depositar en banco */
          <Link
            href={showForm || showDepositForm ? `/erp/bancos/${id}` : `/erp/bancos/${id}?action=depositar`}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-colors shrink-0 ${
              showDepositForm
                ? "bg-ink-100 text-ink-700 border border-ink-200"
                : "bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200"
            }`}>
            <Plus size={16} />
            {showDepositForm ? "Cancelar" : "Depositar en banco"}
          </Link>
        ) : (
          /* Otras cuentas: movimiento manual */
          <Link
            href={showForm || showDepositForm ? `/erp/bancos/${id}` : `/erp/bancos/${id}?action=manual`}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-colors shrink-0 ${
              showForm
                ? "bg-ink-100 text-ink-700 border border-ink-200 hover:bg-ink-200"
                : "bg-lilac-600 hover:bg-lilac-700 text-white shadow-md shadow-lilac-200"
            }`}>
            <Plus size={16} />
            {showForm ? "Cancelar" : "Movimiento manual"}
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-lilac-100 shadow-sm">
          <p className="text-xs text-ink-500 mb-1">Saldo actual</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? "text-green-700" : "text-red-600"}`}>
            ${balance.toFixed(2)}
          </p>
        </div>
        <div className="bg-green-50 rounded-2xl p-4 border border-green-100 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={14} className="text-green-600" />
            <p className="text-xs text-green-700 font-medium">Total ingresos</p>
          </div>
          <p className="text-xl font-bold text-green-700">${totalIngresos.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-4 border border-red-100 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown size={14} className="text-red-600" />
            <p className="text-xs text-red-700 font-medium">Total egresos</p>
          </div>
          <p className="text-xl font-bold text-red-600">${totalEgresos.toFixed(2)}</p>
        </div>
      </div>

      {/* Banner informativo Caja General */}
      {isCajaGeneral && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <span className="text-lg">💵</span>
          <p className="text-sm text-blue-800">
            <strong>Caja General</strong> — recibe automáticamente todos los pagos en efectivo de facturas.
            Para mover el dinero a un banco usa el botón <strong>"Depositar en banco"</strong>.
          </p>
        </div>
      )}

      {/* Formulario: Depositar en banco (solo Caja General) */}
      {isCajaGeneral && showDepositForm && (
        <div className="bg-white border border-green-200 rounded-2xl shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-ink-900 mb-4 flex items-center gap-2 text-sm">
            <TrendingUp size={16} className="text-green-600" />
            Depositar efectivo en cuenta bancaria
          </h2>
          <form action={transferToBankAction} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input type="hidden" name="caja_id" value={account.id} />
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-semibold text-ink-700">Cuenta bancaria destino *</label>
              <select name="bank_id" required
                className="w-full border border-green-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                <option value="">— Seleccionar banco —</option>
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name}{b.account_number ? ` · ${b.account_number}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Monto *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">$</span>
                <input name="amount" type="number" required min="0.01" step="0.01"
                  className="w-full border border-green-200 rounded-xl pl-7 pr-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white font-mono" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Fecha *</label>
              <input name="date" type="date" required defaultValue={today}
                className="w-full border border-green-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" />
            </div>
            <div className="col-span-2 sm:col-span-3 space-y-1">
              <label className="text-xs font-semibold text-ink-700">N° Referencia / Comprobante</label>
              <input name="reference" placeholder="N° depósito, comprobante..."
                className="w-full border border-green-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white font-mono" />
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-end">
              <button type="submit"
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl font-semibold text-sm transition-colors">
                <TrendingUp size={14} /> Depositar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla de movimientos */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-lilac-50 flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">Movimientos</h2>
          <span className="text-xs text-ink-400">{transactions.length} registros</span>
        </div>

        {transactions.length === 0 ? (
          <div className="p-10 text-center text-ink-400 text-sm">Sin movimientos aún.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-lilac-50/50 text-xs text-ink-500 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Descripción / Motivo</th>
                  <th className="px-4 py-3 text-left">Origen</th>
                  <th className="px-4 py-3 text-left">Método</th>
                  <th className="px-4 py-3 text-left">Referencia</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {transactions.map(tx => {
                  const isAuto = tx.origin === "automatico" || (!tx.origin && (tx.invoice_id || tx.expense_id));
                  return (
                  <tr key={tx.id} className="hover:bg-lilac-50/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">
                      {new Date(tx.date + "T12:00:00").toLocaleDateString("es-EC")}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-800 leading-tight text-sm">{tx.description}</p>
                      {tx.categoria && !tx.invoices && !tx.expenses && (
                        <span className="text-[11px] text-ink-400">{tx.categoria}</span>
                      )}
                      {tx.invoices && (
                        <Link href={`/erp/facturacion/${tx.invoice_id}`}
                          className="text-[11px] text-lilac-600 hover:underline">
                          Factura {tx.invoices.invoice_number}
                        </Link>
                      )}
                      {tx.expenses && (
                        <Link href={`/erp/gastos/${tx.expense_id}`}
                          className="text-[11px] text-red-500 hover:underline">
                          Compra: {tx.expenses.supplier_name}
                          {tx.expenses.document_number && ` · ${tx.expenses.document_number}`}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        isAuto
                          ? "bg-lilac-50 text-lilac-700 border-lilac-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {isAuto ? "⚡ Automático" : "✏ Manual"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">
                      {PAYMENT_LABELS[tx.payment_method] ?? tx.payment_method}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-400 font-mono">
                      {tx.reference ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        tx.status === "confirmado"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {tx.status === "confirmado" ? "Confirmado" : "Pendiente"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      <span className={tx.type === "ingreso" ? "text-green-700" : "text-red-600"}>
                        {tx.type === "ingreso" ? "+" : "−"}${tx.amount.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Registrar movimiento manual — solo visible con ?action=manual */}
      {showForm && <div className="bg-white border border-lilac-200 rounded-2xl shadow-sm p-5 mb-6">
        <div className="flex items-start gap-3 mb-4 pb-3 border-b border-lilac-50">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Plus size={18} className="text-amber-700" />
          </div>
          <div>
            <h2 className="font-semibold text-ink-900 flex items-center gap-2">
              Registrar movimiento manual
              <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">✏ Manual</span>
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              Úsalo para ajustes, comisiones u operaciones <strong>no vinculadas a facturas ni compras</strong>.
              Los movimientos automáticos se generan solos al emitir facturas o registrar compras.
            </p>
          </div>
        </div>

        <form action={addTransaction} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input type="hidden" name="account_id" value={account.id} />

          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink-700">Tipo *</label>
            <select name="type" required
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500">
              <option value="ingreso">Ingreso (depósito)</option>
              <option value="egreso">Egreso (pago)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink-700">Categoría / Motivo *</label>
            <select name="categoria" required
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500">
              <option value="">— Seleccionar motivo —</option>
              {CATEGORIAS_MANUAL.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink-700">Monto *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 text-sm">$</span>
              <input name="amount" type="number" min="0.01" step="0.01" required
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink-700">Fecha *</label>
            <input name="date" type="date" required defaultValue={today}
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink-700">Método de pago *</label>
            <select name="payment_method" required
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500">
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              
              
              <option value="tarjeta_credito">Tarjeta Crédito</option>
            </select>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="text-sm font-semibold text-ink-700">Descripción adicional</label>
            <input name="description" placeholder="Ej. Comisión enero 2026, detalle adicional..."
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink-700">Referencia</label>
            <input name="reference" placeholder="N° cheque, comprobante..."
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink-700">Estado</label>
            <select name="status"
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500">
              <option value="confirmado">Confirmado</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>

          <div className="sm:col-span-2 flex justify-end pt-2">
            <button type="submit"
              className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-md shadow-lilac-200">
              <Plus size={16} /> Registrar movimiento
            </button>
          </div>
        </form>
      </div>}
    </div>
  );
}
