import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Shield, Plus, Lock, Trash2, Save, ShieldCheck } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { ALL_RESOURCES, RESOURCE_SECTIONS, getWritePathForResource } from "@/lib/roles";

export const dynamic = "force-dynamic";

const COLOR_OPTIONS = [
  { value: "bg-lilac-100 text-lilac-800 border-lilac-300", label: "Morado" },
  { value: "bg-blue-50 text-blue-800 border-blue-200",       label: "Azul" },
  { value: "bg-green-50 text-green-800 border-green-300",    label: "Verde" },
  { value: "bg-amber-50 text-amber-800 border-amber-200",    label: "Ámbar" },
  { value: "bg-rose-50 text-rose-800 border-rose-200",       label: "Rosa" },
  { value: "bg-orange-50 text-orange-800 border-orange-200", label: "Naranja" },
  { value: "bg-teal-50 text-teal-800 border-teal-200",       label: "Teal" },
  { value: "bg-gray-100 text-gray-800 border-gray-200",      label: "Gris" },
];

async function savePermissions(formData: FormData) {
  "use server";
  const sessionSupabase = createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();
  if ((user?.app_metadata?.role as string) !== "admin") throw new Error("Sin permisos");

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
    await supabase.from("role_permissions").insert(
      paths.map(p => ({ role_name: roleName, path: p }))
    );
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

  redirect("/erp/roles");
}

async function updateRoleInfo(formData: FormData) {
  "use server";
  const sessionSupabase = createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();
  if ((user?.app_metadata?.role as string) !== "admin") throw new Error("Sin permisos");

  const roleName = formData.get("roleName") as string;
  if (roleName === "admin") throw new Error("No se puede modificar el rol admin");

  const label = formData.get("label") as string;
  const color = formData.get("color") as string;
  const description = formData.get("description") as string;

  if (!label) throw new Error("La etiqueta es requerida");

  const supabase = createAdminClient();
  await supabase.from("system_roles")
    .update({ label, color, description })
    .eq("name", roleName);

  redirect("/erp/roles");
}

async function createRole(formData: FormData) {
  "use server";
  const sessionSupabase = createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();
  if ((user?.app_metadata?.role as string) !== "admin") throw new Error("Sin permisos");

  const label = (formData.get("label") as string).trim();
  const name = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  const color = formData.get("color") as string;
  const description = (formData.get("description") as string).trim();

  if (!name || !label) throw new Error("El nombre visible es requerido");

  const supabase = createAdminClient();
  const { error } = await supabase.from("system_roles").insert({
    name, label, color, description, is_system: false,
  });

  if (error) throw new Error(error.message);

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

  redirect("/erp/roles");
}

async function deleteRole(formData: FormData) {
  "use server";
  const sessionSupabase = createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();
  if ((user?.app_metadata?.role as string) !== "admin") throw new Error("Sin permisos");

  const roleName = formData.get("roleName") as string;
  const supabase = createAdminClient();

  const { data: roleData } = await supabase
    .from("system_roles").select("is_system").eq("name", roleName).single();

  if (roleData?.is_system) throw new Error("No se puede eliminar un rol del sistema");

  await supabase.from("system_roles").delete().eq("name", roleName);

  await logAudit({
    user_id: user?.id,
    user_email: user?.email,
    user_role: "admin",
    action: "delete",
    resource: "system_role",
    resource_id: roleName,
    description: `Rol eliminado: ${roleName}`,
  });

  redirect("/erp/roles");
}

// ── Page ───────────────────────────────────────────────────────────────────

type SystemRole = {
  name: string;
  label: string;
  color: string;
  description: string;
  is_system: boolean;
};

type RolePermission = {
  role_name: string;
  path: string;
};

export default async function RolesPage() {
  const sessionSupabase = createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();
  if ((user?.app_metadata?.role as string) !== "admin") redirect("/erp");

  const supabase = createAdminClient();
  const { data: roles } = await supabase
    .from("system_roles")
    .select("*")
    .order("created_at");

  const { data: allPerms } = await supabase
    .from("role_permissions")
    .select("role_name, path");

  const permMap = new Map<string, Set<string>>();
  (allPerms as RolePermission[] || []).forEach(p => {
    if (!permMap.has(p.role_name)) permMap.set(p.role_name, new Set());
    permMap.get(p.role_name)!.add(p.path);
  });

  const totalRoles = (roles || []).length;
  const customRoles = (roles || []).filter((r: SystemRole) => !r.is_system).length;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
            <Shield className="text-lilac-600" />
            Gestión de Roles
          </h1>
          <p className="text-sm text-ink-600">
            Configura permisos de acceso y crea roles personalizados.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-lilac-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-lilac-50 flex items-center justify-center">
            <Shield size={20} className="text-lilac-600" />
          </div>
          <div>
            <div className="text-xs text-ink-500 font-medium">Total roles</div>
            <div className="text-xl font-bold text-ink-900">{totalRoles}</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-lilac-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <Plus size={20} className="text-green-600" />
          </div>
          <div>
            <div className="text-xs text-ink-500 font-medium">Roles personalizados</div>
            <div className="text-xl font-bold text-ink-900">{customRoles}</div>
          </div>
        </div>
      </div>

      {/* Lista de roles */}
      <div className="space-y-4 mb-8">
        {(roles as SystemRole[] || []).map(role => {
          const perms = permMap.get(role.name) ?? new Set<string>();
          const isAdmin = role.name === "admin";

          return (
            <div key={role.name} className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
              {/* Cabecera del rol */}
              <div className="px-5 py-4 border-b border-lilac-50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex items-center text-xs font-bold px-3 py-1 rounded-full border ${role.color}`}>
                    {role.label}
                  </span>
                  {role.is_system && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-ink-400 bg-ink-50 px-2 py-0.5 rounded-full border border-ink-100">
                      <Lock size={9} /> Sistema
                    </span>
                  )}
                  <code className="text-[11px] text-ink-400 bg-ink-50 px-2 py-0.5 rounded font-mono">
                    {role.name}
                  </code>
                </div>

                {/* Eliminar (solo roles personalizados) */}
                {!role.is_system && (
                  <form action={deleteRole}>
                    <input type="hidden" name="roleName" value={role.name} />
                    <button
                      type="submit"
                      className="text-xs text-red-500 border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Eliminar
                    </button>
                  </form>
                )}
              </div>

              {/* Descripción + info editable */}
              {!isAdmin && (
                <div className="px-5 py-3 bg-ink-50/30 border-b border-lilac-50">
                  <details className="group">
                    <summary className="text-xs text-ink-500 cursor-pointer select-none hover:text-ink-700 flex items-center gap-1">
                      <span className="text-ink-400 group-open:rotate-90 inline-block transition-transform">▶</span>
                      {role.description || "Sin descripción"} — <span className="text-lilac-600 font-medium">Editar info</span>
                    </summary>
                    <form action={updateRoleInfo} className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input type="hidden" name="roleName" value={role.name} />
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-ink-700">Etiqueta</label>
                        <input
                          name="label"
                          defaultValue={role.label}
                          required
                          className="w-full bg-white border border-lilac-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-lilac-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-ink-700">Color</label>
                        <select
                          name="color"
                          defaultValue={role.color}
                          className="w-full bg-white border border-lilac-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-lilac-400"
                        >
                          {COLOR_OPTIONS.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-ink-700">Descripción</label>
                        <input
                          name="description"
                          defaultValue={role.description}
                          placeholder="Descripción del rol"
                          className="w-full bg-white border border-lilac-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-lilac-400"
                        />
                      </div>
                      <div className="sm:col-span-3 flex justify-end">
                        <button
                          type="submit"
                          className="text-xs bg-ink-900 hover:bg-ink-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Save size={11} /> Guardar info
                        </button>
                      </div>
                    </form>
                  </details>
                </div>
              )}

              {/* Contenido de permisos */}
              {isAdmin ? (
                <div className="px-5 py-5">
                  <p className="text-sm text-ink-500 flex items-center gap-2">
                    <ShieldCheck size={15} className="text-lilac-600" />
                    Acceso completo a todos los módulos y funciones del sistema.
                  </p>
                </div>
              ) : (
                <details className="group border-t border-lilac-50">
                  <summary className="px-5 py-3.5 flex items-center justify-between cursor-pointer select-none bg-lilac-50/20 hover:bg-lilac-50/40 transition-colors">
                    <div className="flex items-center gap-2 text-xs font-bold text-lilac-700">
                      <Shield size={14} className="text-lilac-600" />
                      <span>Configurar Accesos y Permisos</span>
                    </div>
                    <div className="text-[10px] text-ink-400 font-semibold flex items-center gap-1">
                      <span className="group-open:hidden">Expandir para configurar ▼</span>
                      <span className="hidden group-open:inline">Contraer ▲</span>
                    </div>
                  </summary>
                  
                  <form action={savePermissions} className="p-5 border-t border-lilac-50 bg-white">
                    <input type="hidden" name="roleName" value={role.name} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      {RESOURCE_SECTIONS.map(section => {
                        const sectionResources = ALL_RESOURCES.filter(r => r.section === section);
                        return (
                          <div key={section} className="bg-lilac-50/10 border border-lilac-100/50 rounded-2xl p-4">
                            <p className="text-xs font-bold text-lilac-700 uppercase tracking-wider mb-3 pb-2 border-b border-lilac-100/50">
                              {section}
                            </p>
                            <div className="divide-y divide-lilac-100/40">
                              {sectionResources.map(r => {
                                const writePath = getWritePathForResource(r.path);
                                const currentVal = perms.has(writePath) ? "editar" : perms.has(r.path) ? "ver" : "ninguno";

                                return (
                                  <div key={r.path} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 gap-4">
                                    <span className="text-xs font-semibold text-ink-800">{r.label}</span>
                                    
                                    <div className="flex bg-ink-100/30 border border-lilac-100/50 rounded-lg p-0.5 shrink-0 select-none">
                                      {/* Ninguno */}
                                      <label className="cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`perm_${r.path}`}
                                          value="ninguno"
                                          defaultChecked={currentVal === "ninguno"}
                                          className="sr-only peer"
                                        />
                                        <div className="px-2.5 py-1 text-[10px] font-bold rounded-md text-ink-500 peer-checked:bg-white peer-checked:text-ink-800 peer-checked:shadow-sm transition-all hover:text-ink-700">
                                          Ninguno
                                        </div>
                                      </label>

                                      {/* Ver */}
                                      <label className="cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`perm_${r.path}`}
                                          value="ver"
                                          defaultChecked={currentVal === "ver"}
                                          className="sr-only peer"
                                        />
                                        <div className="px-2.5 py-1 text-[10px] font-bold rounded-md text-ink-500 peer-checked:bg-lilac-100 peer-checked:text-lilac-700 peer-checked:shadow-sm transition-all hover:text-ink-700">
                                          Ver
                                        </div>
                                      </label>

                                      {/* Editar */}
                                      {r.hasEdit && (
                                        <label className="cursor-pointer">
                                          <input
                                            type="radio"
                                            name={`perm_${r.path}`}
                                            value="editar"
                                            defaultChecked={currentVal === "editar"}
                                            className="sr-only peer"
                                          />
                                          <div className="px-2.5 py-1 text-[10px] font-bold rounded-md text-ink-500 peer-checked:bg-gold-500 peer-checked:text-white peer-checked:shadow-sm transition-all hover:text-gold-700">
                                            Editar
                                          </div>
                                        </label>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-end pt-4 border-t border-lilac-50">
                      <button
                        type="submit"
                        className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-4 py-1.5 rounded-lg font-semibold text-xs transition-colors shadow-sm shadow-lilac-200"
                      >
                        <Save size={13} /> Guardar permisos
                      </button>
                    </div>
                  </form>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {/* Crear nuevo rol */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold text-ink-900 mb-1 flex items-center gap-2">
          <Plus size={18} className="text-lilac-600" />
          Crear nuevo rol
        </h2>
        <p className="text-sm text-ink-500 mb-5">
          Define un rol con accesos personalizados. Después de crearlo, configura sus permisos arriba.
        </p>
        <form action={createRole} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-semibold text-ink-700">Nombre visible *</label>
            <input
              name="label"
              required
              placeholder="Ej. Enfermera"
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink-700">Color</label>
            <select
              name="color"
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
            >
              {COLOR_OPTIONS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-3">
            <label className="text-sm font-semibold text-ink-700">Descripción</label>
            <input
              name="description"
              placeholder="Ej. Personal de enfermería"
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
            />
          </div>
          <div className="sm:col-span-3 flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-md shadow-lilac-200"
            >
              <Plus size={16} /> Crear rol
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
