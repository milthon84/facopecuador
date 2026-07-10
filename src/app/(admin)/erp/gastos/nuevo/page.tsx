import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createExpenseJournalEntry } from "@/lib/accounting";
import NuevaCompraForm from "./NuevaCompraForm";
import { assertWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

async function saveExpense(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/gastos");
  const supabase   = createAdminClient();
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const subtotal0  = Number(formData.get("subtotal_0")  || 0);
  const subtotal15 = Number(formData.get("subtotal_15") || 0);
  const ivaAmount  = Math.round(subtotal15 * 0.15 * 100) / 100;
  const total      = Math.round((subtotal0 + subtotal15 + ivaAmount) * 100) / 100;

  const category          = formData.get("category") as string;
  const payment_method    = formData.get("payment_method") as string;
  const expense_date      = formData.get("expense_date") as string;
  const supplier_name     = (formData.get("supplier_name") as string).trim();
  const bank_account_id   = (formData.get("bank_account_id") as string) || null;
  let payment_reference = (formData.get("payment_reference") as string)?.trim() || null;

  if (payment_method === "tarjeta_credito") {
    const card_type = (formData.get("card_type") as string)?.trim() || "";
    const card_lote = (formData.get("card_lote") as string)?.trim() || "";
    const card_voucher = (formData.get("card_voucher") as string)?.trim() || "";
    payment_reference = `Tarj: ${card_type} | Lote: ${card_lote} | Baucher: ${card_voucher}`;
  }

  const { data: expense, error: expenseError } = await supabase.from("expenses").insert({
    supplier_name,
    supplier_ruc:      (formData.get("supplier_ruc") as string)?.trim() || null,
    document_number:   (formData.get("document_number") as string)?.trim() || null,
    expense_date,
    category,
    description:       (formData.get("description") as string)?.trim() || null,
    subtotal_0:        subtotal0,
    subtotal_15:       subtotal15,
    iva_amount:        ivaAmount,
    total,
    payment_method,
    bank_account_id:   bank_account_id || null,
    payment_reference: payment_reference || null,
    created_by_id:     user?.id ?? null,
    created_by_email:  user?.email ?? null,
  }).select().single();

  if (expenseError || !expense) throw new Error(expenseError?.message ?? "Error al guardar la compra");

  // Transacción bancaria automática (egreso) — no aplica a crédito
  if (bank_account_id && payment_method !== "credito") {
    try {
      const pmMap: Record<string, string> = {
        efectivo:      "efectivo",
        transferencia: "transferencia",
        tarjeta_credito: "tarjeta_credito",
      };
      await supabase.from("bank_transactions").insert({
        account_id:     bank_account_id,
        type:           "egreso",
        amount:         total,
        date:           expense_date,
        description:    `Compra: ${supplier_name}${category ? ` (${category})` : ""}`,
        reference:      payment_reference,
        payment_method: pmMap[payment_method] ?? "transferencia",
        expense_id:     expense.id,
        status:         "confirmado",
        origin:         "automatico",
      });
    } catch (err) {
      console.error("Transacción bancaria no registrada:", err);
    }
  }

  // Asiento contable automático
  try {
    await createExpenseJournalEntry({
      expense_id: expense.id, expense_date, supplier_name, category,
      payment_method, subtotal_0: subtotal0, subtotal_15: subtotal15,
      iva_amount: ivaAmount, total, user_id: user?.id, user_email: user?.email,
    });
  } catch (err) {
    console.error("Asiento contable no generado:", err);
  }

  redirect("/erp/gastos");
}

export default async function NuevoGastoPage() {
  await assertWritePermission("/erp/gastos");
  const today    = new Date().toISOString().split("T")[0];
  const supabase = createAdminClient();

  const { data: allAccounts } = await supabase
    .from("bank_accounts")
    .select("id, bank_name, account_number, account_type, notes")
    .eq("is_active", true)
    .order("bank_name");

  const bankAccounts = (allAccounts || []).filter(a => a.account_type !== "caja");
  const cajaAccounts = (allAccounts || []).filter(a => a.account_type === "caja");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/erp/gastos"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-ink-900">Registrar Gasto / Compra</h1>
      </div>

      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4 sm:p-5">
        <NuevaCompraForm
          today={today}
          bankAccounts={bankAccounts}
          cajaAccounts={cajaAccounts}
          saveExpense={saveExpense}
        />
      </div>
    </div>
  );
}
