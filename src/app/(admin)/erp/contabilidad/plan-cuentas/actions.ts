"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertWritePermission } from "@/lib/auth-action";
import { revalidatePath } from "next/cache";

export type AccountFormData = {
  id?: string;
  code: string;
  name: string;
  type: string;
  subtype?: string | null;
  parent_code?: string | null;
  is_movement: boolean;
  active?: boolean;
};

export async function saveAccountAction(data: AccountFormData) {
  await assertWritePermission("/erp/contabilidad");

  const supabase = createAdminClient();
  const code = data.code.trim();
  const name = data.name.trim();
  const type = data.type.trim().toUpperCase();
  const subtype = (data.subtype || "").trim().toLowerCase() || null;
  const is_movement = Boolean(data.is_movement);
  const active = data.active !== undefined ? Boolean(data.active) : true;

  if (!code) {
    return { success: false, error: "El código de la cuenta es obligatorio." };
  }
  if (!name) {
    return { success: false, error: "El nombre de la cuenta es obligatorio." };
  }
  if (!type) {
    return { success: false, error: "El tipo de cuenta es obligatorio." };
  }

  // Calcular parent_code automáticamente si no se especificó
  let parent_code = data.parent_code ? data.parent_code.trim() : null;
  if (!parent_code && code.includes(".")) {
    const parts = code.split(".");
    if (parts.length > 1) {
      parent_code = parts.slice(0, -1).join(".");
    }
  }

  // Si estamos creando (no hay id)
  if (!data.id) {
    // Validar unicidad del código
    const { data: existing } = await supabase
      .from("accounts")
      .select("id, code")
      .eq("code", code)
      .maybeSingle();

    if (existing) {
      return { success: false, error: `Ya existe una cuenta con el código "${code}".` };
    }

    const { data: created, error } = await supabase
      .from("accounts")
      .insert({
        code,
        name,
        type,
        subtype,
        parent_code,
        is_movement,
        active,
      })
      .select()
      .single();

    if (error || !created) {
      return { success: false, error: error?.message || "Error al crear la cuenta." };
    }

    revalidatePath("/erp/contabilidad/plan-cuentas");
    revalidatePath("/erp/contabilidad");
    return { success: true, account: created };
  }

  // Si estamos actualizando (hay id)
  const { data: currentAcc } = await supabase
    .from("accounts")
    .select("id, code")
    .eq("id", data.id)
    .single();

  if (!currentAcc) {
    return { success: false, error: "La cuenta que intenta editar no existe." };
  }

  // Si se cambió el código, verificar que no colisione con otra
  if (currentAcc.code !== code) {
    const { data: collision } = await supabase
      .from("accounts")
      .select("id")
      .eq("code", code)
      .neq("id", data.id)
      .maybeSingle();

    if (collision) {
      return { success: false, error: `Ya existe otra cuenta con el código "${code}".` };
    }

    // Actualizar código en journal_lines para preservar la integridad histórica si cambió el código
    await supabase
      .from("journal_lines")
      .update({ account_code: code, account_name: name })
      .eq("account_code", currentAcc.code);

    // Actualizar subcuentas hijas si tenían este parent_code
    await supabase
      .from("accounts")
      .update({ parent_code: code })
      .eq("parent_code", currentAcc.code);
  }

  const { data: updated, error } = await supabase
    .from("accounts")
    .update({
      code,
      name,
      type,
      subtype,
      parent_code,
      is_movement,
      active,
    })
    .eq("id", data.id)
    .select()
    .single();

  if (error || !updated) {
    return { success: false, error: error?.message || "Error al actualizar la cuenta." };
  }

  revalidatePath("/erp/contabilidad/plan-cuentas");
  revalidatePath("/erp/contabilidad");
  return { success: true, account: updated };
}

export async function toggleAccountActiveAction(id: string, active: boolean) {
  await assertWritePermission("/erp/contabilidad");
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("accounts")
    .update({ active })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/erp/contabilidad/plan-cuentas");
  revalidatePath("/erp/contabilidad");
  return { success: true };
}

export async function deleteAccountAction(id: string) {
  await assertWritePermission("/erp/contabilidad");
  const supabase = createAdminClient();

  const { data: account, error: getErr } = await supabase
    .from("accounts")
    .select("id, code, name, is_movement")
    .eq("id", id)
    .single();

  if (getErr || !account) {
    return { success: false, error: "La cuenta no existe o ya fue eliminada." };
  }

  // 1. Validar si tiene asientos contables registrados
  const { count: linesCount, error: linesErr } = await supabase
    .from("journal_lines")
    .select("*", { count: "exact", head: true })
    .eq("account_code", account.code);

  if (!linesErr && linesCount && linesCount > 0) {
    return {
      success: false,
      error: `No se puede eliminar la cuenta "${account.code} — ${account.name}" porque tiene ${linesCount} movimiento(s) contable(s) registrado(s). Para preservar los estados financieros, puede desactivarla.`,
    };
  }

  // 2. Si es grupo, validar si tiene cuentas hijas
  const { count: childCount, error: childErr } = await supabase
    .from("accounts")
    .select("*", { count: "exact", head: true })
    .eq("parent_code", account.code);

  if (!childErr && childCount && childCount > 0) {
    return {
      success: false,
      error: `No se puede eliminar el grupo "${account.code}" porque contiene ${childCount} cuenta(s) hija(s) subordinadas. Reasigne o elimine primero las subcuentas.`,
    };
  }

  // 3. Eliminar de accounts
  const { error: delErr } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id);

  if (delErr) {
    return { success: false, error: delErr.message || "Error al eliminar la cuenta." };
  }

  revalidatePath("/erp/contabilidad/plan-cuentas");
  revalidatePath("/erp/contabilidad");
  return { success: true };
}
