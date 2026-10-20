import { getCachedUserAndPermissions } from "./auth-cache";
import { canAccess, type UserRole, getWritePathForResource, hasPermission } from "./roles";

export async function hasWritePermission(resourcePath: string): Promise<boolean> {
  const { user, role, allowedPaths } = await getCachedUserAndPermissions();
  if (!user) return false;
  if (role === "admin") return true;

  const writePath = getWritePathForResource(resourcePath);
  if (allowedPaths !== null) {
    return hasPermission(role, writePath, allowedPaths);
  }
  return canAccess(role as UserRole, writePath);
}

export async function assertWritePermission(resourcePath: string) {
  const { user, role, allowedPaths } = await getCachedUserAndPermissions();
  if (!user) {
    throw new Error("Sin permisos");
  }
  if (role === "admin") return user;

  const writePath = getWritePathForResource(resourcePath);
  const ok = allowedPaths !== null
    ? hasPermission(role, writePath, allowedPaths)
    : canAccess(role as UserRole, writePath);

  if (!ok) {
    throw new Error("Sin permisos de modificación");
  }
  return user;
}

/**
 * Valida si el usuario actualmente autenticado tiene permiso para acceder a una ruta.
 * Reutiliza la sesión en caché mediante getCachedUserAndPermissions (sin llamadas de red redundantes).
 */
export async function assertPermission(requiredPath: string) {
  const { user, role, allowedPaths } = await getCachedUserAndPermissions();
  if (!user) {
    throw new Error("Sin permisos");
  }
  if (role === "admin") {
    return user;
  }

  const ok = allowedPaths !== null
    ? hasPermission(role, requiredPath, allowedPaths)
    : canAccess(role as UserRole, requiredPath);

  if (!ok) {
    throw new Error("Sin permisos");
  }
  return user;
}

export async function getUserRole(): Promise<UserRole> {
  const { role } = await getCachedUserAndPermissions();
  return (role || "recepcionista") as UserRole;
}
