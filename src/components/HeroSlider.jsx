"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

export default function HeroSlider({ slides = [] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    setCurrent(0);
  }, [slides]);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides]);

  if (slides.length === 0) return null;

  const slide = slides[current];

  return (
    <section className="relative w-full h-[400px] overflow-hidden">
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === current ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.image_url}
            alt={s.title || ""}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
          {(s.title || s.subtitle) && (
            <div className="absolute inset-0 flex items-center">
              <div className="max-w-7xl mx-auto w-full px-5 sm:px-10">
                <div className="text-white max-w-xl">
                  {s.title && (
                    <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl font-medium mb-3 leading-tight">
                      {s.title}
                    </h2>
                  )}
                  {s.subtitle && (
                    <p className="text-sm sm:text-lg text-white/90 max-w-md leading-relaxed">
                      {s.subtitle}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-7">
                    {s.link_url && (
                      <Link
                        href={s.link_url}
                        className="inline-flex items-center gap-2 px-7 py-3.5 bg-accent text-white text-sm font-semibold rounded-full hover:bg-white hover:text-ink transition-colors"
                      >
                        Shop now <ArrowRight size={16} />
                      </Link>
                    )}
                    <Link
                      href="/shop"
                      className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/40 text-white text-sm font-semibold rounded-full hover:bg-white/10 transition-colors"
                    >
                      Browse menu
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {slides.length > 1 && (
        <>
          <button
            onClick={() =>
              setCurrent((c) => (c - 1 + slides.length) % slides.length)
            }
            aria-label="Previous slide"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 backdrop-blur text-white hover:bg-white/35 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setCurrent((c) => (c + 1) % slides.length)}
            aria-label="Next slide"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 backdrop-blur text-white hover:bg-white/35 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === current ? "bg-white w-7" : "bg-white/50 w-2"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
