"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";

export async function addServiceAction(data: {
  name: string;
  cash_price: number;
  iva_code: string;
  category: string;
}) {
  try {
    await assertWritePermission("/erp/servicios");
    const name = data.name?.trim();
    const cashPrice = Number(data.cash_price || 0);

    if (!name) return { success: false, error: "El nombre del servicio es obligatorio." };

    const supabase = createAdminClient();
    const { data: sriConfig } = await supabase.from("sri_configs").select("*").maybeSingle();
    const cashDiscountPercent = Number(sriConfig?.cash_discount_percent ?? sriConfig?.card_surcharge_percent ?? 6.0);
    const pvp = Number((cashPrice / (1 - cashDiscountPercent / 100)).toFixed(2));

    const { error } = await supabase.from("services").insert({
      name,
      price: pvp,
      iva_code: data.iva_code || "4",
      category: data.category?.trim() || "General",
      active: true,
    });

    if (error) return { success: false, error: error.message || "Error al registrar el servicio." };

    revalidatePath("/erp/servicios");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al registrar el servicio." };
  }
}

export async function updateServiceAction(data: {
  id: string;
  name: string;
  cash_price: number;
  iva_code: string;
  category: string;
}) {
  try {
    await assertWritePermission("/erp/servicios");
    const id = data.id;
    const name = data.name?.trim();
    const cashPrice = Number(data.cash_price || 0);

    if (!id || !name) return { success: false, error: "Datos incompletos para actualizar el servicio." };

    const supabase = createAdminClient();
    const { data: sriConfig } = await supabase.from("sri_configs").select("*").maybeSingle();
    const cashDiscountPercent = Number(sriConfig?.cash_discount_percent ?? sriConfig?.card_surcharge_percent ?? 6.0);
    const pvp = Number((cashPrice / (1 - cashDiscountPercent / 100)).toFixed(2));

    const { error } = await supabase
      .from("services")
      .update({
        name,
        price: pvp,
        iva_code: data.iva_code || "4",
        category: data.category?.trim() || "General",
      })
      .eq("id", id);

    if (error) return { success: false, error: error.message || "Error al actualizar el servicio." };

    revalidatePath("/erp/servicios");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al actualizar el servicio." };
  }
}

export async function toggleServiceAction(formData: FormData) {
  await assertWritePermission("/erp/servicios");
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  const supabase = createAdminClient();
  await supabase.from("services").update({ active: !active }).eq("id", id);
  revalidatePath("/erp/servicios");
}

export async function deleteServiceAction(formData: FormData) {
  await assertWritePermission("/erp/servicios");
  const id = formData.get("id") as string;
  const supabase = createAdminClient();
  await supabase.from("services").delete().eq("id", id);
  revalidatePath("/erp/servicios");
}
