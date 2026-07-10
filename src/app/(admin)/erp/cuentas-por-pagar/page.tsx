import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CreditCard, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Server Action ──────────────────────────────────────────────────────────

async function recordExpensePayment(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/cuentas-por-pagar");

  const supabase        = createAdminClient();
  const expense_id      = formData.get("expense_id") as string;
  const amount          = r2(Number(formData.get("amount")));
  const payment_date    = formData.get("payment_date") as string;
  const payment_method  = formData.get("payment_method") as string;
  const bank_account_id = (formData.get("bank_account_id") as string) || null;
  const reference       = (formData.get("reference") as string)?.trim() || null;
  const notes           = (formData.get("notes") as string)?.trim() || null;

  if (amount <= 0) throw new Error("El monto debe ser mayor a 0");

  // Obtener gasto y pagos previos
  const [{ data: expense }, { data: prevPayments }] = await Promise.all([
    supabase.from("expenses").select("total, supplier_name, document_number").eq("id", expense_id).single(),
    supabase.from("expense_payments").select("amount").eq("expense_id", expense_id),
  ]);
  if (!expense) throw new Error("Gasto no encontrado");

  // Insertar pago
  await supabase.from("expense_payments").insert({
    expense_id, amount, payment_date, payment_method,
    bank_account_id: bank_account_id || null, reference, notes,
  });

  // Egreso bancario automático
  if (bank_account_id) {
    const pmMap: Record<string, string> = { efectivo: "efectivo", transferencia: "transferencia", cheque: "cheque", tarjeta_debito: "tarjeta_debito", tarjeta_credito: "tarjeta_credito" };
    await supabase.from("bank_transactions").insert({
      account_id: bank_account_id, type: "egreso", amount,
      date: payment_date,
      description: `Pago a proveedor: ${expense.supplier_name}${expense.document_number ? ` · ${expense.document_number}` : ""}`,
      reference, payment_method: pmMap[payment_method] ?? "transferencia",
      expense_id, status: "confirmado",
    }).then(() => {});
  }

  redirect("/erp/cuentas-por-pagar");
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function CuentasPorPagarPage({
  searchParams: searchParamsPromise,
}: { searchParams: Promise<{ pay?: string }> }) {
  await assertPermission("/erp/cuentas-por-pagar");
  const canEdit = await hasWritePermission("/erp/cuentas-por-pagar");

  const searchParams = await searchParamsPromise;
  const supabase = createAdminClient();

  const [{ data: expenses }, { data: allPayments }, { data: bankAccounts }] = await Promise.all([
    supabase.from("expenses")
      .select("id, supplier_name, supplier_ruc, document_number, expense_date, category, total, payment_method, status")
      .eq("payment_method", "credito")
      .eq("status", "registered")
      .order("expense_date", { ascending: true }),
    supabase.from("expense_payments").select("expense_id, amount"),
    supabase.from("bank_accounts").select("id, bank_name, account_number, account_type").eq("is_active", true).order("bank_name"),
  ]);

  // Suma de pagos por gasto
  const paidMap = new Map<string, number>();
  (allPayments || []).forEach(p => {
    paidMap.set(p.expense_id, r2((paidMap.get(p.expense_id) ?? 0) + Number(p.amount)));
  });

  const list = (expenses || [])
    .map(exp => ({
      ...exp,
      total_num: Number(exp.total),
      paid: paidMap.get(exp.id) ?? 0,
      pending: r2(Number(exp.total) - (paidMap.get(exp.id) ?? 0)),
    }))
    .filter(exp => exp.pending > 0); // Solo los que aún tienen saldo

  const totalPendiente = r2(list.reduce((s, e) => s + e.pending, 0));
  const selectedExpense = canEdit && searchParams.pay ? list.find(e => e.id === searchParams.pay) : null;
  const today = new Date().toISOString().split("T")[0];

  const CATEGORY_COLORS: Record<string, string> = {
    "Insumos dentales": "bg-lilac-100 text-lilac-700",
    "Equipos": "bg-blue-100 text-blue-700",
    "Arriendo": "bg-amber-100 text-amber-700",
    "Servicios básicos": "bg-cyan-100 text-cyan-700",
    "Salarios": "bg-green-100 text-green-700",
    "Suministros oficina": "bg-orange-100 text-orange-700",
    "Mantenimiento": "bg-gray-100 text-gray-700",
    "Publicidad": "bg-pink-100 text-pink-700",
    "Otros": "bg-gray-100 text-gray-600",
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
            <CreditCard className="text-red-600" /> Cuentas por Pagar
          </h1>
          <p className="text-sm text-ink-600">Gastos a crédito pendientes de pago a proveedores.</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-ink-500">Total por pagar</span>
          <span className="text-2xl font-bold text-red-700">${fmt(totalPendiente)}</span>
        </div>
      </div>

      {/* Formulario de pago */}
      {selectedExpense && (
        <div className="bg-red-50 border border-red-200 rounded-2xl shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-red-900 mb-1">
            Registrar pago — {selectedExpense.supplier_name}
          </h2>
          <p className="text-sm text-ink-600 mb-4">
            {selectedExpense.document_number && <span>Doc: <strong>{selectedExpense.document_number}</strong> · </span>}
            Pendiente: <strong className="text-red-700">${fmt(selectedExpense.pending)}</strong>
          </p>
          <form action={recordExpensePayment} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input type="hidden" name="expense_id" value={selectedExpense.id} />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Monto a pagar *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">$</span>
                <input type="number" name="amount" required min="0.01" step="0.01"
                  defaultValue={selectedExpense.pending}
                  className="w-full border border-red-300 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white font-mono" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Fecha de pago *</label>
              <input type="date" name="payment_date" required defaultValue={today}
                className="w-full border border-red-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Método *</label>
              <select name="payment_method" required
                className="w-full border border-red-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white">
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                
                
                <option value="tarjeta_credito">Tarjeta Crédito</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Cuenta bancaria origen</label>
              <select name="bank_account_id"
                className="w-full border border-red-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white">
                <option value="">— No registrar en banco —</option>
                {(bankAccounts || []).filter(b => b.account_type !== "caja").map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name}{b.account_number ? ` · ${b.account_number}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">N° Referencia</label>
              <input type="text" name="reference" placeholder="Comprobante, cheque..."
                className="w-full border border-red-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Notas</label>
              <input type="text" name="notes" placeholder="Observaciones..."
                className="w-full border border-red-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white" />
            </div>
            <div className="sm:col-span-3 flex gap-3 pt-1">
              <button type="submit"
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-md">
                <CreditCard size={16} /> Registrar pago
              </button>
              <Link href="/erp/cuentas-por-pagar"
                className="px-4 py-2.5 rounded-xl border border-red-300 text-sm text-red-700 hover:bg-red-100 transition-colors">
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      )}

      {/* Tabla */}
      {list.length === 0 ? (
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-12 text-center">
          <CheckCircle2 size={36} className="text-green-400 mx-auto mb-3" />
          <p className="text-ink-500 font-medium">¡Todo pagado!</p>
          <p className="text-sm text-ink-400 mt-1">No hay gastos a crédito pendientes.</p>
          <p className="text-xs text-ink-400 mt-1">Registra gastos con método "Crédito (por pagar)" para que aparezcan aquí.</p>
        </div>
      ) : (
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-lilac-50 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Gastos pendientes de pago</h2>
            <span className="text-xs text-ink-400">{list.length} proveedores · ${fmt(totalPendiente)} por pagar</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-lilac-50/50 text-xs text-ink-500 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">Proveedor</th>
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-center">Fecha</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Pagado</th>
                  <th className="px-4 py-3 text-right">Pendiente</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  {canEdit && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {list.map(exp => (
                  <tr key={exp.id} className={`transition-colors ${exp.id === searchParams.pay ? "bg-red-50" : "hover:bg-lilac-50/20"}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-900">{exp.supplier_name}</p>
                      {exp.document_number && <p className="text-xs text-ink-400 font-mono">{exp.document_number}</p>}
                      {exp.supplier_ruc && <p className="text-xs text-ink-400 font-mono">{exp.supplier_ruc}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[exp.category] ?? "bg-gray-100 text-gray-600"}`}>
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-ink-500">
                      {new Date(exp.expense_date + "T12:00:00").toLocaleDateString("es-EC")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">${fmt(exp.total_num)}</td>
                    <td className="px-4 py-3 text-right font-mono text-green-600">${fmt(exp.paid)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-red-700">${fmt(exp.pending)}</td>
                    <td className="px-4 py-3 text-center">
                      {exp.paid > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                          <Clock size={10} /> Parcial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                          <AlertCircle size={10} /> Pendiente
                        </span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/erp/cuentas-por-pagar?pay=${exp.id}`}
                          className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                          Pagar
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
