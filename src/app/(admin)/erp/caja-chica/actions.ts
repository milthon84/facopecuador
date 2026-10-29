"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";
import {
  ResponsableCajaChica,
  parseResponsableCajaChica,
  formatResponsableNotes,
} from "@/lib/caja-chica-types";

export async function setupCajaChicaAction(data: {
  bank_name: string;
  initial_balance: number;
  responsable?: ResponsableCajaChica | null;
}) {
  await assertWritePermission("/erp/caja-chica");

  const bank_name = data.bank_name?.trim();
  if (!bank_name) throw new Error("El nombre de la caja chica es obligatorio.");

  let baseNotes = "Caja chica para gastos menores en efectivo";
  if (data.responsable && data.responsable.nombre.trim()) {
    baseNotes = formatResponsableNotes(baseNotes, data.responsable);
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("bank_accounts").insert({
    bank_name,
    account_type: "caja",
    initial_balance: Number(data.initial_balance || 0),
    is_active: true,
    notes: baseNotes,
  });

  if (error) throw new Error(error.message || "Error al configurar la caja chica.");

  revalidatePath("/erp/caja-chica");
  return { success: true };
}

export async function updateResponsableCajaChicaAction(data: {
  caja_id: string;
  nombre: string;
  identificacion: string;
  banco: string;
  cuenta: string;
  tipo_cuenta?: string;
  telefono?: string;
}) {
  await assertWritePermission("/erp/caja-chica");

  const { caja_id, nombre, identificacion, banco, cuenta, tipo_cuenta, telefono } = data;
  if (!caja_id || !nombre?.trim()) {
    throw new Error("El nombre del responsable de caja chica es obligatorio.");
  }

  const supabase = createAdminClient();
  const { data: acc, error: accErr } = await supabase
    .from("bank_accounts")
    .select("notes")
    .eq("id", caja_id)
    .single();

  if (accErr || !acc) {
    throw new Error("No se encontró la caja chica seleccionada.");
  }

  const responsableData: ResponsableCajaChica = {
    nombre: nombre.trim(),
    identificacion: (identificacion || "").trim(),
    banco: (banco || "").trim(),
    cuenta: (cuenta || "").trim(),
    tipo_cuenta: tipo_cuenta || "Ahorros",
    telefono: (telefono || "").trim(),
  };

  const updatedNotes = formatResponsableNotes(acc.notes, responsableData);

  const { error: updErr } = await supabase
    .from("bank_accounts")
    .update({
      notes: updatedNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", caja_id);

  if (updErr) {
    throw new Error(updErr.message || "Error al actualizar el custodio responsable.");
  }

  revalidatePath("/erp/caja-chica");
  return { success: true };
}

export async function addCashExpenseAction(data: {
  account_id: string;
  amount: number;
  date: string;
  description: string;
  area?: string;
  reference?: string | null;
}) {
  await assertWritePermission("/erp/caja-chica");

  const { account_id, amount, date, description, area = "clinica", reference } = data;
  if (!account_id || amount <= 0 || !description?.trim()) {
    throw new Error("Monto y descripción son requeridos.");
  }

  const supabase = createAdminClient();
  const areaTag = `[AREA:${area}]`;
  const formattedRef = reference?.trim() ? `${areaTag} ${reference.trim()}` : areaTag;

  const { error } = await supabase.from("bank_transactions").insert({
    account_id,
    type: "egreso",
    amount,
    date,
    description: description.trim(),
    reference: formattedRef,
    payment_method: "efectivo",
    status: "confirmado",
    origin: "manual",
    categoria: area === "cursos" ? "Gasto Cursos" : area === "general" ? "Gasto General" : "Gasto Clínica",
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
  reference?: string | null;
}) {
  await assertWritePermission("/erp/caja-chica");

  const { caja_id, bank_id, amount, date, reference } = data;
  if (!caja_id || !bank_id || amount <= 0) {
    throw new Error("Cuenta de origen bancaria y un monto válido son requeridos.");
  }

  const supabase = createAdminClient();

  // 1. Obtener la cuenta bancaria de origen (Debe ser banco institucional de Niagas, NO caja)
  const { data: sourceAcc } = await supabase
    .from("bank_accounts")
    .select("bank_name, account_number, account_type")
    .eq("id", bank_id)
    .single();

  if (!sourceAcc) {
    throw new Error("No se encontró la cuenta bancaria de origen.");
  }

  if (sourceAcc.account_type === "caja") {
    throw new Error(
      "Las reposiciones de caja chica solo pueden realizarse por transferencia bancaria desde las cuentas de Niagas, no desde caja general."
    );
  }

  // 2. Obtener datos de la caja chica y su responsable
  const { data: cajaAcc } = await supabase
    .from("bank_accounts")
    .select("bank_name, notes")
    .eq("id", caja_id)
    .single();

  const responsable = parseResponsableCajaChica(cajaAcc?.notes);
  const respNombre = responsable?.nombre ? ` a favor de ${responsable.nombre}` : "";
  const refText = reference?.trim() ? `TRF #${reference.trim()}` : "Transferencia bancaria";
  const fullRef = responsable?.nombre
    ? `${refText} · Resp: ${responsable.nombre}`
    : refText;

  // 3. Registrar egreso en la cuenta bancaria de Niagas
  const { error: err1 } = await supabase.from("bank_transactions").insert({
    account_id: bank_id,
    type: "egreso",
    amount,
    date,
    description: `Reposición de Caja Chica${respNombre}`,
    reference: fullRef,
    payment_method: "transferencia",
    status: "confirmado",
    origin: "automatico",
    categoria: "Reposición Caja Chica",
  });
  if (err1) throw new Error(err1.message || "Error al debitar de la cuenta bancaria de Niagas.");

  // 4. Registrar ingreso en la Caja Chica
  const sourceLabel = `${sourceAcc.bank_name}${sourceAcc.account_number ? ` · ${sourceAcc.account_number}` : ""}`;
  const { error: err2 } = await supabase.from("bank_transactions").insert({
    account_id: caja_id,
    type: "ingreso",
    amount,
    date,
    description: `Reposición recibida por transferencia desde ${sourceLabel}`,
    reference: fullRef,
    payment_method: "transferencia",
    status: "confirmado",
    origin: "automatico",
    categoria: "Reposición Caja Chica",
  });
  if (err2) throw new Error(err2.message || "Error al registrar reposición en caja chica.");

  revalidatePath("/erp/caja-chica");
  revalidatePath("/erp/bancos");
  return { success: true };
}
