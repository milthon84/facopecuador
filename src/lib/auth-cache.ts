import { cache } from "react";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { ROLE_LABELS, ROLE_COLORS, type UserRole } from "./roles";

export interface CachedAuthData {
  user: any | null;
  role: string;
  allowedPaths: string[] | null;
  profileName: string | null;
  roleLabel: string;
  roleColor: string;
}

// Caché en memoria para metadatos de roles (TTL: 60 segundos)
interface RoleMetaCacheItem {
  allowedPaths: string[] | null;
  label: string;
  color: string;
  expiresAt: number;
}
const roleCache = new Map<string, RoleMetaCacheItem>();

// Caché en memoria para perfiles de usuario (TTL: 60 segundos)
interface ProfileCacheItem {
  fullName: string | null;
  expiresAt: number;
}
const profileCache = new Map<string, ProfileCacheItem>();

export const getCachedUserAndPermissions = cache(async (): Promise<CachedAuthData> => {
  const supabase = createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        user: null,
        role: "recepcionista",
        allowedPaths: [],
        profileName: null,
        roleLabel: "Recepcionista",
        roleColor: "bg-gray-100 text-gray-800 border-gray-200",
      };
    }

    const role = (user.app_metadata?.role as string) ?? "recepcionista";
    const now = Date.now();

    // 1. Obtener o consultar metadatos del rol (con caché de 60s)
    let roleMeta = roleCache.get(role);
    if (!roleMeta || now > roleMeta.expiresAt) {
      let allowedPaths: string[] | null = null;
      let label = ROLE_LABELS[role as UserRole] ?? role;
      let color = ROLE_COLORS[role as UserRole] ?? "bg-gray-100 text-gray-800 border-gray-200";

      try {
        const adminClient = createAdminClient();
        const [roleRes, permsRes] = await Promise.all([
          adminClient
            .from("system_roles")
            .select("label, color")
            .eq("name", role)
            .single(),
          role !== "admin"
            ? adminClient
                .from("role_permissions")
                .select("path")
                .eq("role_name", role)
            : Promise.resolve({ data: null }),
        ]);

        if (roleRes?.data) {
          label = roleRes.data.label || label;
          color = roleRes.data.color || color;
        }

        if (role !== "admin" && permsRes?.data) {
          allowedPaths = permsRes.data.map((p: any) => p.path);
        }
      } catch (err) {
        console.warn("Fallo al consultar rol/permisos en DB, usando defaults:", err);
      }

      roleMeta = {
        allowedPaths,
        label,
        color,
        expiresAt: now + 60000,
      };
      roleCache.set(role, roleMeta);
    }

    // 2. Obtener o consultar perfil del usuario (con caché de 60s)
    let profileMeta = profileCache.get(user.id);
    if (!profileMeta || now > profileMeta.expiresAt) {
      let fullName: string | null = null;
      try {
        const adminClient = createAdminClient();
        const { data } = await adminClient
          .from("user_profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        fullName = data?.full_name ?? null;
      } catch {
        fullName = null;
      }

      profileMeta = {
        fullName,
        expiresAt: now + 60000,
      };
      profileCache.set(user.id, profileMeta);
    }

    return {
      user,
      role,
      allowedPaths: roleMeta.allowedPaths,
      profileName: profileMeta.fullName,
      roleLabel: roleMeta.label,
      roleColor: roleMeta.color,
    };
  } catch (err) {
    console.error("Error in getCachedUserAndPermissions:", err);
    return {
      user: null,
      role: "recepcionista",
      allowedPaths: [],
      profileName: null,
      roleLabel: "Recepcionista",
      roleColor: "bg-gray-100 text-gray-800 border-gray-200",
    };
  }
});
