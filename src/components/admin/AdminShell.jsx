"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  Tags,
  Sparkles,
  ExternalLink,
  LogOut,
  Loader2,
  BarChart3,
  Wand2,
  Wallet,
  Percent,
  Truck,
  Menu,
  X,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/products/new", label: "Create with AI", icon: Wand2 },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/discounts", label: "Discount Sessions", icon: Percent },
  { href: "/admin/hero", label: "Hero Slides", icon: Sparkles },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/logistics", label: "Logistics", icon: Truck },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/expenses", label: "Expenses", icon: Wallet },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function isActive(href, pathname) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/products") {
    return (
      pathname.startsWith("/admin/products") &&
      pathname !== "/admin/products/new"
    );
  }
  return pathname.startsWith(href);
}

function NavLinks({ pathname, onNavigate }) {
  return (
    <nav className="flex-1 min-h-0 py-3 overflow-y-auto overscroll-contain scrollbar-ghost">
      {NAV.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
              active
                ? "bg-white/10 text-white font-medium"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            <item.icon size={17} className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ onLogout, loggingOut }) {
  return (
    <div className="px-5 py-4 border-t border-white/10 space-y-1 shrink-0">
      <Link
        href="/"
        className="flex items-center gap-2 text-xs text-white/60 hover:text-white"
      >
        <ExternalLink size={14} /> View Website
      </Link>
      <button
        onClick={onLogout}
        disabled={loggingOut}
        className="flex items-center gap-2 text-xs text-white/60 hover:text-white disabled:opacity-50"
      >
        {loggingOut ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <LogOut size={14} />
        )}
        Log Out
      </button>
    </div>
  );
}

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-background flex">
      <aside className="hidden sm:flex flex-col w-60 shrink-0 bg-ink text-white h-dvh sticky top-0 overflow-hidden z-30">
        <div className="px-5 py-5 border-b border-white/10 shrink-0">
          <p className="font-display text-lg">Admin</p>
          <p className="text-xs text-white/50 mt-0.5">Store Manager</p>
        </div>
        <NavLinks pathname={pathname} />
        <SidebarFooter onLogout={handleLogout} loggingOut={loggingOut} />
      </aside>

      {mobileOpen && (
        <div className="sm:hidden fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex flex-col w-64 max-w-[85vw] h-full bg-ink text-white overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-white/10 shrink-0 flex items-center justify-between">
              <div>
                <p className="font-display text-lg">Admin</p>
                <p className="text-xs text-white/50 mt-0.5">Store Manager</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
                aria-label="Close sidebar"
              >
                <X size={18} />
              </button>
            </div>
            <NavLinks
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
            <SidebarFooter onLogout={handleLogout} loggingOut={loggingOut} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 min-h-dvh">
        <div className="sm:hidden sticky top-0 z-20 bg-ink text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="p-1.5 -ml-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              aria-label="Open sidebar"
            >
              <Menu size={18} />
            </button>
            <p className="font-display text-sm">Admin</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/70 text-xs">
              Website
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-white/70 text-xs disabled:opacity-50"
            >
              {loggingOut ? "..." : "Logout"}
            </button>
          </div>
        </div>

        <main className="p-5 sm:p-8 h-screen overflow-auto">{children}</main>
      </div>
    </div>
  );
}
