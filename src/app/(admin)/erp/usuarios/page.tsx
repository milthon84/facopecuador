import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserCog, Plus, ShieldCheck, Users, ToggleLeft, ToggleRight } from "lucide-react";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/roles";
import type { UserRole } from "@/lib/roles";
import NuevoUsuarioModal from "@/components/NuevoUsuarioModal";
import EditUserModal from "@/components/EditUserModal";
import { toggleUserStatusAction } from "./actions";

export const dynamic = "force-dynamic";

// ── Page ───────────────────────────────────────────────────────────────────

export default async function UsuariosPage() {
  // Verificar que el usuario actual sea admin
  const sessionSupabase = createClient();
  const { data: { user: sessionUser } } = await sessionSupabase.auth.getUser();
  const sessionRole = (sessionUser?.app_metadata?.role as UserRole) ?? "admin";
  if (sessionRole !== "admin") redirect("/erp");

  const supabase = createAdminClient();

  // Obtener todos los usuarios de Supabase Auth
  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();

  // Obtener perfiles
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("*");

  // Obtener todos los roles configurados en la DB
  const { data: dbRoles } = await supabase
    .from("system_roles")
    .select("name, label, color")
    .order("label");
  
  const systemRoles = dbRoles || [];
  const rolesMap = new Map(systemRoles.map((r) => [r.name, r]));

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  // Combinar: usuarios que tienen perfil o están en auth
  const allUsers = (authUsers || []).map((u) => ({
    id: u.id,
    email: u.email || "",
    created_at: u.created_at,
    profile: profileMap.get(u.id) ?? null,
    app_role: (u.app_metadata?.role as UserRole) ?? null,
  }));

  const stats = {
    total: allUsers.length,
    admins: allUsers.filter((u) => (u.profile?.role || u.app_role) === "admin").length,
    activos: allUsers.filter((u) => u.profile?.is_active !== false).length,
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-950 flex items-center gap-2.5 tracking-tight">
            <UserCog className="text-lilac-600" />
            Gestión de Usuarios
          </h1>
          <p className="text-xs text-ink-500 font-medium">Administra el acceso al sistema y los roles del equipo.</p>
        </div>

        <NuevoUsuarioModal systemRoles={systemRoles} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Usuarios", value: stats.total, icon: <Users size={20} className="text-lilac-600" />, bg: "bg-lilac-50" },
          { label: "Administradores", value: stats.admins, icon: <ShieldCheck size={20} className="text-gold-600" />, bg: "bg-amber-50" },
          { label: "Activos", value: stats.activos, icon: <ToggleRight size={20} className="text-green-600" />, bg: "bg-green-50" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-lilac-100 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>{s.icon}</div>
            <div>
              <div className="text-xs text-ink-500 font-medium">{s.label}</div>
              <div className="text-xl font-bold text-ink-900">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabla de usuarios */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-lilac-50 flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">Usuarios del sistema</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-lilac-50/50 text-xs text-ink-600 uppercase font-semibold">
              <tr>
                <th className="px-5 py-3 text-left">Usuario</th>
                <th className="px-5 py-3 text-left">Rol</th>
                <th className="px-5 py-3 text-center">Estado</th>
                <th className="px-5 py-3 text-center">Registrado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lilac-50">
              {allUsers.map((u) => {
                const role = (u.profile?.role || u.app_role) as UserRole | null;
                const isActive = u.profile?.is_active !== false;
                const isCurrentUser = u.id === sessionUser?.id;
                const dbRole = role ? rolesMap.get(role) : null;
                const label = dbRole?.label || (role ? ROLE_LABELS[role] : null) || role;
                const color = dbRole?.color || (role ? ROLE_COLORS[role] : null) || "bg-gray-100 text-gray-800 border-gray-200";

                return (
                  <tr key={u.id} className="hover:bg-lilac-50/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink-900">{u.profile?.full_name || "—"}</div>
                      <div className="text-xs text-ink-500">{u.email}</div>
                      {isCurrentUser && (
                        <span className="text-[10px] bg-lilac-100 text-lilac-700 px-1.5 py-0.5 rounded font-semibold">Tú</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {role ? (
                        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${color}`}>
                          {label}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-400 italic">Sin perfil</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${isActive ? "bg-green-100 text-green-700" : "bg-red-50 text-red-600"}`}>
                        {isActive ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                        {isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-xs text-ink-500">
                      {new Date(u.created_at).toLocaleDateString("es-EC")}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <EditUserModal
                          user={{
                            id: u.id,
                            email: u.email,
                            full_name: u.profile?.full_name,
                            role: role,
                            is_active: isActive,
                          }}
                          systemRoles={systemRoles}
                          isCurrentUser={isCurrentUser}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
