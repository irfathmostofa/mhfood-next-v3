"use client";

import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

export default function CategoriesGrid({
  title,
  subtitle,
  limit,
  categories = [],
  countMap = {},
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(2);
  const sliderRef = useRef(null);
  const autoPlayTimerRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Update items per view based on screen size
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

  // Create extended array for infinite loop (duplicate items)
  const getExtendedCategories = useCallback(() => {
    if (categories.length === 0) return [];
    // Duplicate items to create seamless loop
    return [...categories, ...categories, ...categories];
  }, [categories]);

  const extendedCategories = getExtendedCategories();
  const totalSlides = categories.length;

  // Calculate max index for infinite scroll
  const getMaxIndex = useCallback(() => {
    return extendedCategories.length - itemsPerView;
  }, [extendedCategories.length, itemsPerView]);

  // Handle smooth infinite scrolling
  const handleTransitionEnd = useCallback(() => {
    setIsTransitioning(false);

    // If we're at the end of the first set, jump to the middle
    if (currentIndex >= totalSlides * 2) {
      setIsTransitioning(true);
      setCurrentIndex(currentIndex - totalSlides);
      setTimeout(() => {
        setIsTransitioning(false);
      }, 50);
    }
    // If we're at the beginning of the first set, jump to the middle
    else if (currentIndex < totalSlides && currentIndex > 0) {
      setIsTransitioning(true);
      setCurrentIndex(currentIndex + totalSlides);
      setTimeout(() => {
        setIsTransitioning(false);
      }, 50);
    }
  }, [currentIndex, totalSlides]);

  // Navigation functions - slide one item at a time
  const goToNext = useCallback(() => {
    if (categories.length <= itemsPerView) return;

    const maxIndex = getMaxIndex();
    const nextIndex = currentIndex + 1;

    if (nextIndex > maxIndex) {
      // If we're at the end, jump to start (seamless loop)
      setCurrentIndex(0);
    } else {
      setCurrentIndex(nextIndex);
    }
  }, [currentIndex, getMaxIndex, categories.length, itemsPerView]);

  const goToPrev = useCallback(() => {
    if (categories.length <= itemsPerView) return;

    const prevIndex = currentIndex - 1;

    if (prevIndex < 0) {
      // If we're at the start, jump to end (seamless loop)
      setCurrentIndex(getMaxIndex());
    } else {
      setCurrentIndex(prevIndex);
    }
  }, [currentIndex, getMaxIndex, categories.length, itemsPerView]);

  // Auto-play functionality - slide one at a time
  useEffect(() => {
    if (!isHovering && categories.length > itemsPerView && !isTransitioning) {
      autoPlayTimerRef.current = setInterval(() => {
        goToNext();
      }, 3000); // Change slide every 3 seconds
    }

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [isHovering, goToNext, categories.length, itemsPerView, isTransitioning]);

  // Reset to middle when categories change
  useEffect(() => {
    if (categories.length > 0) {
      setCurrentIndex(totalSlides);
    }
  }, [categories, totalSlides]);

  if (categories.length === 0) {
    return null;
  }

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < getMaxIndex();

  // Calculate translateX properly - slide one item at a time
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
    <section className="max-w-[94%] mx-auto px-2 py-6 sm:py-10">
      <div className="mb-4 sm:mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-medium text-ink">
            {title || "Shop by Category"}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted mt-1">{subtitle}</p>
          )}
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

      <div
        className="relative overflow-hidden min-h-[140px] sm:min-h-[180px]"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div
          ref={sliderRef}
          className="flex gap-4 sm:gap-6 transition-transform duration-700 ease-in-out"
          style={{
            transform: `translateX(${getTranslateX()}px)`,
            transition: isTransitioning
              ? "none"
              : "transform 700ms ease-in-out",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {extendedCategories.map((cat, index) => (
            <Link
              key={`${cat.id}-${index}`}
              href={`/shop?category=${cat.slug || cat.id}`}
              className="group flex-shrink-0 w-[calc(33%-10px)] sm:w-[calc(25%-18px)] lg:w-[calc(12.5%-21px)]"
            >
              <div className="aspect-square bg-primary/5 overflow-hidden rounded-lg relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    cat.image_url ||
                    "https://placehold.co/400x400?text=Category"
                  }
                  alt={cat.name}
                  width={400}
                  height={400}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="mt-2 text-center">
                <p className="font-medium text-sm sm:text-base text-ink group-hover:text-accent transition-colors truncate max-w-full overflow-hidden whitespace-nowrap text-ellipsis">
                  {cat.name}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
