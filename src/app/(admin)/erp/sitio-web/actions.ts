"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertWritePermission } from "@/lib/auth-action";
import { revalidatePath } from "next/cache";

// Guardar configuraciones del sitio
export async function saveWebSettingsAction(hero: any, about: any, contact: any) {
  await assertWritePermission("/erp/sitio-web");

  const supabase = createAdminClient();

  const updates = [
    { key: "hero", value: hero },
    { key: "about", value: about },
    { key: "contact", value: contact }
  ];

  for (const item of updates) {
    const { error } = await supabase
      .from("web_settings")
      .upsert(item, { onConflict: "key" });

    if (error) {
      throw new Error(`Error al guardar configuración ${item.key}: ${error.message}`);
    }
  }

  revalidatePath("/");
  revalidatePath("/erp/sitio-web");
  return { success: true };
}
