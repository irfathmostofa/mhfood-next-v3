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
  Zap,
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useReadableText } from "@/hooks/useReadableText";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  // { to: "/custom-order", label: "Custom Order" },
  { to: "/faq", label: "FAQ" },
  { to: "/track", label: "Track Order" },
];

/**
 * Renders any element on a background colour class and automatically sets
 * the text colour (white / near-black) with the best contrast against the
 * REAL rendered background. Children inherit that colour.
 */
function ReadableBg({
  as: Tag = "div",
  className = "",
  style,
  children,
  ...rest
}) {
  const ref = useRef(null);
  const { fg } = useReadableText(ref);
  return (
    <Tag
      ref={ref}
      className={className}
      style={{ ...style, color: fg }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default function Header({ theme, categories = [], liveSessions = [] }) {
  const router = useRouter();
  const pathname = usePathname();

  const { uniqueItemCount, totalQuantity, openCart } = useCart();

  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [hoverMenu, setHoverMenu] = useState(null);
  const hoverTimer = useRef(null);

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

    checkNavOverflow();

    el.addEventListener("scroll", checkNavOverflow, { passive: true });
    window.addEventListener("resize", checkNavOverflow);

    const resizeObserver = new ResizeObserver(checkNavOverflow);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", checkNavOverflow);
      window.removeEventListener("resize", checkNavOverflow);
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, liveSessions]);

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
    setHoverMenu(null);
  }, [pathname]);

  function openCategoryHover(categoryId, el) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const rect = el.getBoundingClientRect();
    setHoverMenu({
      id: categoryId,
      left: rect.left,
      top: rect.bottom,
    });
  }

  function closeCategoryHover() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoverMenu(null), 160);
  }

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    const hide = () => setHoverMenu(null);
    el.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);
    return () => {
      el.removeEventListener("scroll", hide);
      window.removeEventListener("resize", hide);
    };
  }, []);

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
     LOGO  (no fixed text colour: it inherits the readable colour)
  ============================================================ */

  const logo = (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {theme?.logo_image ? (
        <img
          src={theme?.logo_image || "/mhfood.png"}
          alt={storeName}
          className="h-9 sm:h-10 w-auto"
        />
      ) : (
        <span className="text-lg sm:text-xl font-semibold tracking-tight">
          {storeName}
        </span>
      )}
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
        className="lg:hidden p-2.5 rounded-full opacity-80 hover:opacity-100 hover:bg-current/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
      >
        <Search size={20} />
      </button>

      {/* Cart */}
      <button
        type="button"
        onClick={openCart}
        aria-label="Open cart"
        className="relative p-2.5 rounded-full opacity-90 hover:opacity-100 hover:bg-current/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
      >
        <ShoppingBag size={20} />

        {/* Hydration-safe cart count; badge picks its own readable text colour */}
        {mounted && uniqueItemCount > 0 && (
          <ReadableBg
            as="span"
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-accent ring-2 ring-primary"
          >
            {uniqueItemCount > 99 ? "99+" : uniqueItemCount}
          </ReadableBg>
        )}
      </button>
    </div>
  );

  const parentCategories = categories.filter((c) => !c.parent_id);

  const getChildCategories = (parentId) => {
    return categories.filter((c) => c.parent_id === parentId);
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  return (
    <>
      {/* ========================================================
          HEADER — background is the base (primary) colour
      ========================================================= */}
      <ReadableBg
        as="header"
        className="bg-primary border-b"
        style={{
          borderBottomColor:
            "color-mix(in srgb, currentColor 15%, transparent)",
        }}
      >
        {/* ANNOUNCEMENT BAR — subtle tint of the text colour, always readable */}
        {theme?.show_announcement_bar && theme?.announcement_text && (
          <div
            className="text-center text-xs sm:text-sm font-medium px-4 py-2"
            style={{
              backgroundColor:
                "color-mix(in srgb, currentColor 12%, transparent)",
            }}
          >
            {theme.announcement_text}
          </div>
        )}

        {/* MAIN HEADER */}
        <div className="max-w-[97%] mx-auto px-3 sm:px-5 lg:px-8 h-16 lg:h-20 grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-6">
          {logo}

          {/* DESKTOP SEARCH — keeps its own light surface so text stays visible */}
          <form
            onSubmit={submitSearch}
            className="hidden lg:flex items-center w-full overflow-hidden rounded-full border border-line bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 transition-shadow"
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
            <ReadableBg
              as="button"
              type="submit"
              aria-label="Submit search"
              className="shrink-0 m-1 px-4 py-2 rounded-full bg-primary text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Search
            </ReadableBg>
          </form>

          {/* RIGHT SIDE */}
          <div className="col-start-3 flex items-center gap-1 justify-end shrink-0">
            <div className="hidden lg:flex items-center gap-1">
              {/* Live sale badges — outlined in the text colour */}
              {liveSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/sale/${session.slug}`}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-semibold border border-current/40 hover:bg-current/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
                >
                  <Zap size={13} className="shrink-0" />
                  <span className="max-w-[120px] truncate">{session.name}</span>
                </Link>
              ))}

              {liveSessions.length > 0 && (
                <span
                  className="w-px h-5 mx-1 bg-current opacity-20"
                  aria-hidden="true"
                />
              )}

              {[
                { href: "/shop", label: "Shop" },
                { href: "/faq", label: "FAQ" },
                { href: "/track", label: "Track Order" },
              ].map(({ href, label }) => {
                const active =
                  pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`inline-flex items-center h-9 px-3 rounded-full text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current ${
                      active
                        ? "bg-current/15"
                        : "opacity-80 hover:opacity-100 hover:bg-current/10"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}

              {/* Custom Order — accent CTA with its own readable text */}
              {/* <ReadableBg
                as={Link}
                href="/custom-order"
                className="inline-flex items-center h-9 px-4 ml-1 rounded-full text-[13px] font-semibold bg-accent hover:bg-accent/90 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
              >
                Custom Order
              </ReadableBg> */}
            </div>

            {actions}

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="lg:hidden inline-flex items-center justify-center h-9 w-9 ml-1 rounded-full opacity-80 hover:opacity-100 hover:bg-current/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="lg:hidden w-full px-3 sm:px-5 pb-3">
            <form onSubmit={submitSearch} className="relative w-full">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              />

              {/* text-ink is required here: the input would otherwise
                  inherit the header's text colour on a light background */}
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for food..."
                className="w-full pl-10 pr-10 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/30 border border-line bg-surface text-ink placeholder-muted"
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
      </ReadableBg>

      {/* ========================================================
          CATEGORY MENU (Desktop only, sticky) — also base colour
      ========================================================= */}

      {theme?.show_header_categories !== false &&
        parentCategories.length > 0 && (
          <ReadableBg
            as="div"
            className="hidden lg:block sticky top-0 z-40 border-b border-line bg-primary shadow-sm"
          >
            <div className="max-w-[97%] mx-auto px-3 sm:px-5 lg:px-8 relative">
              {canScrollLeft && (
                <button
                  type="button"
                  onClick={() => scrollNav("left")}
                  aria-label="Scroll categories left"
                  className="absolute left-0 top-0 h-12 w-10 z-10 flex items-center justify-center bg-gradient-to-r from-primary via-primary/95 to-transparent"
                >
                  <span className="flex items-center justify-center h-7 w-7 rounded-full bg-current/15 hover:bg-current/25 transition-colors">
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
                  const isOpen = hoverMenu?.id === cat.id;

                  return (
                    <div
                      key={cat.id}
                      className="relative h-full flex items-center gap-2 shrink-0"
                      onMouseEnter={(e) =>
                        hasChildren &&
                        openCategoryHover(cat.id, e.currentTarget)
                      }
                      onMouseLeave={() => hasChildren && closeCategoryHover()}
                    >
                      <Link
                        href={`/shop?category=${cat.slug || cat.id}`}
                        className={`flex items-center gap-1 pr-4 py-2 text-sm font-medium whitespace-nowrap transition-opacity ${
                          isOpen
                            ? "opacity-100 underline underline-offset-4"
                            : "opacity-90 hover:opacity-100"
                        }`}
                      >
                        {cat.name}
                        {hasChildren && (
                          <ChevronDown
                            size={14}
                            className={`transition-transform opacity-70 ${isOpen ? "rotate-180" : ""}`}
                          />
                        )}
                      </Link>
                    </div>
                  );
                })}
              </nav>

              {canScrollRight && (
                <button
                  type="button"
                  onClick={() => scrollNav("right")}
                  aria-label="Scroll categories right"
                  className="absolute right-0 top-0 h-12 w-10 z-10 flex items-center justify-center bg-gradient-to-l from-primary via-primary/95 to-transparent"
                >
                  <span className="flex items-center justify-center h-7 w-7 rounded-full bg-current/15 hover:bg-current/25 transition-colors">
                    <ChevronRight size={16} />
                  </span>
                </button>
              )}
            </div>
          </ReadableBg>
        )}

      {hoverMenu &&
        (() => {
          const children = getChildCategories(hoverMenu.id);
          if (children.length === 0) return null;
          return (
            <div
              className="hidden lg:block fixed z-[90] min-w-[220px] pt-1"
              style={{ left: hoverMenu.left, top: hoverMenu.top }}
              onMouseEnter={() => {
                if (hoverTimer.current) clearTimeout(hoverTimer.current);
              }}
              onMouseLeave={closeCategoryHover}
            >
              <div className="bg-surface rounded-b-lg shadow-xl border border-line py-1">
                {children.map((child) => (
                  <Link
                    key={child.id}
                    href={`/shop?category=${child.slug || child.id}`}
                    className="block px-4 py-2.5 text-sm text-ink hover:text-accent hover:bg-primary/5 transition-colors"
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}

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
          MOBILE / TABLET DRAWER (own light surface, unchanged)
      ========================================================= */}

      {menuOpen && (
        <aside
          className="fixed top-0 right-0 h-[100dvh] w-72 max-w-[85vw] bg-surface z-[70] shadow-2xl flex flex-col lg:hidden"
          aria-label="Mobile navigation"
        >
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

          <nav className="flex-1 px-4 py-5 overflow-y-auto space-y-1">
            {liveSessions.length > 0 && (
              <>
                <p className="px-1 text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
                  Hot Deals
                </p>
                {liveSessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/sale/${session.slug}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-xl text-accent bg-accent/10 hover:bg-accent/20 transition-colors"
                  >
                    <Zap size={15} className="shrink-0" />
                    <span className="truncate">{session.name}</span>
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-accent/70 shrink-0">
                      Sale
                    </span>
                  </Link>
                ))}
              </>
            )}

            <p className="px-1 pt-3 text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
              Menu
            </p>
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
                  className={`flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                    active
                      ? "text-accent bg-primary/5"
                      : "text-ink/80 hover:text-ink hover:bg-primary/5"
                  }`}
                >
                  {active && (
                    <span className="w-1 h-4 rounded-full bg-accent" />
                  )}
                  {link.label}
                </Link>
              );
            })}

            {categories.length > 0 && (
              <>
                <p className="px-1 pt-3 text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
                  Shop by Category
                </p>
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
                            router.push(`/shop?category=${cat.slug || cat.id}`);
                            setMenuOpen(false);
                          }
                        }}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm rounded-xl text-ink/90 hover:text-accent hover:bg-primary/5 transition-colors"
                      >
                        <span className="truncate">{cat.name}</span>
                        {hasChildren && (
                          <ChevronRight
                            size={16}
                            className={`shrink-0 transition-transform duration-200 ${
                              isExpanded ? "rotate-90 text-accent" : ""
                            }`}
                          />
                        )}
                      </button>

                      {hasChildren && isExpanded && (
                        <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-line pl-3">
                          {childCategories.map((child) => (
                            <Link
                              key={child.id}
                              href={`/shop?category=${child.slug || child.id}`}
                              onClick={() => setMenuOpen(false)}
                              className="block px-3 py-2 text-sm rounded-xl text-ink/70 hover:text-accent hover:bg-primary/5 transition-colors"
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

          <div className="border-t border-line px-5 py-4 shrink-0">
            <ReadableBg
              as="button"
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
                <span className="bg-current/20 px-2 py-0.5 rounded-full text-xs">
                  {totalQuantity}
                </span>
              )}
            </ReadableBg>
          </div>
        </aside>
      )}
    </>
  );
}
