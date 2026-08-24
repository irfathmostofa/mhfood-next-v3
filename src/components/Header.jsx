"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  ShoppingBag,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { useCart } from "@/hooks/useCart";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/track", label: "Track Order" },
];

export default function Header({ theme, categories = [] }) {
  const router = useRouter();
  const pathname = usePathname();

  const { uniqueItemCount, totalQuantity, openCart } = useCart();

  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState(null);

  const inputRef = useRef(null);

  /* ============================================================
     CATEGORY NAV SCROLL / OVERFLOW
  ============================================================ */

  const navScrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkNavOverflow = () => {
    const el = navScrollRef.current;
    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;

    // Run once on mount / whenever categories change
    checkNavOverflow();

    el.addEventListener("scroll", checkNavOverflow, { passive: true });
    window.addEventListener("resize", checkNavOverflow);

    // Catch cases where fonts/images load late and change width
    const resizeObserver = new ResizeObserver(checkNavOverflow);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", checkNavOverflow);
      window.removeEventListener("resize", checkNavOverflow);
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const scrollNav = (direction) => {
    const el = navScrollRef.current;
    if (!el) return;

    const amount = Math.max(el.clientWidth * 0.7, 200);
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  /* ============================================================
     HYDRATION FIX
  ============================================================ */

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ============================================================
     SEARCH FOCUS
  ============================================================ */

  useEffect(() => {
    if (searchOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 80);

      return () => clearTimeout(timer);
    }
  }, [searchOpen]);

  /* ============================================================
     KEYBOARD SHORTCUTS
  ============================================================ */

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMenuOpen(false);
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();

        setSearchOpen(true);
        setMenuOpen(false);
        inputRef.current?.focus();
      }
    }

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  /* ============================================================
     ROUTE CHANGE
  ============================================================ */

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  /* ============================================================
     SEARCH SUBMIT
  ============================================================ */

  function submitSearch(e) {
    e.preventDefault();

    const q = query.trim();

    setSearchOpen(false);

    router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
  }

  /* ============================================================
     STORE NAME
  ============================================================ */

  const storeName = theme?.store_name || "Your Store";

  /* ============================================================
     LOGO
  ============================================================ */

  const logo = (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mhfood.png" alt={storeName} className="h-9 sm:h-10 w-auto" />

      <span className="text-lg sm:text-xl font-semibold tracking-tight text-ink">
        {storeName}
      </span>
    </Link>
  );

  /* ============================================================
     ACTIONS
  ============================================================ */

  const actions = (
    <div className="flex items-center gap-1">
      {/* Search (mobile/tablet only — desktop has the center search bar) */}
      <button
        type="button"
        onClick={() => setSearchOpen((value) => !value)}
        aria-label="Search"
        className="lg:hidden p-2.5 rounded-full text-muted hover:text-ink hover:bg-primary/5 transition-colors"
      >
        <Search size={20} />
      </button>

      {/* Cart */}
      <button
        type="button"
        onClick={openCart}
        aria-label="Open cart"
        className="relative p-2.5 rounded-full text-muted hover:text-ink hover:bg-primary/5 transition-colors"
      >
        <ShoppingBag size={20} />

        {/* Hydration-safe cart count - shows unique items */}
        {mounted && uniqueItemCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-accent text-white">
            {uniqueItemCount > 99 ? "99+" : uniqueItemCount}
          </span>
        )}
      </button>
    </div>
  );

  // Get parent categories (no parent_id)
  const parentCategories = categories.filter((c) => !c.parent_id);

  // Get child categories for a parent
  const getChildCategories = (parentId) => {
    return categories.filter((c) => c.parent_id === parentId);
  };

  // Toggle category expansion
  const toggleCategory = (categoryId) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  return (
    <>
      <header className="bg-surface/90 backdrop-blur-md border-b border-line">
        {/* ========================================================
          ANNOUNCEMENT BAR
      ========================================================= */}

        {theme?.show_announcement_bar && theme?.announcement_text && (
          <div className="bg-primary text-white text-center text-xs sm:text-sm font-medium px-4 py-2">
            {theme.announcement_text}
          </div>
        )}

        {/* ========================================================
          MAIN HEADER
      ========================================================= */}

        <div className="max-w-[97%] mx-auto px-4 sm:px-6 lg:px-8 h-16 lg:h-20 grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-6">
          {/* Logo */}
          {logo}

          {/* ======================================================
            DESKTOP SEARCH (center, always visible)
        ======================================================= */}

          <form
            onSubmit={submitSearch}
            className="hidden md:flex items-center max-w-lg w-full mx-auto overflow-hidden rounded-full border border-line bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 transition-shadow"
          >
            <Search size={16} className="ml-4 text-muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for food..."
              className="w-full px-3 py-2.5 bg-transparent text-sm outline-none text-ink placeholder-muted"
            />
            <button
              type="submit"
              aria-label="Submit search"
              className="shrink-0 m-1 px-4 py-2 rounded-full bg-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Search
            </button>
          </form>

          {/* ======================================================
            RIGHT SIDE BUTTONS
        ======================================================= */}

          <div className="flex items-center gap-1 justify-end shrink-0">
            <div className="hidden lg:flex items-center">
              <Link
                href="/shop"
                className="px-3 py-2 rounded-full text-[13px] font-medium text-muted hover:text-ink hover:bg-primary/5 transition-colors"
              >
                Shop
              </Link>
              <Link
                href="/track"
                className="px-3 py-2 rounded-full text-[13px] font-medium text-muted hover:text-ink hover:bg-primary/5 transition-colors"
              >
                Track Order
              </Link>
            </div>

            {actions}

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2.5 rounded-full text-muted hover:text-ink hover:bg-primary/5 transition-colors"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================
          BOTTOM NAV - CATEGORY MENU (Desktop only, sticky)
      ========================================================= */}

      {parentCategories.length > 0 && (
        <div className="hidden lg:block sticky top-0 z-40 border-b border-line bg-primary shadow-sm">
          <div className="max-w-[97%] mx-auto px-4 sm:px-6 lg:px-8 relative">
            {/* Left scroll button */}
            {canScrollLeft && (
              <button
                type="button"
                onClick={() => scrollNav("left")}
                aria-label="Scroll categories left"
                className="absolute left-0 top-0 h-12 w-10 z-10 flex items-center justify-center bg-gradient-to-r from-primary via-primary/95 to-transparent text-white"
              >
                <span className="flex items-center justify-center h-7 w-7 rounded-full bg-white/15 hover:bg-white/25 transition-colors">
                  <ChevronLeft size={16} />
                </span>
              </button>
            )}

            <nav
              ref={navScrollRef}
              className="flex items-center gap-0 h-12 overflow-x-auto scroll-smooth"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              <style jsx>{`
                nav::-webkit-scrollbar {
                  display: none;
                }
              `}</style>

              {parentCategories.map((cat) => {
                const childCategories = getChildCategories(cat.id);
                const hasChildren = childCategories.length > 0;

                return (
                  <div
                    key={cat.id}
                    className="relative group h-full flex items-center gap-2 shrink-0"
                  >
                    <Link
                      href={`/shop?category=${cat.id}`}
                      className="flex items-center gap-1 pr-4 py-2 text-sm font-medium text-white hover:text-accent hover:bg-primary/5 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {cat.name}
                      {hasChildren && (
                        <ChevronDown size={14} className="text-muted" />
                      )}
                    </Link>

                    {/* Sub-categories dropdown */}
                    {hasChildren && (
                      <div className="absolute top-full left-0 mt-0 min-w-[200px] bg-surface rounded-b-lg shadow-xl border border-t-0 border-line py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        {childCategories.map((child) => (
                          <Link
                            key={child.id}
                            href={`/shop?category=${child.id}`}
                            className="block px-4 py-2.5 text-sm text-ink hover:text-accent hover:bg-primary/5 transition-colors"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Right scroll button */}
            {canScrollRight && (
              <button
                type="button"
                onClick={() => scrollNav("right")}
                aria-label="Scroll categories right"
                className="absolute right-0 top-0 h-12 w-10 z-10 flex items-center justify-center bg-gradient-to-l from-primary via-primary/95 to-transparent text-white"
              >
                <span className="flex items-center justify-center h-7 w-7 rounded-full bg-white/15 hover:bg-white/25 transition-colors">
                  <ChevronRight size={16} />
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MOBILE / TABLET SEARCH
      ========================================================= */}

      {searchOpen && (
        <div className="md:hidden px-4 pb-4">
          <form onSubmit={submitSearch} className="relative">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />

            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for food..."
              className="w-full pl-10 pr-10 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/30 border border-line bg-background"
            />

            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            >
              <X size={18} />
            </button>
          </form>
        </div>
      )}

      {/* ========================================================
          MOBILE / TABLET OVERLAY
      ========================================================= */}

      <div
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 bg-black/40 z-[60] transition-opacity lg:hidden ${
          menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* ========================================================
          MOBILE / TABLET DRAWER
      ========================================================= */}

      {menuOpen && (
        <aside
          className="fixed top-0 right-0 h-[100dvh] w-72 max-w-[85vw] bg-surface z-[70] shadow-2xl flex flex-col lg:hidden"
          aria-label="Mobile navigation"
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-5 h-16 border-b border-line shrink-0">
            <span className="font-display text-lg text-ink truncate pr-3">
              {storeName}
            </span>

            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="p-1.5 rounded-full hover:bg-primary/5 text-ink shrink-0"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {NAV_LINKS.map((link) => {
              const active =
                link.to === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.to);

              return (
                <Link
                  key={link.to}
                  href={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-3 py-3 text-sm font-medium rounded-xl transition-colors ${
                    active
                      ? "text-accent bg-primary/5"
                      : "text-ink hover:text-accent hover:bg-primary/5"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            {/* Categories in Hamburger Menu */}
            {categories.length > 0 && (
              <>
                <div className="px-3 pt-4 pb-2 text-xs font-semibold text-muted uppercase tracking-wider">
                  Categories
                </div>
                {parentCategories.map((cat) => {
                  const childCategories = getChildCategories(cat.id);
                  const hasChildren = childCategories.length > 0;
                  const isExpanded = expandedCategory === cat.id;

                  return (
                    <div key={cat.id}>
                      <button
                        onClick={() => {
                          if (hasChildren) {
                            toggleCategory(cat.id);
                          } else {
                            router.push(`/shop?category=${cat.id}`);
                            setMenuOpen(false);
                          }
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-xl text-ink hover:text-accent hover:bg-primary/5 transition-colors"
                      >
                        <span>{cat.name}</span>
                        {hasChildren && (
                          <ChevronRight
                            size={16}
                            className={`transition-transform duration-200 ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          />
                        )}
                      </button>

                      {/* Sub-categories */}
                      {hasChildren && isExpanded && (
                        <div className="ml-4 space-y-1 border-l-2 border-line pl-3">
                          {childCategories.map((child) => (
                            <Link
                              key={child.id}
                              href={`/shop?category=${child.id}`}
                              onClick={() => setMenuOpen(false)}
                              className="block px-3 py-2 text-sm rounded-xl text-ink/80 hover:text-accent hover:bg-primary/5 transition-colors"
                            >
                              {child.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </nav>

          {/* Cart - Shows total quantity in button */}
          <div className="border-t border-line px-5 py-4 shrink-0">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                openCart();
              }}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              <ShoppingBag size={16} />
              View Cart
              {mounted && totalQuantity > 0 && (
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {totalQuantity}
                </span>
              )}
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
