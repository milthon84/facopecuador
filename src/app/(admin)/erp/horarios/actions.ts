"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";

export async function createRuleAction(data: {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
}) {
  await assertWritePermission("/erp/horarios");

  const supabase = createAdminClient();
  const { error } = await supabase.from("availability_rules").insert({
    day_of_week: data.day_of_week,
    start_time: data.start_time,
    end_time: data.end_time,
    slot_duration_minutes: data.slot_duration_minutes,
    is_active: data.is_active,
  });

  if (error) throw new Error(error.message || "Error al crear la regla de horario.");

  revalidatePath("/erp/horarios");
  return { success: true };
}

export async function updateRuleAction(
  id: string,
  data: {
    start_time: string;
    end_time: string;
    slot_duration_minutes: number;
    is_active: boolean;
  }
) {
  await assertWritePermission("/erp/horarios");

  const supabase = createAdminClient();
  const { error } = await supabase.from("availability_rules").update({
    start_time: data.start_time,
    end_time: data.end_time,
    slot_duration_minutes: data.slot_duration_minutes,
    is_active: data.is_active,
  }).eq("id", id);

  if (error) throw new Error(error.message || "Error al actualizar la regla de horario.");

  revalidatePath("/erp/horarios");
  return { success: true };
}

export async function deleteRuleAction(id: string) {
  await assertWritePermission("/erp/horarios");

  const supabase = createAdminClient();
  const { error } = await supabase.from("availability_rules").delete().eq("id", id);

  if (error) throw new Error(error.message || "Error al eliminar la regla de horario.");

  revalidatePath("/erp/horarios");
  return { success: true };
}
