"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp } from "lucide-react";

export default function BackToTop({ settings }) {
  const pathname = usePathname();
  const isProductPage = /^\/product\/.+/.test(pathname || "");

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 400);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const contactCount = [
    settings?.whatsapp_enabled && settings?.whatsapp_number,
    settings?.messenger_enabled && settings?.messenger_link,
  ].filter(Boolean).length;

  const bottomOffset = 20 + contactCount * 56 + (contactCount - 1) * 12 + 12;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      style={{ "--bb": `${bottomOffset}px` }}
      className={`fixed right-5 z-40 group flex items-center transition-all duration-300 ${
        isProductPage
          ? "bottom-[calc(var(--bb)+76px)] lg:bottom-[var(--bb)]"
          : "bottom-[var(--bb)]"
      } ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <span className="hidden sm:block text-xs font-semibold text-ink bg-surface/95 backdrop-blur border border-line rounded-full px-3 py-1.5 shadow-lg opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 pointer-events-none">
        Back to top
      </span>

      <span className="w-11 h-11 rounded-full bg-accent text-white shadow-lg shadow-accent/30 flex items-center justify-center border border-white/20 hover:scale-110 hover:shadow-xl hover:shadow-accent/40 active:scale-95 transition-all duration-200">
        <ArrowUp size={18} />
      </span>
    </button>
  );
}
