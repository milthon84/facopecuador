"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";

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

  const { data: destAccount } = await supabase
    .from("bank_accounts")
    .select("bank_name, account_number, account_type")
    .eq("id", destino_id)
    .maybeSingle();

  let destino_nombre = "cuenta destino";
  if (destAccount) {
    if (destAccount.account_type === "caja") {
      destino_nombre = `Caja Chica — ${destAccount.bank_name}`;
    } else {
      destino_nombre = `${destAccount.bank_name}${destAccount.account_number ? ` · ${destAccount.account_number}` : ""}`;
    }
  }

  const trimmedNotes = notes?.trim();
  const descEgreso  = trimmedNotes ? `Transferencia a ${destino_nombre} — ${trimmedNotes}` : `Transferencia a ${destino_nombre}`;
  const descIngreso = trimmedNotes ? `Transferencia desde Caja General — ${trimmedNotes}` : `Transferencia desde Caja General`;

  // Egreso de Caja General
  const { error: err1 } = await supabase.from("bank_transactions").insert({
    account_id:     caja_id,
    type:           "egreso",
    amount,
    date,
    description:    descEgreso,
    reference:      reference?.trim() || null,
    payment_method: "efectivo",
    status:         "confirmado",
    origin:         "automatico",
  });
  if (err1) throw new Error(err1.message || "Error al registrar egreso de caja general.");

  // Ingreso en destino
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
  if (err2) throw new Error(err2.message || "Error al registrar ingreso en cuenta de destino.");

  revalidatePath("/erp/caja-general");
  revalidatePath("/erp/bancos");
  revalidatePath("/erp/caja-chica");
  return { success: true };
}
