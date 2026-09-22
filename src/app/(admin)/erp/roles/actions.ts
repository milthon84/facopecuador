"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function createRoleAction(formData: FormData) {
  const sessionSupabase = createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();
  if ((user?.app_metadata?.role as string) !== "admin") throw new Error("Sin permisos de administración.");

  const label = (formData.get("label") as string)?.trim();
  const name = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  const color = (formData.get("color") as string) || "bg-lilac-100 text-lilac-800 border-lilac-300";
  const description = (formData.get("description") as string)?.trim() || null;

  if (!name || !label) throw new Error("El nombre visible del rol es requerido.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("system_roles").insert({
    name,
    label,
    color,
    description,
    is_system: false,
  });

  if (error) throw new Error(error.message || "Error al crear el rol.");

  await logAudit({
    user_id: user?.id,
    user_email: user?.email,
    user_role: "admin",
    action: "create",
    resource: "system_role",
    resource_id: name,
    description: `Rol creado: ${label} (${name})`,
    metadata: { name, label, color },
  });

  revalidatePath("/erp/roles");
  return { success: true };
}
