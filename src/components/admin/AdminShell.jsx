"use client";

import { useState } from "react";
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
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/products/new", label: "Create with AI", icon: Wand2 },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/hero", label: "Hero Slides", icon: Sparkles },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
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

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden sm:flex flex-col w-60 shrink-0 bg-ink text-white h-screen sticky top-0">
        <div className="px-6 py-6 border-b border-white/10">
          <p className="font-display text-lg">Admin</p>
          <p className="text-xs text-white/50 mt-0.5">Store Manager</p>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV.map((item) => {
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                  active
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-5 border-t border-white/10 space-y-1 shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-white/60 hover:text-white"
          >
            <ExternalLink size={14} /> View Website
          </Link>
          <button
            onClick={handleLogout}
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
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="sm:hidden sticky top-0 z-20 bg-ink text-white px-5 py-3 flex items-center justify-between">
          <p className="font-display text-sm">Admin</p>
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
        <div className="sm:hidden bg-background border-b border-line overflow-x-auto">
          <nav className="flex px-3 py-2 gap-1">
            {NAV.map((item) => {
              const active = isActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs ${
                    active
                      ? "bg-primary text-white"
                      : "text-ink bg-surface border border-line"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <main className="p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
