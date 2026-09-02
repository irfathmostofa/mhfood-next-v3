import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import ProductCard from "./ProductCard";
import SaleCountdown from "./SaleCountdown";

const STYLES = {
  flash: {
    wrap: "bg-gradient-to-br from-[#c1121f] via-[#e5383b] to-[#f48c06]",
    chip: "bg-white/15 text-white",
    title: "text-white",
    sub: "text-white/80",
    btn: "bg-white text-[#c1121f] hover:bg-white/90",
  },
  blackfriday: {
    wrap: "bg-gradient-to-br from-[#0d0d0d] via-[#1a1a1a] to-[#3d2b00]",
    chip: "bg-[#d4af37]/20 text-[#f5d76e]",
    title: "text-[#f5d76e]",
    sub: "text-white/70",
    btn: "bg-[#d4af37] text-black hover:bg-[#e8c547]",
  },
  sale: {
    wrap: "bg-gradient-to-br from-primary via-[#2d3a32] to-accent",
    chip: "bg-white/15 text-white",
    title: "text-white",
    sub: "text-white/80",
    btn: "bg-white text-primary hover:bg-white/90",
  },
};

export default function FlashSaleSection({ sessions = [] }) {
  const live = (sessions || []).filter((s) => s.products?.length > 0);
  if (live.length === 0) return null;

  return (
    <>
      {live.map((session) => {
        const theme = STYLES[session.style] || STYLES.flash;
        return (
          <section
            key={session.id}
            className="max-w-[94%] mx-auto px-2 py-6 sm:py-10"
          >
            <div
              className={`rounded-3xl overflow-hidden shadow-lg ${theme.wrap}`}
            >
              <div className="px-5 sm:px-8 py-6 sm:py-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] px-3 py-1 rounded-full ${theme.chip}`}
                  >
                    <Zap size={12} /> Limited time
                  </span>
                  <h2
                    className={`font-display text-3xl sm:text-4xl mt-3 ${theme.title}`}
                  >
                    {session.name}
                  </h2>
                  {session.subtitle && (
                    <p className={`text-sm mt-1 ${theme.sub}`}>
                      {session.subtitle}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <p
                      className={`text-[10px] uppercase tracking-wider mb-1 ${theme.sub}`}
                    >
                      Ends in
                    </p>
                    <SaleCountdown endsAt={session.ends_at} light />
                  </div>
                  <Link
                    href={`/sale/${session.slug}`}
                    className={`inline-flex items-center gap-1 text-sm font-semibold px-4 py-2 rounded-full transition-colors ${theme.btn}`}
                  >
                    Shop now <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="bg-background/95 px-3 sm:px-5 py-5 sm:py-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-5">
                  {session.products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
