"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingBag, Check } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { trackAddToCart } from "@/components/Analytics";

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const image = product.product_images?.[0]?.image_url;
  const outOfStock = Number(product.stock) === 0;
  const rating = Number(product.avg_rating || 0);
  const reviewCount = Number(product.review_count || 0);

  function handleAdd(e) {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) return;
    addItem(product, 1);
    trackAddToCart({
      content_type: "product",
      content_ids: [product.id],
      content_name: product.name,
      value: Number(product.price),
      currency: "BDT",
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group relative block bg-surface border border-line rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
    >
      {/* Image */}
      <div className="relative aspect-square bg-primary/5 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image || "https://placehold.co/400x400?text=No+Image"}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {outOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white/90 text-ink text-xs font-semibold px-3 py-1.5 rounded-full">
              Out of stock
            </span>
          </div>
        )}
        {/* Quick add */}
        {!outOfStock && (
          <button
            onClick={handleAdd}
            aria-label="Add to cart"
            className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white/95 text-ink shadow-lg flex items-center justify-center hover:bg-accent hover:text-white transition-colors opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 sm:opacity-100 sm:translate-y-0"
          >
            {added ? <Check size={17} /> : <ShoppingBag size={17} />}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5 sm:p-4">
        {product.categories?.name && (
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted mb-1">
            {product.categories.name}
          </p>
        )}
        <h3 className="text-sm font-medium text-ink truncate">{product.name}</h3>

        <div className="mt-1.5 flex items-end justify-between gap-2">
          <div>
            <p className="text-base font-semibold text-accent">
              ৳{Number(product.price).toFixed(2)}
            </p>
            {product.unit && (
              <p className="text-[11px] text-muted">{product.unit}</p>
            )}
          </div>
          {reviewCount > 0 && (
            <p className="text-xs text-muted flex items-center gap-1 shrink-0">
              <span className="text-accent">★</span>
              {rating.toFixed(1)} ({reviewCount})
            </p>
          )}
        </div>

        {!outOfStock && (
          <button
            onClick={handleAdd}
            disabled={added}
            className="mt-3 w-full btn bg-primary/5 text-primary text-xs px-3 py-2.5 rounded-xl hover:bg-primary hover:text-white transition-colors sm:hidden"
          >
            {added ? (
              <>
                <Check size={14} /> Added to cart
              </>
            ) : (
              <>
                <ShoppingBag size={14} /> Add to Cart
              </>
            )}
          </button>
        )}
      </div>
    </Link>
  );
}
