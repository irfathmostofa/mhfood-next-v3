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

  // Number of contact bubbles docked below this button (WhatsApp / Messenger).
  const contactCount = [
    settings?.whatsapp_enabled && settings?.whatsapp_number,
    settings?.messenger_enabled && settings?.messenger_link,
  ].filter(Boolean).length;

  // Column of 44px buttons with 10px gaps sits at the bottom; this button
  // docks 10px above that column so nothing ever overlaps.
  const lift =
    contactCount > 0 ? contactCount * 44 + (contactCount - 1) * 10 + 10 : 0;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      style={{ "--lift": `${lift}px` }}
      className={`fixed right-4 z-40 group flex items-center transition-all duration-300 ${
        isProductPage
          ? "bottom-[calc(var(--lift)+88px)] lg:bottom-[calc(var(--lift)+20px)]"
          : "bottom-[calc(var(--lift)+20px)]"
      } ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-3 pointer-events-none"
      }`}
    >
      <span className="absolute right-full mr-3 text-xs font-medium text-ink bg-surface/95 backdrop-blur border border-line rounded-lg px-3 py-1.5 shadow-md opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 pointer-events-none whitespace-nowrap">
        Back to top
      </span>

      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-surface/95 backdrop-blur border border-line text-ink shadow-sm hover:bg-accent hover:text-white hover:border-transparent hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all duration-200">
        <ArrowUp size={19} />
      </span>
    </button>
  );
}
