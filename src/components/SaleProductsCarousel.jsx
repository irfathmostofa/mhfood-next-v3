"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard";

export default function SaleProductsCarousel({ products = [] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start" });
  const [prevEnabled, setPrevEnabled] = useState(false);
  const [nextEnabled, setNextEnabled] = useState(false);
  const [selected, setSelected] = useState(0);
  const [perView, setPerView] = useState(2);

  useEffect(() => {
    function updatePerView() {
      if (window.innerWidth >= 768) {
        setPerView(4);
      } else if (window.innerWidth >= 640) {
        setPerView(3);
      } else {
        setPerView(2);
      }
    }

    updatePerView();
    window.addEventListener("resize", updatePerView);
    return () => window.removeEventListener("resize", updatePerView);
  }, []);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setPrevEnabled(emblaApi.canScrollPrev());
    setNextEnabled(emblaApi.canScrollNext());
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    const timer = setTimeout(onSelect, 200);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
      clearTimeout(timer);
    };
  }, [emblaApi, onSelect, products]);

  useEffect(() => {
    if (emblaApi) emblaApi.reInit();
  }, [emblaApi, products]);

  if (products.length === 0) return null;

  const pages = Math.max(1, Math.ceil(products.length / perView));
  const activePage = Math.min(Math.floor(selected / perView), pages - 1);
  const showControls = prevEnabled || nextEnabled;

  return (
    <div>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex items-stretch">
          {products.map((product) => (
            <div
              key={product.id}
              className="relative min-w-0 min-h-0 shrink-0 grow-0 basis-1/2 sm:basis-1/3 md:basis-1/4 px-1.5 sm:px-2.5"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>

      {showControls && (
        <div className="mt-4 sm:mt-5 flex items-center justify-center gap-4">
          <RailButton
            direction="prev"
            disabled={!prevEnabled}
            onClick={() => emblaApi?.scrollPrev()}
          />
          <div className="flex items-center gap-1.5">
            {Array.from({ length: pages }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide group ${i + 1}`}
                onClick={() =>
                  emblaApi?.scrollTo(Math.min(i * perView, products.length - 1))
                }
                className={`h-1.5 rounded-full transition-all ${
                  i === activePage
                    ? "w-5 bg-primary"
                    : "w-1.5 bg-primary/25 hover:bg-primary/40"
                }`}
              />
            ))}
          </div>
          <RailButton
            direction="next"
            disabled={!nextEnabled}
            onClick={() => emblaApi?.scrollNext()}
          />
        </div>
      )}
    </div>
  );
}

function RailButton({ direction, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Previous products" : "Next products"}
      className={`p-2 rounded-full border transition-colors ${
        disabled
          ? "border-line text-muted/40 cursor-not-allowed"
          : "border-line text-ink hover:border-primary hover:bg-primary hover:text-white"
      }`}
    >
      {direction === "prev" ? (
        <ChevronLeft size={16} />
      ) : (
        <ChevronRight size={16} />
      )}
    </button>
  );
}
