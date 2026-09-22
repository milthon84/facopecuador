"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";

export async function createBankAccountAction(data: {
  bank_name: string;
  account_number?: string | null;
  account_type: string;
  initial_balance: number;
  notes?: string | null;
}) {
  await assertWritePermission("/erp/bancos");

  const bank_name = data.bank_name?.trim();
  const account_type = data.account_type;
  if (!bank_name || !account_type) throw new Error("Nombre y tipo de cuenta son obligatorios.");

  const supabase = createAdminClient();

  if (account_type === "caja") {
    const { data: existing } = await supabase
      .from("bank_accounts")
      .select("id")
      .eq("account_type", "caja")
      .eq("is_active", true);
    if ((existing || []).length >= 2) {
      throw new Error("Ya existe el máximo de cajas permitidas (Caja General + Caja Chica)");
    }
  }

  const { error } = await supabase.from("bank_accounts").insert({
    bank_name,
    account_number: data.account_number?.trim() || null,
    account_type,
    initial_balance: Number(data.initial_balance || 0),
    notes: data.notes?.trim() || null,
  });

  if (error) throw new Error(error.message || "Error al crear la cuenta bancaria.");

  revalidatePath("/erp/bancos");
  return { success: true };
}

export async function addBankTransactionAction(data: {
  account_id: string;
  type: "ingreso" | "egreso";
  amount: number;
  date: string;
  categoria: string;
  description?: string | null;
  reference?: string | null;
  payment_method: string;
  status: string;
}) {
  await assertWritePermission("/erp/bancos");

  const { account_id, type, amount, date, categoria, description, reference, payment_method, status } = data;
  if (!account_id || !categoria || amount <= 0) {
    throw new Error("Por favor completa los datos obligatorios y un monto mayor a 0.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("bank_transactions").insert({
    account_id,
    type,
    amount,
    date,
    description: description?.trim() || categoria,
    reference: reference?.trim() || null,
    payment_method: payment_method || "transferencia",
    status: status || "confirmado",
    origin: "manual",
    categoria,
  });

  if (error) throw new Error(error.message || "Error al registrar la transacción bancaria.");

  revalidatePath(`/erp/bancos/${account_id}`);
  revalidatePath("/erp/bancos");
  return { success: true };
}

export async function transferFromCajaAction(data: {
  caja_id: string;
  bank_id: string;
  amount: number;
  date: string;
  reference?: string | null;
}) {
  await assertWritePermission("/erp/bancos");

  const supabase = createAdminClient();
  const { caja_id, bank_id, amount, date, reference } = data;

  if (!caja_id || !bank_id || amount <= 0) {
    throw new Error("Monto y banco de destino son obligatorios.");
  }

  const { error: err1 } = await supabase.from("bank_transactions").insert({
    account_id: caja_id,
    type: "egreso",
    amount,
    date,
    description: "Depósito en banco desde Caja General",
    reference: reference?.trim() || null,
    payment_method: "transferencia",
    status: "confirmado",
    origin: "automatico",
  });
  if (err1) throw new Error(err1.message || "Error al registrar egreso de caja.");

  const { error: err2 } = await supabase.from("bank_transactions").insert({
    account_id: bank_id,
    type: "ingreso",
    amount,
    date,
    description: "Depósito desde Caja General",
    reference: reference?.trim() || null,
    payment_method: "transferencia",
    status: "confirmado",
    origin: "automatico",
  });
  if (err2) throw new Error(err2.message || "Error al registrar depósito en banco.");

  revalidatePath(`/erp/bancos/${caja_id}`);
  revalidatePath(`/erp/bancos/${bank_id}`);
  revalidatePath("/erp/bancos");
  return { success: true };
}

