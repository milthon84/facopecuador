import Link from "next/link";
import {
  CalendarDays, LayoutDashboard, Users, Clock, Ban,
  Package, FileText, UserCog, ShieldCheck, ChevronRight,
  Settings, ShoppingCart, FileBarChart2, Shield, Tag, Ruler, Stethoscope,
  Building2, Landmark, Wallet, CircleDollarSign, CreditCard, Banknote, FileKey,
  Layers, GraduationCap, Award, Presentation, Megaphone, Globe, Newspaper
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SignOutButton from "@/components/SignOutButton";
import AdminMobileNav from "@/components/AdminMobileNav";
import GlobalLoadingOverlay from "@/components/GlobalLoadingOverlay";
import type { UserRole } from "@/lib/roles";
import { ROLE_LABELS, ROLE_COLORS, NAV_ITEMS, NAV_SECTIONS } from "@/lib/roles";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

const ICONS: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={16} />,
  CalendarDays:    <CalendarDays size={16} />,
  Users:           <Users size={16} />,
  Clock:           <Clock size={16} />,
  Ban:             <Ban size={16} />,
  Package:         <Package size={16} />,
  FileText:        <FileText size={16} />,
  UserCog:         <UserCog size={16} />,
  ShieldCheck:     <ShieldCheck size={16} />,
  Settings:        <Settings size={16} />,
  ShoppingCart:    <ShoppingCart size={16} />,
  FileBarChart2:   <FileBarChart2 size={16} />,
  Shield:          <Shield size={16} />,
  Tag:             <Tag size={16} />,
  Ruler:           <Ruler size={16} />,
  Stethoscope:     <Stethoscope size={16} />,
  Building2:       <Building2 size={16} />,
  Landmark:        <Landmark size={16} />,
  Wallet:            <Wallet size={16} />,
  Banknote:          <Banknote size={16} />,
  FileKey:           <FileKey size={16} />,
  CircleDollarSign:  <CircleDollarSign size={16} />,
  CreditCard:        <CreditCard size={16} />,
  Layers:            <Layers size={16} />,
  GraduationCap:     <GraduationCap size={16} />,
  Award:             <Award size={16} />,
  Presentation:      <Presentation size={16} />,
  Megaphone:         <Megaphone size={16} />,
  Globe:             <Globe size={16} />,
  Newspaper:         <Newspaper size={16} />,
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.error("Error fetching user in AdminLayout:", err);
  }

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";

  const requireChange = user?.user_metadata?.require_password_change === true;
  if (!user || requireChange || pathname === "/erp/cambiar-contrasena") return <>{children}</>;

  const role = (user.app_metadata?.role as string | undefined) ?? "admin";

  // Datos del rol y permisos desde DB (con fallback a valores hardcodeados)
  let profileName: string | null = null;
  let roleLabel = ROLE_LABELS[role as UserRole] ?? role;
  let roleColor = ROLE_COLORS[role as UserRole] ?? "bg-gray-100 text-gray-800 border-gray-200";
  let allowedPaths: string[] | null = null; // null = admin (acceso total)

  try {
    const adminClient = createAdminClient();

    const [profileRes, roleRes, permsRes] = await Promise.all([
      adminClient.from("user_profiles").select("full_name").eq("id", user.id).single()
        .then(r => r as { data: { full_name: string } | null }),
      adminClient.from("system_roles").select("label, color").eq("name", role).single()
        .then(r => r as { data: { label: string; color: string } | null }),
      role !== "admin"
        ? adminClient.from("role_permissions").select("path").eq("role_name", role)
          .then(r => r as { data: { path: string }[] | null })
        : Promise.resolve(null),
    ]);

    profileName = profileRes.data?.full_name ?? null;

    if (roleRes.data) {
      roleLabel = roleRes.data.label;
      roleColor = roleRes.data.color;
    }

    if (role !== "admin" && permsRes?.data) {
      allowedPaths = permsRes.data.map(p => p.path);
    }
  } catch { /* usa fallbacks hardcodeados */ }

  const displayName = profileName || user.email?.split("@")[0] || "Usuario";

  // Filtrar nav: admin ve todo, otros solo lo que tienen permiso en DB
  const visibleNav = NAV_ITEMS.filter(item => {
    if (role === "admin") return true;
    if (allowedPaths !== null) {
      if (item.href === "/erp/inventario/transacciones") {
        return allowedPaths.includes("/erp/inventario") || allowedPaths.includes("/erp/inventario/transacciones");
      }
      return allowedPaths.includes(item.href);
    }
    return item.roles.includes(role as UserRole); // fallback
  });

  return (
    <div className="min-h-screen bg-lilac-50/30 text-ink-900">
      {/* Header móvil */}
      <header className="sticky top-0 z-40 shadow-sm">
        <div className="md:hidden bg-white border-b border-gray-100">
          <div className="px-4 py-2.5 flex items-center gap-3">
            <Link href="/erp" className="flex-1">
              <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain" />
            </Link>
            <div className="w-8 h-8 rounded-full bg-lilac-100 border border-lilac-200 flex items-center justify-center text-xs font-bold text-lilac-700 shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Header desktop */}
        <div className="hidden md:block bg-ink-900 text-white">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
            <Link href="/erp" className="flex items-center gap-3">
              <div className="bg-white px-2 py-0.5 rounded flex items-center justify-center h-8">
                <img src="/logo.png" alt="Logo" className="h-6 w-auto object-contain" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-bold text-gold-500 text-sm">Gestión Clínica</span>
                <span className="text-white/40 text-[10px] font-medium uppercase tracking-wide">
                  Sistema de administración
                </span>
              </div>
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium text-white/90">{displayName}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleColor}`}>
                  {roleLabel}
                </span>
              </div>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row">
        {/* Sidebar — solo desktop */}
        <nav className="hidden md:block md:w-60 md:min-h-[calc(100vh-52px)] border-r border-lilac-100 bg-white shadow-sm">
          <div className="p-3 flex flex-col gap-1">
            {NAV_SECTIONS.map(section => {
              const items = visibleNav.filter(i => i.section === section);
              if (!items.length) return null;
              return (
                <NavGroup key={section} label={section}>
                  {items.map(item => (
                    <NavItem key={item.href} href={item.href} icon={ICONS[item.icon]}>
                      {item.label}
                    </NavItem>
                  ))}
                </NavGroup>
              );
            })}
          </div>
        </nav>

        <main className="flex-1 p-4 sm:p-6 min-w-0 pb-24 md:pb-6">{children}</main>
      </div>

      {/* Navegación inferior — solo móvil */}
      <AdminMobileNav
        role={role}
        roleLabel={roleLabel}
        roleColor={roleColor}
        displayName={displayName}
        allowedPaths={allowedPaths}
      />
      <GlobalLoadingOverlay />
    </div>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 mb-2">
      <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wider px-3 mb-1 mt-2">
        {label}
      </p>
      {children}
    </div>
  );
}

function NavItem({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink-800 hover:bg-lilac-50 hover:text-lilac-700 whitespace-nowrap transition-colors group"
    >
      <span className="text-ink-400 group-hover:text-lilac-600 transition-colors">{icon}</span>
      <span className="flex-1">{children}</span>
      <ChevronRight size={12} className="opacity-0 group-hover:opacity-40 transition-opacity" />
    </Link>
  );
}
