"use client";

import { useEffect } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function CategoriesGrid({
  title,
  subtitle,
  categories = [],
}) {
  const canLoop = categories.length > 4;
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: canLoop, align: "start", skipSnaps: false, containScroll: "trimSnaps" },
    canLoop
      ? [
          Autoplay({
            delay: 4000,
            stopOnInteraction: false,
            stopOnMouseEnter: true,
            stopOnFocusIn: false,
          }),
        ]
      : [],
  );

  useEffect(() => {
    if (emblaApi) emblaApi.reInit();
  }, [emblaApi, categories]);

  if (categories.length === 0) return null;

  return (
    <section className="max-w-[95%] mx-auto px-2 py-6 sm:py-10">
      <div className="flex items-end justify-between mb-4 sm:mb-6">
        <div className="px-1.5">
          <h2 className="font-display text-xl sm:text-2xl lg:text-3xl text-ink">
            {title || "Shop by Category"}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted mt-1">{subtitle}</p>
          )}
        </div>
        {canLoop && (
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
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="min-w-0  shrink-0 grow-0 basis-1/3 sm:basis-1/4 lg:basis-[12.5%] px-1.5 sm:px-2.5"
            >
              <Link
                href={`/shop?category=${cat.slug || cat.id}`}
                className="group block"
              >
                <div className="aspect-square bg-primary/5 overflow-hidden rounded-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      cat.image_url ||
                      "https://placehold.co/400x400?text=Category"
                    }
                    alt={cat.name}
                    loading="lazy"
                    className="w-full rounded-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <p className="mt-2 text-center font-medium text-sm sm:text-base text-ink group-hover:text-accent transition-colors truncate">
                  {cat.name}
                </p>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {canLoop && (
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
