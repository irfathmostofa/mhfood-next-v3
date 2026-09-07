"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

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
            const primaryUrl = (s.link_url || "").trim();
            const primaryLabel = (s.button_label || "").trim();
            const secondaryUrl = (s.button_2_url || "").trim();
            const secondaryLabel = (s.button_2_label || "").trim();
            const title = (s.title || "").trim();
            const subtitle = (s.subtitle || "").trim();
            const hasCopy = Boolean(title || subtitle);
            const showPrimary = Boolean(primaryUrl && primaryLabel);
            const showSecondary = Boolean(secondaryUrl && secondaryLabel);
            const hasButtons = showPrimary || showSecondary;
            const hasOverlay = hasCopy || hasButtons;
            const bannerHref = !hasOverlay && primaryUrl ? primaryUrl : "";

            const media = (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.image_url}
                  alt={title || "Featured offer"}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {hasOverlay && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10 sm:bg-gradient-to-r sm:from-black/75 sm:via-black/35 sm:to-transparent" />
                )}
                {hasOverlay && (
                  <div className="relative z-10 flex h-full items-end sm:items-center pointer-events-none">
                    <div className="w-full px-5 pb-12 pt-16 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
                      <div className="max-w-xl text-white">
                        {title && (
                          <h2 className="font-display text-[1.65rem] leading-[1.15] sm:text-4xl lg:text-5xl font-medium tracking-tight">
                            {title}
                          </h2>
                        )}
                        {subtitle && (
                          <p className="mt-2.5 sm:mt-3.5 text-sm sm:text-base lg:text-lg text-white/90 leading-relaxed max-w-md">
                            {subtitle}
                          </p>
                        )}
                        {hasButtons && (
                          <div
                            className={`flex flex-wrap items-center gap-2.5 sm:gap-3 pointer-events-auto ${
                              hasCopy ? "mt-4 sm:mt-6" : ""
                            }`}
                          >
                            {showPrimary && (
                              <Link
                                href={primaryUrl}
                                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-white hover:text-ink transition-colors"
                              >
                                {primaryLabel} <ArrowRight size={15} />
                              </Link>
                            )}
                            {showSecondary && (
                              <Link
                                href={secondaryUrl}
                                className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-white/10 px-5 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold text-white backdrop-blur-sm hover:bg-white hover:text-ink transition-colors"
                              >
                                {secondaryLabel}
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            );

            return (
              <div
                key={s.id}
                className="relative min-w-0 shrink-0 grow-0 basis-full h-[300px] sm:h-[400px] lg:h-[500px]"
              >
                {bannerHref ? (
                  <Link href={bannerHref} className="absolute inset-0 block">
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
