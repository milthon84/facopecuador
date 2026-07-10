import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccess } from "@/lib/roles";
import type { UserRole } from "@/lib/roles";

function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return res;
}

function buildSupabaseClient(req: NextRequest, res: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );
}

function isWritePath(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return (
    normalized.endsWith("/nueva") ||
    normalized.includes("/nueva/") ||
    normalized.endsWith("/nuevo") ||
    normalized.includes("/nuevo/") ||
    normalized.endsWith("/crear") ||
    normalized.includes("/crear/") ||
    normalized.endsWith("/editar-ficha") ||
    normalized.endsWith("/atencion") ||
    normalized.includes("/atencion/") ||
    normalized.endsWith("/transacciones/crear")
  );
}

function getModifyPathForPathname(pathname: string): string {
  if (pathname.startsWith("/erp/cursos/profesores")) {
    return "/erp/cursos/profesores/modificar";
  }
  if (pathname.startsWith("/erp/cursos/alumnos")) {
    return "/erp/cursos/alumnos/modificar";
  }
  if (pathname.startsWith("/erp/cursos/clases")) {
    return "/erp/cursos/clases/modificar";
  }
  if (pathname.startsWith("/erp/cursos/facturacion")) {
    return "/erp/cursos/facturacion/modificar";
  }
  if (pathname.startsWith("/erp/cursos/avisos")) {
    return "/erp/cursos/avisos/modificar";
  }
  if (pathname.startsWith("/erp/cursos")) {
    return "/erp/cursos/modificar";
  }
  if (pathname.startsWith("/erp/pacientes")) {
    return "/erp/pacientes/modificar";
  }
  if (pathname.startsWith("/erp/inventario")) {
    return "/erp/inventario/modificar";
  }
  if (pathname.startsWith("/erp/caja-general")) {
    return "/erp/caja-general/modificar";
  }
  if (pathname.startsWith("/erp/caja-chica")) {
    return "/erp/caja-chica/modificar";
  }
  if (pathname.startsWith("/erp/cuentas-por-cobrar")) {
    return "/erp/cuentas-por-cobrar/modificar";
  }
  if (pathname.startsWith("/erp/cuentas-por-pagar")) {
    return "/erp/cuentas-por-pagar/modificar";
  }
  if (pathname.startsWith("/erp/bancos")) {
    return "/erp/bancos/modificar";
  }
  if (pathname.startsWith("/erp/activos")) {
    return "/erp/activos/modificar";
  }
  if (pathname.startsWith("/erp/facturacion/config")) {
    return "/erp/facturacion/config/modificar";
  }
  if (pathname.startsWith("/erp/facturacion")) {
    return "/erp/facturacion/modificar";
  }
  if (pathname.startsWith("/erp/gastos")) {
    return "/erp/gastos/modificar";
  }
  if (pathname.startsWith("/erp/contabilidad")) {
    return "/erp/contabilidad/modificar";
  }
  if (pathname.startsWith("/erp/usuarios")) {
    return "/erp/usuarios/modificar";
  }
  if (pathname.startsWith("/erp/horarios")) {
    return "/erp/horarios/modificar";
  }
  if (pathname.startsWith("/erp/bloqueos")) {
    return "/erp/bloqueos/modificar";
  }
  if (pathname.startsWith("/erp/categorias")) {
    return "/erp/categorias/modificar";
  }
  if (pathname.startsWith("/erp/unidades")) {
    return "/erp/unidades/modificar";
  }
  if (pathname.startsWith("/erp/servicios")) {
    return "/erp/servicios/modificar";
  }
  if (pathname.startsWith("/erp/calendario")) {
    return "/erp/calendario/modificar";
  }
  return "/erp/modificar";
}

// Verifica acceso usando permisos almacenados en DB.
// Si la tabla no existe aún, hace fallback al canAccess hardcodeado.
async function checkAccess(
  supabase: any,
  role: string,
  pathname: string
): Promise<boolean> {
  if (role === "admin") return true;
  // "/erp" es la página de aterrizaje (Agenda) para todo usuario autenticado.
  // Siempre debe estar permitida para evitar loops de redirección cuando un
  // rol todavía no tiene permisos configurados en role_permissions.
  if (pathname === "/erp") return true;

  try {
    const { data, error } = await supabase
      .from("role_permissions")
      .select("path")
      .eq("role_name", role);

    if (error) throw error;

    const paths: string[] = (data || []).map((p: { path: string }) => p.path);
    
    // Si la ruta es de escritura, requerimos explícitamente el permiso de modificación
    if (isWritePath(pathname)) {
      const requiredModifyPath = getModifyPathForPathname(pathname);
      return paths.includes(requiredModifyPath);
    }

    return paths.some(p => pathname === p || pathname.startsWith(p + "/"));
  } catch {
    // Fallback: usa la función hardcodeada si la DB no está disponible
    return canAccess(role as UserRole, pathname);
  }
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  addSecurityHeaders(res);

  // ── Proteger rutas del panel de administración ─────────────────────────
  if (pathname.startsWith("/erp") && pathname !== "/erp/login") {
    const supabase = buildSupabaseClient(req, res);
    let user = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch (err) {
      console.error("Error fetching user in middleware path check:", err);
    }

    if (!user) {
      const url = req.nextUrl.clone();
      url.pathname = "/erp/login";
      url.searchParams.set("redirect", pathname);
      const redirect = NextResponse.redirect(url);
      addSecurityHeaders(redirect);
      return redirect;
    }

    const role = (user.app_metadata?.role as string) ?? "recepcionista";

    if (!(await checkAccess(supabase, role, pathname))) {
      const url = req.nextUrl.clone();
      url.pathname = "/erp";
      url.searchParams.set("denied", "1");
      const redirect = NextResponse.redirect(url);
      addSecurityHeaders(redirect);
      return redirect;
    }
  }

  // ── Proteger rutas API del panel admin ─────────────────────────────────
  if (pathname.startsWith("/api/admin")) {
    const supabase = buildSupabaseClient(req, res);
    let user = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch (err) {
      console.error("Error fetching user in middleware API check:", err);
    }

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401, headers: res.headers }
      );
    }

    const role = (user.app_metadata?.role as string) ?? "recepcionista";
    const adminOnlyApis = [
      "/api/admin/usuarios",
      "/api/admin/auditoria",
    ];
    if (adminOnlyApis.some(r => pathname.startsWith(r)) && role !== "admin") {
      return NextResponse.json(
        { error: "Acceso denegado: se requiere rol admin" },
        { status: 403, headers: res.headers }
      );
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/erp/:path*",
    "/api/admin/:path*",
    "/((?!_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};
