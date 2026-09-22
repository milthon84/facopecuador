"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";

export async function addUnitAction(data: { name: string }) {
  await assertWritePermission("/erp/unidades");
  const name = data.name?.trim();

  if (!name) {
    throw new Error("Por favor ingresa el nombre de la unidad de medida.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("inventory_units").insert({ name });
  if (error) throw new Error(error.message || "Error al registrar la unidad.");

  revalidatePath("/erp/unidades");
  return { success: true };
}

export async function updateUnitAction(data: { id: string; name: string }) {
  await assertWritePermission("/erp/unidades");
  const id = data.id;
  const name = data.name?.trim();

  if (!id || !name) {
    throw new Error("Datos inválidos para actualizar la unidad.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("inventory_units")
    .update({ name })
    .eq("id", id);

  if (error) throw new Error(error.message || "Error al actualizar la unidad.");

  revalidatePath("/erp/unidades");
  return { success: true };
}

export async function deleteUnitAction(formData: FormData) {
  await assertWritePermission("/erp/unidades");
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = createAdminClient();
  await supabase.from("inventory_units").delete().eq("id", id);
  revalidatePath("/erp/unidades");
}
