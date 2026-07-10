import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Tag, CreditCard, FileText, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

async function voidExpense(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const supabase = createAdminClient();
  await supabase.from("expenses").update({ status: "void" }).eq("id", id);
  redirect("/erp/gastos");
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo:      "Efectivo",
  transferencia: "Transferencia",
  tarjeta:       "Tarjeta",
  tarjeta_credito: "Tarjeta",
  credito:       "Crédito (por pagar)",
};

export default async function GastoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: rawExpense } = await supabase
    .from("expenses")
    .select("*, bank_accounts(bank_name, account_number, notes)")
    .eq("id", id)
    .single();
  if (!rawExpense) notFound();
  const expense = rawExpense as any;

  const dateStr = new Date(expense.expense_date + "T12:00:00").toLocaleDateString("es-EC", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/erp/gastos"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-ink-900 truncate">{expense.supplier_name}</h1>
          <p className="text-xs text-ink-500 capitalize mt-0.5">{dateStr}</p>
        </div>
        {expense.status === "void" && (
          <span className="text-xs font-bold bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-full">Anulado</span>
        )}
      </div>

      <div className="space-y-4">

        {/* Info principal */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5 space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[11px] text-ink-400 uppercase tracking-wide">Proveedor / Beneficiario</span>
              <p className="text-sm font-medium text-ink-900 mt-0.5">{expense.supplier_name}</p>
            </div>
            {expense.supplier_ruc && (
              <div>
                <span className="text-[11px] text-ink-400 uppercase tracking-wide">RUC / Cédula</span>
                <p className="text-sm font-mono text-ink-900 mt-0.5">{expense.supplier_ruc}</p>
              </div>
            )}
            {expense.document_number && (
              <div>
                <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
                  <FileText size={10} /> N° Comprobante
                </span>
                <p className="text-sm font-mono text-ink-900 mt-0.5">{expense.document_number}</p>
              </div>
            )}
            <div>
              <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
                <Calendar size={10} /> Fecha
              </span>
              <p className="text-sm text-ink-900 mt-0.5">
                {new Date(expense.expense_date + "T12:00:00").toLocaleDateString("es-EC")}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
                <Tag size={10} /> Categoría
              </span>
              <p className="text-sm text-ink-900 mt-0.5">{expense.category}</p>
            </div>
            <div>
              <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
                <CreditCard size={10} /> Forma de pago
              </span>
              <p className="text-sm text-ink-900 mt-0.5">
                {PAYMENT_LABELS[expense.payment_method] ?? expense.payment_method}
                {expense.bank_accounts && (
                  <span className="block text-xs text-ink-500 mt-0.5">
                    {expense.bank_accounts.bank_name}
                    {expense.bank_accounts.account_number ? ` · ${expense.bank_accounts.account_number}` : ""}
                  </span>
                )}
              </p>
            </div>
            {expense.payment_reference && (
              <div className="col-span-2">
                <span className="text-[11px] text-ink-400 uppercase tracking-wide">Referencia / Detalles de Pago</span>
                <p className="text-sm font-mono text-ink-800 mt-0.5">{expense.payment_reference}</p>
              </div>
            )}
          </div>

          {expense.description && (
            <div>
              <span className="text-[11px] text-ink-400 uppercase tracking-wide">Descripción</span>
              <p className="text-sm text-ink-800 mt-0.5">{expense.description}</p>
            </div>
          )}

          {expense.notes && (
            <div className="bg-lilac-50 border border-lilac-100 rounded-xl p-3">
              <span className="text-[11px] text-lilac-600 uppercase tracking-wide font-semibold">Notas</span>
              <p className="text-sm text-ink-700 mt-0.5">{expense.notes}</p>
            </div>
          )}
        </div>

        {/* Totales */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5">
          <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Resumen de montos</p>
          <div className="space-y-2 text-sm">
            {Number(expense.subtotal_0) > 0 && (
              <div className="flex justify-between text-ink-600">
                <span>Subtotal IVA 0%</span>
                <span className="font-medium">${Number(expense.subtotal_0).toFixed(2)}</span>
              </div>
            )}
            {Number(expense.subtotal_15) > 0 && (
              <div className="flex justify-between text-ink-600">
                <span>Subtotal base IVA 15%</span>
                <span className="font-medium">${Number(expense.subtotal_15).toFixed(2)}</span>
              </div>
            )}
            {Number(expense.iva_amount) > 0 && (
              <div className="flex justify-between text-ink-600">
                <span>IVA 15%</span>
                <span className="font-medium">${Number(expense.iva_amount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-ink-900 border-t border-lilac-100 pt-2 mt-1">
              <span>TOTAL</span>
              <span className="text-red-600">${Number(expense.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Anular */}
        {expense.status !== "void" && (
          <form action={voidExpense}>
            <input type="hidden" name="id" value={expense.id} />
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 text-sm text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2.5 rounded-xl transition-colors font-medium"
            >
              <Trash2 size={15} /> Anular gasto
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
