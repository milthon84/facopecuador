// =====================================================
// SISTEMA DE ROLES Y PERMISOS
// =====================================================

export type UserRole = string;

export const ROLE_LABELS: Record<string, string> = {
  admin:         "Administrador",
  recepcionista: "Recepcionista",
  contador:      "Contador",
};

export const ROLE_COLORS: Record<string, string> = {
  admin:         "bg-lilac-100 text-lilac-800 border-lilac-300",
  recepcionista: "bg-blue-50 text-blue-800 border-blue-200",
  contador:      "bg-green-50 text-green-800 border-green-300",
};

// Rutas accesibles solo por admin (fallback cuando DB no está disponible)
const ADMIN_ONLY_ROUTES = [
  "/erp/horarios",
  "/erp/bloqueos",
  "/erp/inventario",
  "/erp/categorias",
  "/erp/unidades",
  "/erp/servicios",
  "/erp/facturacion/config",
  "/erp/usuarios",
  "/erp/roles",
  "/erp/auditoria",
];

// Rutas accesibles por admin y contador (fallback)
const CONTADOR_ROUTES = [
  "/erp/facturacion",
  "/erp/gastos",
  "/erp/contabilidad",
];

// Fallback: usado cuando la DB no está disponible (p.ej. durante desarrollo)
export function canAccess(role: UserRole | undefined, pathname: string): boolean {
  const r = role ?? "recepcionista";
  if (r === "admin") return true;
  if (r === "contador") {
    const allowed = CONTADOR_ROUTES;
    return allowed.some(p => pathname === p || pathname.startsWith(p + "/"));
  }
  const blocked = [...ADMIN_ONLY_ROUTES, ...CONTADOR_ROUTES];
  return !blocked.some(r => pathname.startsWith(r));
}

export function isWritePath(path: string): boolean {
  const normalized = path.toLowerCase();
  return (
    normalized === "/erp/modificar" ||
    normalized.startsWith("/erp/modificar/") ||
    normalized.endsWith("/modificar") ||
    normalized.includes("/modificar/") ||
    normalized.endsWith("/crear") ||
    normalized.includes("/crear/")
  );
}

// Helper para verificar permisos dinámicos (base de datos o estáticos)
export function hasPermission(
  role: string,
  pathToCheck: string,
  allowedPathsFromDb: string[] | null
): boolean {
  if (role === "admin") return true;
  if (allowedPathsFromDb !== null) {
    return allowedPathsFromDb.some((p) => {
      // Si la ruta a verificar es de escritura, solo se concede si el permiso otorgado es también de escritura
      if (isWritePath(pathToCheck)) {
        if (!isWritePath(p)) return false;
      }
      return pathToCheck === p || pathToCheck.startsWith(p + "/");
    });
  }
  return canAccess(role as UserRole, pathToCheck);
}

/**
 * Retorna la primera ruta permitida para un rol según sus permisos.
 * Si el rol tiene permiso para "/erp", retorna "/erp".
 * En caso contrario, busca la primera ruta en NAV_ITEMS a la que tenga acceso.
 * Si no tiene acceso a ninguna ruta, retorna "/erp".
 */
export function getFirstAllowedPath(
  role: string,
  allowedPathsFromDb: string[] | null
): string {
  if (role === "admin") return "/erp";

  if (hasPermission(role, "/erp", allowedPathsFromDb)) {
    return "/erp";
  }

  const firstAllowedItem = NAV_ITEMS.find((item) =>
    hasPermission(role, item.href, allowedPathsFromDb)
  );

  return firstAllowedItem ? firstAllowedItem.href : "/erp";
}



export interface ResourceDef {
  section: "Clínica" | "Cursos" | "General" | "Publicidad" | "Sistema";
  path: string;
  label: string;
  hasEdit: boolean;
}

// ── Recursos configurables por rol ────────────────────────────────────────
// Lista de todas las rutas que se pueden asignar a un rol desde el panel
export const ALL_RESOURCES: readonly ResourceDef[] = [
  // Clínica
  { section: "Clínica",       path: "/erp",              label: "Agenda", hasEdit: true },
  { section: "Clínica",       path: "/erp/calendario",   label: "Calendario", hasEdit: true },
  { section: "Clínica",       path: "/erp/pacientes",    label: "Pacientes", hasEdit: true },
  { section: "Clínica",       path: "/erp/horarios",     label: "Horarios", hasEdit: true },
  { section: "Clínica",       path: "/erp/bloqueos",     label: "Bloqueos", hasEdit: true },
  { section: "Clínica",       path: "/erp/categorias",   label: "Categorías de Insumos", hasEdit: true },
  { section: "Clínica",       path: "/erp/unidades",     label: "Unidades de Medida", hasEdit: true },
  { section: "Clínica",       path: "/erp/servicios",    label: "Catálogo de Servicios", hasEdit: true },
  { section: "Clínica",       path: "/erp/inventario",   label: "Inventario", hasEdit: true },
  { section: "Clínica",       path: "/erp/inventario/transacciones",   label: "Movimientos de Inventario", hasEdit: true },
  { section: "Clínica",       path: "/erp/caja-chica",   label: "Caja Chica", hasEdit: true },

  // Cursos
  { section: "Cursos",        path: "/erp/cursos",       label: "Cursos", hasEdit: true },
  { section: "Cursos",        path: "/erp/cursos/profesores", label: "Profesores", hasEdit: true },
  { section: "Cursos",        path: "/erp/cursos/alumnos",    label: "Alumnos e Inscripciones", hasEdit: true },
  { section: "Cursos",        path: "/erp/cursos/clases",     label: "Clases y Asistencia", hasEdit: true },
  { section: "Cursos",        path: "/erp/cursos/facturacion", label: "Facturación de Módulos", hasEdit: true },
  { section: "Cursos",        path: "/erp/cursos/avisos",     label: "Avisos y Comunicados", hasEdit: true },

  // General
  { section: "General",       path: "/erp/caja-general",        label: "Caja General", hasEdit: true },
  { section: "General",       path: "/erp/bancos",              label: "Bancos", hasEdit: true },
  { section: "General",       path: "/erp/facturacion",         label: "Facturación SRI", hasEdit: true },
  { section: "General",       path: "/erp/gastos",              label: "Gastos / Compras", hasEdit: true },
  { section: "General",       path: "/erp/cuentas-por-cobrar",  label: "Cuentas por Cobrar", hasEdit: true },
  { section: "General",       path: "/erp/cuentas-por-pagar",   label: "Cuentas por Pagar", hasEdit: true },
  { section: "General",       path: "/erp/activos",             label: "Activos Fijos", hasEdit: true },
  { section: "General",       path: "/erp/contabilidad",        label: "Contabilidad", hasEdit: true },

  // Sistema
  { section: "Sistema",       path: "/erp/facturacion/config",  label: "Config. SRI", hasEdit: true },
  { section: "Sistema",       path: "/erp/usuarios",            label: "Usuarios", hasEdit: true },
  // Publicidad
  { section: "Publicidad",    path: "/erp/publicidad",          label: "Publicidad y Anuncios", hasEdit: true },
  { section: "Publicidad",    path: "/erp/sitio-web",           label: "Página Web / CMS", hasEdit: true },

  // Sistema
  { section: "Sistema",       path: "/erp/facturacion/config",  label: "Config. SRI", hasEdit: true },
  { section: "Sistema",       path: "/erp/usuarios",            label: "Usuarios", hasEdit: true },
  { section: "Sistema",       path: "/erp/roles",               label: "Roles", hasEdit: true },
  { section: "Sistema",       path: "/erp/auditoria",           label: "Auditoría", hasEdit: false },
] as const;

export function getWritePathForResource(path: string): string {
  if (path === "/erp/inventario/transacciones") {
    return "/erp/inventario/transacciones/crear";
  }
  return path + "/modificar";
}

export const RESOURCE_SECTIONS = ["Clínica", "Cursos", "General", "Publicidad", "Sistema"] as const;

// ── Navegación ────────────────────────────────────────────────────────────
export interface NavItemDef {
  href: string;
  label: string;
  icon: string;
  section: "Clínica" | "Cursos" | "General" | "Publicidad" | "Sistema";
  roles: UserRole[]; // usado como fallback cuando DB no está disponible
}

export const NAV_SECTIONS = ["Clínica", "Cursos", "General", "Publicidad", "Sistema"] as const;

export const NAV_ITEMS: NavItemDef[] = [
  // Clínica
  { href: "/erp",              label: "Agenda",              icon: "LayoutDashboard", section: "Clínica",       roles: ["admin", "recepcionista"] },
  { href: "/erp/calendario",   label: "Calendario",          icon: "CalendarDays",    section: "Clínica",       roles: ["admin", "recepcionista"] },
  { href: "/erp/pacientes",    label: "Pacientes",           icon: "Users",           section: "Clínica",       roles: ["admin", "recepcionista"] },
  { href: "/erp/horarios",     label: "Horarios",            icon: "Clock",           section: "Clínica",       roles: ["admin"] },
  { href: "/erp/bloqueos",     label: "Bloqueos",            icon: "Ban",             section: "Clínica",       roles: ["admin"] },
  { href: "/erp/categorias",   label: "Categorías de Insumos", icon: "Tag",           section: "Clínica",       roles: ["admin"] },
  { href: "/erp/unidades",     label: "Unidades de Medida",  icon: "Ruler",           section: "Clínica",       roles: ["admin"] },
  { href: "/erp/servicios",    label: "Catálogo de Servicios", icon: "Stethoscope",     section: "Clínica",       roles: ["admin"] },
  { href: "/erp/inventario",   label: "Inventario",          icon: "Package",         section: "Clínica",       roles: ["admin"] },
  { href: "/erp/inventario/transacciones", label: "Movimientos de Inventario", icon: "Layers", section: "Clínica", roles: ["admin"] },
  { href: "/erp/caja-chica",          label: "Caja Chica",          icon: "Wallet",           section: "Clínica",       roles: ["admin", "contador"] },

  // Cursos
  { href: "/erp/cursos",              label: "Cursos",              icon: "GraduationCap",   section: "Cursos",        roles: ["admin"] },
  { href: "/erp/cursos/profesores",   label: "Profesores",          icon: "Award",           section: "Cursos",        roles: ["admin"] },
  { href: "/erp/cursos/alumnos",      label: "Alumnos",             icon: "Users",           section: "Cursos",        roles: ["admin", "recepcionista"] },
  { href: "/erp/cursos/clases",       label: "Clases y Asistencia", icon: "Presentation",      section: "Cursos",        roles: ["admin", "recepcionista"] },

  // General
  { href: "/erp/caja-general",        label: "Caja General",        icon: "Banknote",         section: "General",       roles: ["admin", "contador"] },
  { href: "/erp/bancos",              label: "Bancos",              icon: "Building2",        section: "General",       roles: ["admin", "contador"] },
  { href: "/erp/facturacion",         label: "Facturación SRI",     icon: "FileText",         section: "General",       roles: ["admin", "contador"] },
  { href: "/erp/gastos",              label: "Gastos / Compras",    icon: "ShoppingCart",     section: "General",       roles: ["admin", "contador"] },
  { href: "/erp/cuentas-por-cobrar",  label: "Cuentas por Cobrar",  icon: "CircleDollarSign", section: "General",       roles: ["admin", "contador"] },
  { href: "/erp/cuentas-por-pagar",   label: "Cuentas por Pagar",   icon: "CreditCard",       section: "General",       roles: ["admin", "contador"] },
  { href: "/erp/activos",             label: "Activos Fijos",       icon: "Landmark",         section: "General",       roles: ["admin", "contador"] },
  { href: "/erp/contabilidad",        label: "Contabilidad",        icon: "FileBarChart2",    section: "General",       roles: ["admin", "contador"] },

  // Publicidad
  { href: "/erp/publicidad",          label: "Publicidad / Anuncios", icon: "Megaphone",       section: "Publicidad",    roles: ["admin"] },
  { href: "/erp/sitio-web",           label: "Página Web / CMS",      icon: "Globe",           section: "Publicidad",    roles: ["admin"] },

  // Sistema
  { href: "/erp/facturacion/config",  label: "Config. SRI",         icon: "FileKey",          section: "Sistema",       roles: ["admin"] },
  { href: "/erp/usuarios",            label: "Usuarios",            icon: "UserCog",          section: "Sistema",       roles: ["admin"] },
  { href: "/erp/roles",               label: "Roles",               icon: "Shield",           section: "Sistema",       roles: ["admin"] },
  { href: "/erp/auditoria",           label: "Auditoría",           icon: "ShieldCheck",      section: "Sistema",       roles: ["admin"] },
];

// Dashboard de bienvenida para el contador (sin cambios)
export const CONTADOR_DASHBOARD_ITEMS = [
  { href: "/erp/facturacion", label: "Facturación SRI", desc: "Facturas emitidas y autorizadas",  icon: "FileText" },
  { href: "/erp/gastos",      label: "Gastos",          desc: "Registro de gastos y compras",     icon: "ShoppingCart" },
  { href: "/erp/contabilidad",label: "Contabilidad",    desc: "Libros, reportes y declaraciones", icon: "FileBarChart2" },
];
