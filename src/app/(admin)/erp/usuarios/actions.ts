"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import type { UserRole } from "@/lib/roles";

export async function createUserAction(formData: FormData) {
  const supabase = createAdminClient();
  const sessionSupabase = createClient();
  const { data: { user: sessionUser } } = await sessionSupabase.auth.getUser();
  const sessionRole = (sessionUser?.app_metadata?.role as UserRole) ?? "admin";
  if (sessionRole !== "admin") throw new Error("Sin permisos");

  const full_name = formData.get("full_name") as string;
  const email     = formData.get("email") as string;
  const password  = formData.get("password") as string;
  const role      = formData.get("role") as UserRole;

  // Validar rol en base de datos
  const { data: roleExists } = await supabase
    .from("system_roles")
    .select("name, label")
    .eq("name", role)
    .single();
  if (!roleExists) throw new Error("Rol inválido");

  // Crear usuario en Supabase Auth con rol en app_metadata
  const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    app_metadata: { role },
    email_confirm: true,
  });

  if (authError || !newUser.user) {
    throw new Error(authError?.message || "Error al crear usuario");
  }

  // Insertar perfil
  await supabase.from("user_profiles").insert({
    id: newUser.user.id,
    full_name,
    role,
    is_active: true,
  });

  await logAudit({
    user_id: sessionUser?.id,
    user_email: sessionUser?.email,
    user_role: sessionRole,
    action: "create",
    resource: "user_profile",
    resource_id: newUser.user.id,
    description: `Usuario creado: ${email} (${roleExists.label})`,
    metadata: { email, role, full_name },
  });

  revalidatePath("/erp/usuarios");
  redirect("/erp/usuarios");
}

export async function toggleUserStatusAction(formData: FormData) {
  const supabase = createAdminClient();
  const sessionSupabase = createClient();
  const { data: { user: sessionUser } } = await sessionSupabase.auth.getUser();
  const sessionRole = (sessionUser?.app_metadata?.role as UserRole) ?? "admin";
  if (sessionRole !== "admin") throw new Error("Sin permisos");

  const userId    = formData.get("userId") as string;
  const newStatus = formData.get("newStatus") === "true";

  // Prevenir que se desactive a sí mismo
  if (userId === sessionUser?.id) throw new Error("No puedes desactivar tu propio usuario");

  await supabase.from("user_profiles").update({ is_active: newStatus }).eq("id", userId);

  await logAudit({
    user_id: sessionUser?.id,
    user_email: sessionUser?.email,
    user_role: sessionRole,
    action: "update",
    resource: "user_profile",
    resource_id: userId,
    description: `Usuario ${newStatus ? "activado" : "desactivado"}`,
  });

  revalidatePath("/erp/usuarios");
  redirect("/erp/usuarios");
}

export async function updateUserAction(data: {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
}) {
  const supabase = createAdminClient();
  const sessionSupabase = createClient();
  const { data: { user: sessionUser } } = await sessionSupabase.auth.getUser();
  const sessionRole = (sessionUser?.app_metadata?.role as string) ?? "admin";
  if (sessionRole !== "admin") throw new Error("Sin permisos");

  // Prevenir que el usuario actual se deshabilite o cambie su propio rol
  const isCurrentUser = data.id === sessionUser?.id;
  const targetRole = isCurrentUser ? "admin" : data.role;
  const targetActive = isCurrentUser ? true : data.is_active;

  // Validar rol en base de datos
  const { data: roleExists } = await supabase
    .from("system_roles")
    .select("name, label")
    .eq("name", targetRole)
    .single();
  if (!roleExists) throw new Error("Rol inválido");

  // 1. Actualizar/Insertar perfil (upsert en caso de que no tenga perfil aún)
  const { error: profileError } = await supabase
    .from("user_profiles")
    .upsert({
      id: data.id,
      full_name: data.full_name,
      role: targetRole,
      is_active: targetActive,
    });

  if (profileError) throw new Error(`Error al actualizar perfil: ${profileError.message}`);

  // 2. Actualizar app_metadata en Auth
  const { error: authError } = await supabase.auth.admin.updateUserById(data.id, {
    app_metadata: { role: targetRole },
  });

  if (authError) throw new Error(`Error al actualizar auth: ${authError.message}`);

  await logAudit({
    user_id: sessionUser?.id,
    user_email: sessionUser?.email,
    user_role: sessionRole,
    action: "update",
    resource: "user_profile",
    resource_id: data.id,
    description: `Usuario modificado: ${data.full_name || data.id} (Rol: ${roleExists.label}, Activo: ${targetActive})`,
    metadata: { ...data, is_current_user: isCurrentUser },
  });

  revalidatePath("/erp/usuarios");
}
