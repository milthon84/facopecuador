"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";

export async function createExceptionAction(data: {
  date: string;
  type: "block" | "extra";
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
}) {
  await assertWritePermission("/erp/bloqueos");

  if (!data.date || !data.type) {
    throw new Error("Fecha y tipo son requeridos.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("availability_exceptions").insert({
    date: data.date,
    type: data.type,
    start_time: data.start_time || null,
    end_time: data.end_time || null,
    reason: data.reason?.trim() || null,
  });

  if (error) {
    throw new Error(error.message || "Error al crear la excepción.");
  }

  revalidatePath("/erp/bloqueos");
  return { success: true };
}

export async function deleteExceptionAction(id: string) {
  await assertWritePermission("/erp/bloqueos");

  if (!id) throw new Error("ID inválido");

  const supabase = createAdminClient();
  const { error } = await supabase.from("availability_exceptions").delete().eq("id", id);

  if (error) {
    throw new Error(error.message || "Error al eliminar la excepción.");
  }

  revalidatePath("/erp/bloqueos");
  return { success: true };
}
