"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/hooks/useCart";

export default function FloatingCart() {
  const { uniqueItemCount, totalQuantity, totalAmount, openCart } = useCart();

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

  // Show cart only if there's at least one unique item
  const hasItems = uniqueItemCount > 0;

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label="View cart"
      className={`fixed right-1 sm:right-1 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-md bg-accent text-white shadow-xl shadow-accent/30 hover:bg-accent/90 hover:scale-105 active:scale-95 transition-all duration-300 ${
        mounted && scrolled && hasItems ? "" : "pointer-events-none opacity-0"
      }`}
    >
      <span className="relative">
        <ShoppingBag size={22} />

        {mounted && hasItems && (
          <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-white text-accent">
            {uniqueItemCount > 99 ? "99+" : uniqueItemCount}
          </span>
        )}
      </span>

      <div className="flex flex-col items-center leading-tight">
        <span className="text-[11px] font-bold whitespace-nowrap">
          ৳{(mounted ? totalAmount : 0).toFixed(0)}
        </span>
      </div>
    </button>
  );
}
