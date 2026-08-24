"use client";

import { useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard";

export default function BestSellers({ title, subtitle, products = [] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: products.length > 4, align: "start", skipSnaps: false },
    [
      Autoplay({
        delay: 4000,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
        stopOnFocusIn: false,
      }),
    ],
  );

  useEffect(() => {
    if (emblaApi) emblaApi.reInit();
  }, [emblaApi, products]);

  if (products.length === 0) return null;

  return (
    <section className="max-w-[97%] mx-auto px-5 py-10">
      <div className="flex items-end justify-between mb-6">
        <div className="px-1.5">
          <h2 className="font-display text-2xl sm:text-3xl text-ink">
            {title || "Best Selling Products"}
          </h2>
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
        {products.length > 4 && (
          <div className="hidden sm:flex items-center gap-2">
            <CarouselButton
              direction="prev"
              onClick={() => emblaApi?.scrollPrev()}
            />
            <CarouselButton
              direction="next"
              onClick={() => emblaApi?.scrollNext()}
            />
          </div>
        )}
      </div>

      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {products.map((product, rank) => (
            <div
              key={product.id}
              className="relative shrink-0 px-1.5 sm:px-2.5 basis-1/2 sm:basis-1/3 lg:basis-1/5"
            >
              {rank < 3 && (
                <span className="absolute top-2 left-4 z-10 px-2.5 py-0.5 rounded-full bg-accent text-white text-[10px] font-semibold shadow">
                  #{rank + 1} Best Seller
                </span>
              )}
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>

      {products.length > 4 && (
        <div className="sm:hidden flex items-center justify-center gap-3 mt-5">
          <CarouselButton
            direction="prev"
            onClick={() => emblaApi?.scrollPrev()}
          />
          <CarouselButton
            direction="next"
            onClick={() => emblaApi?.scrollNext()}
          />
        </div>
      )}
    </section>
  );
}

function CarouselButton({ direction, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={direction === "prev" ? "Previous" : "Next"}
      className="p-2 rounded-full border border-line text-ink hover:border-primary hover:bg-primary hover:text-white transition-colors"
    >
      {direction === "prev" ? (
        <ChevronLeft size={18} />
      ) : (
        <ChevronRight size={18} />
      )}
    </button>
  );
}
