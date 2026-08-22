"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/hooks/useCart";

export default function FloatingCart() {
  const { itemCount, totalAmount, openCart } = useCart();

  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label="View cart"
      className={`fixed right-3 sm:right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-2xl bg-accent text-white shadow-xl shadow-accent/30 hover:bg-accent/90 hover:scale-105 active:scale-95 transition-all duration-300 ${
        mounted && scrolled && itemCount > 0 ? "" : "pointer-events-none opacity-0"
      }`}
    >
      <span className="relative">
        <ShoppingBag size={22} />

        {mounted && itemCount > 0 && (
          <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-white text-accent">
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        )}
      </span>

      <span className="text-[11px] font-bold leading-none whitespace-nowrap">
        ৳{(mounted ? totalAmount : 0).toFixed(0)}
      </span>
    </button>
  );
}
