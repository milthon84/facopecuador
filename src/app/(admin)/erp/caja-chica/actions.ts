"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";

export async function setupCajaChicaAction(data: {
  bank_name: string;
  initial_balance: number;
}) {
  await assertWritePermission("/erp/caja-chica");

  const bank_name = data.bank_name?.trim();
  if (!bank_name) throw new Error("El nombre de la caja chica es obligatorio.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("bank_accounts").insert({
    bank_name,
    account_type: "caja",
    initial_balance: Number(data.initial_balance || 0),
    is_active: true,
    notes: "Caja chica para gastos menores en efectivo",
  });

  if (error) throw new Error(error.message || "Error al configurar la caja chica.");

  revalidatePath("/erp/caja-chica");
  return { success: true };
}

export async function addCashExpenseAction(data: {
  account_id: string;
  amount: number;
  date: string;
  description: string;
  reference?: string | null;
}) {
  await assertWritePermission("/erp/caja-chica");

  const { account_id, amount, date, description, reference } = data;
  if (!account_id || amount <= 0 || !description?.trim()) {
    throw new Error("Monto y descripción son requeridos.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("bank_transactions").insert({
    account_id,
    type: "egreso",
    amount,
    date,
    description: description.trim(),
    reference: reference?.trim() || null,
    payment_method: "efectivo",
    status: "confirmado",
    origin: "manual",
    categoria: "Retiro en efectivo",
  });

  if (error) throw new Error(error.message || "Error al registrar el gasto.");

  revalidatePath("/erp/caja-chica");
  return { success: true };
}

export async function replenishCajaChicaAction(data: {
  caja_id: string;
  bank_id: string;
  amount: number;
  date: string;
}) {
  await assertWritePermission("/erp/caja-chica");

  const { caja_id, bank_id, amount, date } = data;
  if (!caja_id || !bank_id || amount <= 0) {
    throw new Error("Cuenta de origen y monto válido son requeridos.");
  }

  const supabase = createAdminClient();
  const { data: sourceAcc } = await supabase
    .from("bank_accounts")
    .select("account_type")
    .eq("id", bank_id)
    .single();

  const isCashSource = sourceAcc?.account_type === "caja";
  const paymentMethod = isCashSource ? "efectivo" : "transferencia";

  const { error: err1 } = await supabase.from("bank_transactions").insert({
    account_id: caja_id,
    type: "ingreso",
    amount,
    date,
    description: "Reposición de caja chica",
    payment_method: paymentMethod,
    status: "confirmado",
    origin: "automatico",
  });
  if (err1) throw new Error(err1.message || "Error al registrar reposición en caja chica.");

  const { error: err2 } = await supabase.from("bank_transactions").insert({
    account_id: bank_id,
    type: "egreso",
    amount,
    date,
    description: "Reposición a caja chica",
    payment_method: paymentMethod,
    status: "confirmado",
    origin: "automatico",
  });
  if (err2) throw new Error(err2.message || "Error al debitar de la cuenta origen.");

  revalidatePath("/erp/caja-chica");
  revalidatePath("/erp/bancos");
  return { success: true };
}
