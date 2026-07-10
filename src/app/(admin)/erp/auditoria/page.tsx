import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ShieldCheck, LogIn, LogOut, PlusCircle, Edit2, Trash2, XCircle, Download, Upload } from "lucide-react";
import type { UserRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  login:   { label: "Login",    color: "bg-green-50 text-green-700 border-green-200",  icon: <LogIn size={12} /> },
  logout:  { label: "Logout",   color: "bg-slate-50 text-slate-600 border-slate-200",  icon: <LogOut size={12} /> },
  create:  { label: "Creación", color: "bg-blue-50 text-blue-700 border-blue-200",     icon: <PlusCircle size={12} /> },
  update:  { label: "Edición",  color: "bg-amber-50 text-amber-700 border-amber-200",  icon: <Edit2 size={12} /> },
  delete:  { label: "Eliminar", color: "bg-red-50 text-red-700 border-red-200",        icon: <Trash2 size={12} /> },
  cancel:  { label: "Cancelar", color: "bg-orange-50 text-orange-700 border-orange-200", icon: <XCircle size={12} /> },
  export:  { label: "Exportar", color: "bg-purple-50 text-purple-700 border-purple-200", icon: <Download size={12} /> },
  import:  { label: "Importar", color: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: <Upload size={12} /> },
};

const RESOURCE_LABELS: Record<string, string> = {
  session:                "Sesión",
  appointment:            "Cita",
  patient:                "Paciente",
  inventory_transaction:  "Inventario",
  inventory_product:      "Producto",
  dental_consultation:    "Atención clínica",
  invoice:                "Factura",
  user_profile:           "Usuario",
};

export default async function AuditoriaPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ resource?: string; action?: string; page?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  // Solo admin
  const sessionSupabase = createClient();
  const { data: { user: sessionUser } } = await sessionSupabase.auth.getUser();
  const sessionRole = (sessionUser?.app_metadata?.role as UserRole) ?? "admin";
  if (sessionRole !== "admin") redirect("/erp");

  const supabase = createAdminClient();

  const page = Number(searchParams.page || 1);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (searchParams.resource) query = query.eq("resource", searchParams.resource);
  if (searchParams.action)   query = query.eq("action", searchParams.action);

  const { data: logs, count } = await query;
  const totalPages = Math.ceil((count || 0) / pageSize);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
            <ShieldCheck className="text-lilac-600" />
            Auditoría del Sistema
          </h1>
          <p className="text-sm text-ink-600">
            Registro de todas las acciones realizadas por los usuarios.
            {count != null && <span className="ml-1 font-semibold text-lilac-700">{count} registros</span>}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap gap-3 mb-6" method="get">
        <select
          name="resource"
          defaultValue={searchParams.resource || ""}
          className="bg-white border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
          onChange={(e) => { /* handled by form submit */ }}
        >
          <option value="">Todos los recursos</option>
          {Object.entries(RESOURCE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          name="action"
          defaultValue={searchParams.action || ""}
          className="bg-white border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
        >
          <option value="">Todas las acciones</option>
          {Object.entries(ACTION_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button type="submit" className="bg-lilac-600 hover:bg-lilac-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          Filtrar
        </button>
        {(searchParams.resource || searchParams.action) && (
          <a href="/erp/auditoria" className="bg-white border border-lilac-200 hover:bg-lilac-50 text-ink-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            Limpiar filtros
          </a>
        )}
      </form>

      {/* Tabla */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-lilac-50/50 text-xs text-ink-600 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Fecha y hora</th>
                <th className="px-4 py-3 text-left">Usuario</th>
                <th className="px-4 py-3 text-left">Acción</th>
                <th className="px-4 py-3 text-left">Recurso</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-left">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lilac-50">
              {!logs || logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-ink-500">
                    No hay registros de auditoría.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const actionCfg = ACTION_CONFIG[log.action] || {
                    label: log.action,
                    color: "bg-gray-50 text-gray-700 border-gray-200",
                    icon: null,
                  };
                  return (
                    <tr key={log.id} className="hover:bg-lilac-50/20 transition-colors">
                      <td className="px-4 py-3 text-ink-500 whitespace-nowrap text-xs">
                        {new Date(log.created_at).toLocaleString("es-EC", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-ink-800">{log.user_email || "—"}</div>
                        {log.user_role && (
                          <div className="text-[10px] text-ink-400 mt-0.5 capitalize">{log.user_role}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${actionCfg.color}`}>
                          {actionCfg.icon}
                          {actionCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-600">
                        {RESOURCE_LABELS[log.resource] || log.resource}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-700 max-w-xs">
                        <span className="line-clamp-2">{log.description}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-400 font-mono">
                        {log.ip_address || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-lilac-50 text-sm">
            <span className="text-ink-500">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={`/erp/auditoria?page=${page - 1}${searchParams.resource ? `&resource=${searchParams.resource}` : ""}${searchParams.action ? `&action=${searchParams.action}` : ""}`}
                  className="px-3 py-1.5 bg-white border border-lilac-200 rounded-lg hover:bg-lilac-50 transition-colors"
                >
                  ← Anterior
                </a>
              )}
              {page < totalPages && (
                <a
                  href={`/erp/auditoria?page=${page + 1}${searchParams.resource ? `&resource=${searchParams.resource}` : ""}${searchParams.action ? `&action=${searchParams.action}` : ""}`}
                  className="px-3 py-1.5 bg-lilac-600 text-white rounded-lg hover:bg-lilac-700 transition-colors"
                >
                  Siguiente →
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
