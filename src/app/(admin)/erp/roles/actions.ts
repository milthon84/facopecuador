"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ALL_RESOURCES, getWritePathForResource } from "@/lib/roles";

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

export async function updateRoleInfoAction(formData: FormData) {
  const sessionSupabase = createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();
  if ((user?.app_metadata?.role as string) !== "admin") throw new Error("Sin permisos de administración.");

  const roleName = formData.get("roleName") as string;
  if (roleName === "admin") throw new Error("No se puede modificar el rol admin");

  const label = (formData.get("label") as string)?.trim();
  const color = formData.get("color") as string;
  const description = (formData.get("description") as string)?.trim() || null;

  if (!label) throw new Error("La etiqueta es requerida.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("system_roles")
    .update({ label, color, description })
    .eq("name", roleName);

  if (error) throw new Error(error.message || "Error al actualizar la información del rol.");

  await logAudit({
    user_id: user?.id,
    user_email: user?.email,
    user_role: "admin",
    action: "update",
    resource: "system_role",
    resource_id: roleName,
    description: `Información de rol actualizada: ${label} (${roleName})`,
    metadata: { label, color, description },
  });

  revalidatePath("/erp/roles");
  return { success: true };
}

export async function savePermissionsAction(formData: FormData) {
  const sessionSupabase = createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();
  if ((user?.app_metadata?.role as string) !== "admin") throw new Error("Sin permisos de administración.");

  const roleName = formData.get("roleName") as string;
  if (roleName === "admin") throw new Error("No se puede modificar el rol admin");

  const paths: string[] = [];
  ALL_RESOURCES.forEach(r => {
    const val = formData.get(`perm_${r.path}`) as string;
    if (val === "ver" || val === "editar") {
      paths.push(r.path);
    }
    if (val === "editar" && r.hasEdit) {
      paths.push(getWritePathForResource(r.path));
    }
  });

  const supabase = createAdminClient();

  await supabase.from("role_permissions").delete().eq("role_name", roleName);
  if (paths.length > 0) {
    const { error } = await supabase.from("role_permissions").insert(
      paths.map(p => ({ role_name: roleName, path: p }))
    );
    if (error) throw new Error(error.message || "Error al guardar permisos.");
  }

  await logAudit({
    user_id: user?.id,
    user_email: user?.email,
    user_role: "admin",
    action: "update",
    resource: "system_role",
    resource_id: roleName,
    description: `Permisos actualizados para rol: ${roleName}`,
    metadata: { paths },
  });

  revalidatePath("/erp/roles");
  return { success: true };
}

export async function deleteRoleAction(formData: FormData) {
  const sessionSupabase = createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();
  if ((user?.app_metadata?.role as string) !== "admin") throw new Error("Sin permisos de administración.");

  const roleName = formData.get("roleName") as string;
  const supabase = createAdminClient();

  const { data: roleData } = await supabase
    .from("system_roles").select("is_system").eq("name", roleName).single();

  if (roleData?.is_system) throw new Error("No se puede eliminar un rol del sistema.");

  const { error } = await supabase.from("system_roles").delete().eq("name", roleName);
  if (error) throw new Error(error.message || "Error al eliminar rol.");

  await logAudit({
    user_id: user?.id,
    user_email: user?.email,
    user_role: "admin",
    action: "delete",
    resource: "system_role",
    resource_id: roleName,
    description: `Rol eliminado: ${roleName}`,
  });

  revalidatePath("/erp/roles");
  return { success: true };
}
