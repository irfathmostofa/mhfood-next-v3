"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function HeroSlider({ slides = [] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: slides.length > 1, align: "start", duration: 28 },
    slides.length > 1
      ? [Autoplay({ delay: 6500, stopOnInteraction: false, stopOnMouseEnter: true })]
      : [],
  );
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (emblaApi) emblaApi.reInit();
  }, [emblaApi, slides]);

  if (slides.length === 0) return null;

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((s) => {
            const href = (s.link_url || "").trim();
            const alt = (s.title || "").trim() || "Featured offer";

            const media = (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.image_url}
                alt={alt}
                className="absolute inset-0 w-full h-full object-cover"
              />
            );

            return (
              <div
                key={s.id}
                className="relative min-w-0 shrink-0 grow-0 basis-full h-[250px] sm:h-[300px] lg:h-[350px]"
              >
                {href ? (
                  <Link href={href} className="absolute inset-0 block">
                    {media}
                  </Link>
                ) : (
                  media
                )}
              </div>
            );
          })}
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => emblaApi?.scrollPrev()}
            aria-label="Previous slide"
            className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 inline-flex items-center justify-center rounded-full bg-white/90 text-ink shadow-md hover:bg-white transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => emblaApi?.scrollNext()}
            aria-label="Next slide"
            className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 inline-flex items-center justify-center rounded-full bg-white/90 text-ink shadow-md hover:bg-white transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => emblaApi?.scrollTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 sm:h-2 rounded-full transition-all ${
                  i === selected
                    ? "bg-white w-6 sm:w-8"
                    : "bg-white/55 w-1.5 sm:w-2 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
