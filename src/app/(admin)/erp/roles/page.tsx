import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Shield, Plus, ShieldCheck, Sparkles, Layers } from "lucide-react";
import NuevoRolModal from "@/components/NuevoRolModal";
import RoleCard, { type SystemRoleData } from "@/components/RoleCard";

export const dynamic = "force-dynamic";

type RolePermission = {
  role_name: string;
  path: string;
};

export default async function RolesPage() {
  const sessionSupabase = createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();
  if ((user?.app_metadata?.role as string) !== "admin") redirect("/erp");

  const supabase = createAdminClient();
  const [{ data: roles }, { data: allPerms }] = await Promise.all([
    supabase.from("system_roles").select("*").order("created_at"),
    supabase.from("role_permissions").select("role_name, path"),
  ]);

  const permMap = new Map<string, Set<string>>();
  ((allPerms as RolePermission[]) || []).forEach((p) => {
    if (!permMap.has(p.role_name)) permMap.set(p.role_name, new Set());
    permMap.get(p.role_name)!.add(p.path);
  });

  const roleList = (roles as SystemRoleData[]) || [];
  const totalRoles = roleList.length;
  const systemRoles = roleList.filter((r) => r.is_system).length;
  const customRoles = roleList.filter((r) => !r.is_system).length;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Header Ejecutivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-lilac-100 text-lilac-700">
              <Shield size={18} />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Roles y Permisos
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Control de perfiles de usuario y matriz de permisos granulares por módulo.
          </p>
        </div>

        <NuevoRolModal />
      </div>

      {/* Stats Cards Minimalistas */}
      <div className="grid grid-cols-3 gap-3.5 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Roles
            </span>
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
              <Layers size={14} />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 leading-none">
            {totalRoles}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              De Sistema
            </span>
            <span className="p-1.5 rounded-lg bg-lilac-100 text-lilac-700">
              <ShieldCheck size={14} />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 leading-none">
            {systemRoles}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Personalizados
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <Sparkles size={14} />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 leading-none">
            {customRoles}
          </div>
        </div>
      </div>

      {/* Lista de Roles Ejecutiva */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          <span>Perfiles Registrados</span>
          <span className="text-slate-400 font-normal lowercase">
            Haz clic en un rol para desplegar sus permisos
          </span>
        </div>

        {roleList.map((role) => {
          const perms = permMap.get(role.name) ?? new Set<string>();
          return (
            <RoleCard
              key={role.name}
              role={role}
              initialPerms={Array.from(perms)}
            />
          );
        })}
      </div>
    </div>
  );
}
