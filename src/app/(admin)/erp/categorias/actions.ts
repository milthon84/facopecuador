"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";

export async function addCategoryAction(data: { name: string; prefix: string }) {
  await assertWritePermission("/erp/categorias");
  const name = data.name?.trim();
  const prefix = data.prefix?.trim().toUpperCase().slice(0, 4);

  if (!name || !prefix) {
    throw new Error("Por favor ingresa el nombre y prefijo de la categoría.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("inventory_categories").insert({ name, prefix });
  if (error) throw new Error(error.message || "Error al registrar la categoría.");

  revalidatePath("/erp/categorias");
  return { success: true };
}

export async function updateCategoryAction(data: { id: string; name: string; prefix: string }) {
  await assertWritePermission("/erp/categorias");
  const id = data.id;
  const name = data.name?.trim();
  const prefix = data.prefix?.trim().toUpperCase().slice(0, 4);

  if (!id || !name || !prefix) {
    throw new Error("Datos inválidos para actualizar la categoría.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("inventory_categories")
    .update({ name, prefix })
    .eq("id", id);

  if (error) throw new Error(error.message || "Error al actualizar la categoría.");

  revalidatePath("/erp/categorias");
  return { success: true };
}

export async function deleteCategoryAction(formData: FormData) {
  await assertWritePermission("/erp/categorias");
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = createAdminClient();
  await supabase.from("inventory_categories").delete().eq("id", id);
  revalidatePath("/erp/categorias");
}
