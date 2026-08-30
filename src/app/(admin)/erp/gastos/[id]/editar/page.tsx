import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { assertPermission, assertWritePermission } from "@/lib/auth-action";
import { assertMonthOpen, isMonthClosed } from "@/lib/accounting";
import NuevaCompraForm from "../../nuevo/NuevaCompraForm";

export const dynamic = "force-dynamic";

async function updateExpense(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/gastos");
  const id = formData.get("id") as string;
  const new_expense_date = formData.get("expense_date") as string;

  const supabase = createAdminClient();
  const { data: originalExp } = await supabase.from("expenses").select("expense_date").eq("id", id).single();

  if (originalExp?.expense_date) {
    await assertMonthOpen(originalExp.expense_date);
  }
  await assertMonthOpen(new_expense_date);

  const rawSubtotal = Number(formData.get("subtotal_0") || 0);
  const rawIva      = Number(formData.get("iva_amount") || 0);

  let subtotal0  = rawSubtotal;
  let subtotal15 = 0;
  let ivaAmount  = Math.round(rawIva * 100) / 100;

  if (ivaAmount > 0) {
    subtotal15 = Math.round((ivaAmount / 0.15) * 100) / 100;
    if (rawSubtotal >= subtotal15) {
      subtotal0 = Math.round((rawSubtotal - subtotal15) * 100) / 100;
    } else {
      subtotal15 = rawSubtotal;
      subtotal0 = 0;
    }
  }

  const total = Math.round((rawSubtotal + ivaAmount) * 100) / 100;

  const category          = formData.get("category") as string;
  const payment_method    = formData.get("payment_method") as string;
  const supplier_name     = (formData.get("supplier_name") as string).trim();
  const bank_account_id   = (formData.get("bank_account_id") as string) || null;
  const authorization_number = (formData.get("authorization_number") as string)?.trim() || null;
  let description         = (formData.get("description") as string)?.trim() || null;
  let payment_reference   = (formData.get("payment_reference") as string)?.trim() || null;

  if (payment_method === "tarjeta_credito") {
    const card_type = (formData.get("card_type") as string)?.trim() || "";
    const card_lote = (formData.get("card_lote") as string)?.trim() || "";
    const card_voucher = (formData.get("card_voucher") as string)?.trim() || "";
    payment_reference = `Tarj: ${card_type} | Lote: ${card_lote} | Baucher: ${card_voucher}`;
  }

  const updatePayload: Record<string, any> = {
    supplier_name,
    supplier_ruc:      (formData.get("supplier_ruc") as string)?.trim() || null,
    document_number:   (formData.get("document_number") as string)?.trim() || null,
    authorization_number,
    expense_date:      new_expense_date,
    category,
    description,
    subtotal_0:        subtotal0,
    subtotal_15:       subtotal15,
    iva_amount:        ivaAmount,
    total,
    payment_method,
    bank_account_id:   bank_account_id || null,
    payment_reference: payment_reference || null,
  };

  let { error } = await supabase.from("expenses").update(updatePayload).eq("id", id);

  if (error && (error.message.includes("authorization_number") || error.code === "PGRST204")) {
    delete updatePayload.authorization_number;
    if (authorization_number) {
      updatePayload.description = description ? `${description} | Aut: ${authorization_number}` : `Aut: ${authorization_number}`;
    }
    await supabase.from("expenses").update(updatePayload).eq("id", id);
  }

  redirect(`/erp/gastos/${id}`);
}

export default async function EditarGastoPage({ params }: { params: Promise<{ id: string }> }) {
  await assertPermission("/erp/gastos");
  await assertWritePermission("/erp/gastos");

  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: rawExpense }, { data: allAccounts }, { data: pastExpenses }] = await Promise.all([
    supabase.from("expenses").select("*").eq("id", id).single(),
    supabase.from("bank_accounts").select("id, bank_name, account_number, account_type, notes").eq("is_active", true).order("bank_name"),
    supabase.from("expenses").select("supplier_ruc, supplier_name").not("supplier_ruc", "is", null).not("supplier_name", "is", null).order("created_at", { ascending: false }),
  ]);

  if (!rawExpense) notFound();
  const expense = rawExpense as any;

  const isClosed = await isMonthClosed(expense.expense_date);

  const bankAccounts = (allAccounts || []).filter((a) => a.account_type !== "caja");
  const cajaAccounts = (allAccounts || []).filter((a) => a.account_type === "caja");

  const knownSuppliersMap: Record<string, string> = {};
  const knownSuppliersList: { ruc: string; name: string }[] = [];

  (pastExpenses || []).forEach((exp: any) => {
    const ruc = exp.supplier_ruc?.trim();
    const name = exp.supplier_name?.trim();
    if (ruc && name && !knownSuppliersMap[ruc]) {
      knownSuppliersMap[ruc] = name;
      knownSuppliersList.push({ ruc, name });
    }
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link
          href={`/erp/gastos/${id}`}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink-900">Editar Gasto / Compra</h1>
          <p className="text-xs text-ink-500 font-mono">ID: {id.slice(0, 8)}</p>
        </div>
      </div>

      {isClosed ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Lock size={24} />
          </div>
          <h2 className="text-base font-bold text-amber-900">Período Contable Cerrado</h2>
          <p className="text-xs text-amber-800 leading-relaxed max-w-md mx-auto">
            Este gasto pertenece al período contable <strong className="font-mono">{expense.expense_date.slice(0, 7)}</strong>, el cual ya fue CERRADO. No es posible modificar datos de un mes cerrado.
          </p>
          <div className="pt-2">
            <Link
              href={`/erp/gastos/${id}`}
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs px-4 py-2 rounded-xl font-semibold transition-colors"
            >
              Volver al Detalle del Gasto
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4 sm:p-5">
          <NuevaCompraForm
            today={expense.expense_date}
            bankAccounts={bankAccounts}
            cajaAccounts={cajaAccounts}
            knownSuppliersList={knownSuppliersList}
            initialData={expense}
            saveExpense={updateExpense}
          />
        </div>
      )}
    </div>
  );
}
