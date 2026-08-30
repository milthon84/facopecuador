import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { canAccess, type UserRole, getWritePathForResource } from "./roles";

export async function hasWritePermission(resourcePath: string): Promise<boolean> {
  const session = createClient();
  const { data } = await session.auth.getUser();
  const user = data.user;

  if (!user) return false;

  const role = (user.app_metadata?.role as string) ?? "recepcionista";
  if (role === "admin") return true;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("role_permissions")
      .select("path")
      .eq("role_name", role);

    if (error) throw error;

    const paths: string[] = (data || []).map((p: any) => p.path);
    const writePath = getWritePathForResource(resourcePath);
    
    return paths.includes(writePath);
  } catch (err) {
    const writePath = getWritePathForResource(resourcePath);
    return canAccess(role as UserRole, writePath);
  }
}

export async function assertWritePermission(resourcePath: string) {
  const session = createClient();
  const { data } = await session.auth.getUser();
  const user = data.user;

  if (!user) {
    throw new Error("Sin permisos");
  }

  const role = (user.app_metadata?.role as string) ?? "recepcionista";
  if (role === "admin") return user;

  try {
    const supabase = createAdminClient();
    const { data: permData, error } = await supabase
      .from("role_permissions")
      .select("path")
      .eq("role_name", role);

    if (error) throw error;

    const paths = (permData || []).map((p: any) => p.path);
    const writePath = getWritePathForResource(resourcePath);
    if (!paths.includes(writePath)) {
      throw new Error("Sin permisos de modificación");
    }
    return user;
  } catch (err) {
    const writePath = getWritePathForResource(resourcePath);
    if (!canAccess(role as UserRole, writePath)) {
      throw new Error("Sin permisos de modificación");
    }
    return user;
  }
}


/**
 * Validates if the currently logged-in user has permission to access a path.
 * Succeeds immediately if the user is an admin.
 * Otherwise queries `role_permissions` DB table. If DB check fails or table doesn't exist,
 * falls back to static check using `canAccess` from roles.ts.
 * Throws "Sin permisos" error if validation fails.
 */
export async function assertPermission(requiredPath: string) {
  const session = createClient();
  const { data: { user } } = await session.auth.getUser();

  if (!user) {
    throw new Error("Sin permisos");
  }

  const role = (user.app_metadata?.role as string) ?? "recepcionista";
  if (role === "admin") {
    return user;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("role_permissions")
      .select("path")
      .eq("role_name", role);

    if (error) throw error;

    const paths: string[] = (data || []).map((p: any) => p.path);
    const hasAccess = paths.some(
      (p) => requiredPath === p || requiredPath.startsWith(p + "/")
    );

    if (!hasAccess) {
      throw new Error("Sin permisos");
    }
  } catch (err) {
    // Fallback: usar canAccess estático de roles.ts
    const hasAccess = canAccess(role as UserRole, requiredPath);
    if (!hasAccess) {
      throw new Error("Sin permisos");
    }
  }

  return user;
}

export async function getUserRole(): Promise<UserRole> {
  const session = createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return "recepcionista";
  return ((user.app_metadata?.role as string) ?? "recepcionista") as UserRole;
}
