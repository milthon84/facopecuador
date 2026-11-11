"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";
import { createCajaGeneralDepositJournalEntry, assertMonthOpen } from "@/lib/accounting";

export async function transferFromCajaGeneralAction(data: {
  caja_id: string;
  destino_id: string;
  amount: number;
  date: string;
  reference?: string | null;
  notes?: string | null;
}) {
  await assertWritePermission("/erp/caja-general");

  const supabase = createAdminClient();
  const { caja_id, destino_id, amount, date, reference, notes } = data;

  if (amount <= 0 || !destino_id) {
    throw new Error("Monto y cuenta de destino son requeridos.");
  }

  // Validar que el período contable no esté cerrado
  await assertMonthOpen(date);

  const { data: destAccount } = await supabase
    .from("bank_accounts")
    .select("bank_name, account_number, account_type")
    .eq("id", destino_id)
    .maybeSingle();

  if (destAccount?.account_type === "caja") {
    throw new Error(
      "Las reposiciones de caja chica no pueden realizarse desde Caja General. Solo pueden realizarse por transferencia bancaria desde las cuentas de Niagas."
    );
  }

  const destino_nombre = `${destAccount?.bank_name || "cuenta bancaria"}${destAccount?.account_number ? ` · ${destAccount.account_number}` : ""}`;

  const trimmedNotes = notes?.trim();
  const descEgreso  = trimmedNotes ? `Depósito en ${destino_nombre} — ${trimmedNotes}` : `Depósito en ${destino_nombre}`;
  const descIngreso = trimmedNotes ? `Depósito desde Caja General — ${trimmedNotes}` : `Depósito desde Caja General`;

  // Egreso de Caja General
  const { data: txEgreso, error: err1 } = await supabase
    .from("bank_transactions")
    .insert({
      account_id:     caja_id,
      type:           "egreso",
      amount,
      date,
      description:    descEgreso,
      reference:      reference?.trim() || null,
      payment_method: "efectivo",
      status:         "confirmado",
      origin:         "automatico",
    })
    .select("id")
    .single();

  if (err1 || !txEgreso) {
    throw new Error(err1?.message || "Error al registrar egreso de caja general.");
  }

  // Ingreso en cuenta bancaria destino
  const { error: err2 } = await supabase.from("bank_transactions").insert({
    account_id:     destino_id,
    type:           "ingreso",
    amount,
    date,
    description:    descIngreso,
    reference:      reference?.trim() || null,
    payment_method: "efectivo",
    status:         "confirmado",
    origin:         "automatico",
  });
  if (err2) {
    throw new Error(err2.message || "Error al registrar ingreso en cuenta de destino.");
  }

  // Generar Asiento Contable NIIF: Débito a Bancos (1.1.01.03) y Crédito a Caja General (1.1.01.01)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await createCajaGeneralDepositJournalEntry({
      amount,
      date,
      bank_name: destAccount?.bank_name || "Banco",
      account_number: destAccount?.account_number,
      reference: reference?.trim() || null,
      notes: trimmedNotes || null,
      transaction_id: txEgreso.id,
      user_id: user?.id,
      user_email: user?.email,
    });
  } catch (accErr: any) {
    console.error("Error al generar asiento contable de depósito:", accErr);
    throw new Error(`Se registró el movimiento bancario pero ocurrió un error en el asiento contable: ${accErr?.message}`);
  }

  revalidatePath("/erp/caja-general");
  revalidatePath("/erp/bancos");
  revalidatePath("/erp/caja-chica");
  revalidatePath("/erp/contabilidad");
  revalidatePath("/erp/contabilidad/balance");
  return { success: true };
}
