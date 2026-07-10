"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Users, Clock, Ban,
  Package, FileText, UserCog, ShieldCheck, X, Menu,
  LogOut, Settings, ShoppingCart, FileBarChart2, Shield, Tag, Ruler, Stethoscope,
  Building2, Landmark, Wallet, CircleDollarSign, CreditCard, Banknote, FileKey,
  Layers, GraduationCap, Award, Presentation, Megaphone, Globe
} from "lucide-react";
import { NAV_ITEMS } from "@/lib/roles";
import { createClient } from "@/lib/supabase/client";

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, CalendarDays, Users, Clock, Ban,
  Package, FileText, UserCog, ShieldCheck, Settings,
  ShoppingCart, FileBarChart2, Shield, Tag, Ruler, Stethoscope,
  Building2, Landmark, Wallet, CircleDollarSign, CreditCard, Banknote, FileKey,
  Layers, GraduationCap, Award, Presentation, Megaphone, Globe
};

interface Props {
  role: string;
  roleLabel: string;
  roleColor: string;
  displayName: string;
  allowedPaths: string[] | null; // null = admin (acceso total)
}

export default function AdminMobileNav({ role, roleLabel, roleColor, displayName, allowedPaths }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const visibleNav = NAV_ITEMS.filter(item => {
    if (role === "admin" || allowedPaths === null) return true;
    if (item.href === "/erp/inventario/transacciones") {
      return allowedPaths.includes("/erp/inventario") || allowedPaths.includes("/erp/inventario/transacciones");
    }
    return allowedPaths.includes(item.href);
  });

  const bottomItems = visibleNav.slice(0, 2);

  function isActive(href: string) {
    return href === "/erp" ? pathname === "/erp" : pathname.startsWith(href);
  }

  async function logout() {
    const supabase = createClient();
    try {
      await fetch("/api/admin/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } catch {}
    await supabase.auth.signOut();
    window.location.replace("/erp/login");
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer deslizable */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white z-50 md:hidden rounded-t-2xl shadow-2xl transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-sm">{displayName}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleColor}`}>
              {roleLabel}
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-xl hover:bg-gray-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-3 max-h-[55vh] overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = ICON_MAP[item.icon];
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl mb-1 transition-colors ${
                  active ? "bg-lilac-50 text-lilac-700" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {Icon && <Icon size={20} className={active ? "text-lilac-500" : "text-gray-400"} />}
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="px-3 pb-10 border-t border-gray-100 pt-2">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Cerrar sesión</span>
          </button>
        </div>
      </div>

      {/* Barra de navegación inferior */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30 md:hidden safe-bottom">
        <div className="flex items-stretch">
          {bottomItems.map((item) => {
            const Icon = ICON_MAP[item.icon];
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors ${
                  active ? "text-lilac-600" : "text-gray-400"
                }`}
              >
                {Icon && <Icon size={22} />}
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setOpen(true)}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-gray-400"
          >
            <Menu size={22} />
            <span className="text-[10px] font-medium">Menú</span>
          </button>
        </div>
      </nav>
    </>
  );
}
