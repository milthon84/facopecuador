import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import { ArrowLeft, TrendingUp, TrendingDown, Building2 } from "lucide-react";
import Link from "next/link";
import NuevoMovimientoBancoModal from "@/components/NuevoMovimientoBancoModal";
import DepositarCajaModal from "@/components/DepositarCajaModal";

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

export default async function BancoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ action?: string }>;
}) {
  await assertPermission("/erp/bancos");
  const canEdit = await hasWritePermission("/erp/bancos");

  const { id } = await params;
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

  const isCajaGeneral = !!(account as any).is_caja_general;
  const bankAccounts  = (allBanks || []) as { id: string; bank_name: string; account_number: string | null }[];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/erp/bancos"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
              <Building2 size={22} className="text-lilac-600" />
              {account.bank_name}
            </h1>
            <p className="text-sm text-ink-500">
              {ACCOUNT_TYPE_LABELS[account.account_type]}
              {account.account_number && ` · ${account.account_number}`}
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            {isCajaGeneral ? (
              <DepositarCajaModal cajaId={id} bankAccounts={bankAccounts} />
            ) : (
              <>
                <NuevoMovimientoBancoModal accountId={id} defaultType="ingreso" categorias={CATEGORIAS_MANUAL} />
                <NuevoMovimientoBancoModal accountId={id} defaultType="egreso" categorias={CATEGORIAS_MANUAL} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-lg">💵</span>
          <p className="text-sm text-blue-800">
            <strong>Caja General</strong> — recibe automáticamente todos los pagos en efectivo de facturas.
            Para mover el dinero a un banco usa el botón <strong>"Depositar en banco"</strong>.
          </p>
        </div>
      )}

      {/* Tabla de movimientos */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
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
    </div>
  );
}
