"use client";

import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function CategoriesGrid({ title, subtitle, limit, categories = [], countMap = {} }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(4);
  const sliderRef = useRef(null);

  useEffect(() => {
    function updateItemsPerView() {
      if (window.innerWidth < 640) {
        setItemsPerView(2);
      } else if (window.innerWidth < 1024) {
        setItemsPerView(4);
      } else {
        setItemsPerView(8);
      }
    }

    updateItemsPerView();
    window.addEventListener("resize", updateItemsPerView);
    return () => window.removeEventListener("resize", updateItemsPerView);
  }, []);

  useEffect(() => {
    // Reset to first slide when categories change
    setCurrentIndex(0);
  }, [categories]);

  const goToNext = () => {
    const maxIndex = Math.max(0, categories.length - itemsPerView);
    if (currentIndex < maxIndex) {
      setCurrentIndex(Math.min(currentIndex + itemsPerView, maxIndex));
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(Math.max(currentIndex - itemsPerView, 0));
    }
  };

  if (categories.length === 0) {
    return null;
  }

  const maxIndex = Math.max(0, categories.length - itemsPerView);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < maxIndex;

  // Calculate translateX properly
  const getTranslateX = () => {
    if (!sliderRef.current) return 0;
    const firstChild = sliderRef.current.children[0];
    if (!firstChild) return 0;

    const gap = window.innerWidth < 640 ? 16 : 24;
    const itemWidth = firstChild.offsetWidth;
    const offset = currentIndex * (itemWidth + gap);
    return -offset;
  };

  return (
    <section className="max-w-8xl mx-auto px-5 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-medium text-ink">
            {title || "Shop by Category"}
          </h2>
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
        {categories.length > itemsPerView && (
          <div className="flex gap-2">
            <button
              onClick={goToPrev}
              disabled={!canGoPrev}
              className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all ${
                canGoPrev
                  ? "border-ink/20 hover:border-ink/50 hover:bg-ink/5 hover:scale-105 cursor-pointer"
                  : "border-ink/10 opacity-30 cursor-not-allowed"
              }`}
              aria-label="Previous categories"
            >
              <ChevronLeft
                size={20}
                className={canGoPrev ? "text-ink/70" : "text-ink/30"}
              />
            </button>
            <button
              onClick={goToNext}
              disabled={!canGoNext}
              className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all ${
                canGoNext
                  ? "border-ink/20 hover:border-ink/50 hover:bg-ink/5 hover:scale-105 cursor-pointer"
                  : "border-ink/10 opacity-30 cursor-not-allowed"
              }`}
              aria-label="Next categories"
            >
              <ChevronRight
                size={20}
                className={canGoNext ? "text-ink/70" : "text-ink/30"}
              />
            </button>
          </div>
        )}
      </div>

      <div className="relative overflow-hidden">
        <div
          ref={sliderRef}
          className="flex gap-4 sm:gap-6 transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(${getTranslateX()}px)` }}
        >
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/shop?category=${cat.id}`}
              className="group flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-18px)] lg:w-[calc(12.5%-21px)]"
            >
              <div className="aspect-square bg-primary/5 overflow-hidden rounded-lg relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    cat.image_url ||
                    "https://placehold.co/400x400?text=Category"
                  }
                  alt={cat.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="mt-2 text-center">
                <p className="font-medium text-sm sm:text-base text-ink group-hover:text-accent transition-colors trancate max-w-full overflow-hidden whitespace-nowrap text-ellipsis">
                  {cat.name}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Slide indicators */}
      {categories.length > itemsPerView && (
        <div className="flex justify-center gap-1.5 mt-6">
          {Array.from({
            length: Math.ceil(categories.length / itemsPerView),
          }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i * itemsPerView)}
              className={`h-1.5 rounded-full transition-all ${
                Math.floor(currentIndex / itemsPerView) === i
                  ? "bg-ink w-6"
                  : "bg-ink/20 w-4 hover:bg-ink/40"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
