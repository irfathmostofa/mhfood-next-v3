"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Check,
  Minus,
  Phone,
  MessageCircle,
  Plus,
  ShoppingBag,
  Zap,
  Facebook,
  Twitter,
  Send,
  Link2,
  Share2,
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { trackViewContent, trackAddToCart } from "@/components/Analytics";
import StarRating from "./StarRating";
import ReviewsList from "./ReviewsList";
import { toHtml } from "@/lib/richtext";

export default function ProductView({ product, siteSettings = null }) {
  const router = useRouter();
  const { addItem } = useCart();
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedMsg, setAddedMsg] = useState(false);
  const [selected, setSelected] = useState({});

  useEffect(() => {
    trackViewContent({
      content_type: "product",
      content_ids: [product.id],
      content_name: product.name,
      value: Number(product.price),
      currency: "BDT",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const images = product.product_images || [];

  // Group variant rows into selectable groups
  const groups = useMemo(() => {
    const map = {};
    const variants = product.variants || [];
    variants.forEach((v) => {
      if (!map[v.name]) map[v.name] = [];
      map[v.name].push(v);
    });
    return Object.entries(map).map(([name, options]) => ({
      name,
      options: options.sort((a, b) => a.sort_order - b.sort_order),
    }));
  }, [product.variants]);

  // Auto-select the first (in-stock) option of every variant group by default
  useEffect(() => {
    setSelected((prev) => {
      const next = { ...prev };
      groups.forEach((g) => {
        if (!next[g.name]) {
          const firstInStock = g.options.find((o) => Number(o.stock) > 0);
          next[g.name] = (firstInStock || g.options[0])?.id;
        }
      });
      return next;
    });
  }, [groups]);

  const allSelected =
    groups.length === 0 || groups.every((g) => selected[g.name]);

  const selectedOptions = groups
    .map(
      (g) =>
        groups &&
        selected[g.name] &&
        g.options.find((o) => o.id === selected[g.name]),
    )
    .filter(Boolean);

  const priceAdjustment = selectedOptions.reduce(
    (sum, o) => sum + Number(o.price_adjustment || 0),
    0,
  );
  const price = Number(product.price) + priceAdjustment;

  const variantStock = allSelected
    ? selectedOptions.reduce(
        (min, o) => Math.min(min, Number(o.stock)),
        Infinity,
      )
    : Infinity;
  const effectiveStock =
    groups.length === 0
      ? Number(product.stock)
      : allSelected
        ? variantStock === Infinity
          ? Number(product.stock)
          : variantStock
        : Number(product.stock);

  const outOfStock = effectiveStock <= 0;

  function selectVariant(groupName, optionId) {
    setSelected((prev) => ({ ...prev, [groupName]: optionId }));
  }

  function handleAddToCart() {
    if (outOfStock || !allSelected) return;
    const selection = groups.map((g) => {
      const opt = g.options.find((o) => o.id === selected[g.name]);
      return {
        variant_id: opt.id,
        name: g.name,
        value: opt.value,
        price_adjustment: opt.price_adjustment,
      };
    });
    addItem(product, quantity, selection);
    trackAddToCart({
      content_type: "product",
      content_ids: [product.id],
      content_name: product.name,
      value:
        Number(product.price) +
        selection.reduce((s, o) => s + Number(o.price_adjustment || 0), 0),
      currency: "BDT",
      quantity,
    });
    setAddedMsg(true);
    setTimeout(() => setAddedMsg(false), 2000);
  }

  function handleBuyNow() {
    if (outOfStock || !allSelected) return;
    const selection = groups.map((g) => {
      const opt = g.options.find((o) => o.id === selected[g.name]);
      return {
        variant_id: opt.id,
        name: g.name,
        value: opt.value,
        price_adjustment: opt.price_adjustment,
      };
    });
    addItem(product, quantity, selection);
    router.push("/checkout");
  }

  // Check if WhatsApp and Phone are enabled using existing schema fields
  const showWhatsApp =
    siteSettings?.whatsapp_enabled && siteSettings?.whatsapp_number;
  const showPhone = siteSettings?.store_phone; // Using store_phone from your schema
  const whatsappNumber = siteSettings?.whatsapp_number || "";
  const phoneNumber = siteSettings?.store_phone || "";

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Gallery - Thumbnails on left for desktop */}
        <div>
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Thumbnails - Left side on desktop, horizontal on mobile */}
            {images.length > 1 && (
              <div className="flex lg:flex-col gap-2 order-2 lg:order-1 lg:w-20">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImage(i)}
                    className={`relative w-full aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                      i === activeImage ? "border-accent" : "border-transparent"
                    }`}
                  >
                    <Image
                      src={img.image_url}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Main Image */}
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-primary/5 flex-1 order-1 lg:order-2">
              <Image
                src={
                  images[activeImage]?.image_url ||
                  "https://placehold.co/600x600?text=No+Image"
                }
                alt={product.name}
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 95vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        {/* Details */}
        <div>
          {product.categories?.name && (
            <p className="text-xs uppercase tracking-wide text-muted mb-2">
              {product.categories.name}
            </p>
          )}
          <h1 className="font-display text-2xl sm:text-3xl text-ink mb-3">
            {product.name}
          </h1>

          <div className="flex items-center gap-3 mb-4">
            <StarRating rating={product.avg_rating} />
            <span className="text-sm text-muted">
              {product.review_count} review
              {product.review_count === 1 ? "" : "s"}
            </span>
            {product.total_sold > 0 && (
              <span className="text-sm text-muted">
                · {product.total_sold} sold
              </span>
            )}
          </div>

          <p className="text-2xl font-semibold text-accent mb-4">
            ৳{price.toFixed(2)}
          </p>

          {/* Variant groups */}
          {groups.length > 0 && (
            <div className="space-y-4 mb-6">
              {groups.map((g) => (
                <div key={g.name}>
                  <p className="text-sm font-medium text-ink mb-2">{g.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {g.options.map((opt) => {
                      const active = selected[g.name] === opt.id;
                      const disabled = Number(opt.stock) <= 0;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => selectVariant(g.name, opt.id)}
                          disabled={disabled}
                          className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                            active
                              ? "bg-primary text-white border-primary"
                              : disabled
                                ? "border-line text-muted line-through opacity-60 cursor-not-allowed"
                                : "border-line text-ink hover:border-primary"
                          }`}
                        >
                          {opt.value}
                          {Number(opt.price_adjustment) > 0 &&
                            ` (+৳${Number(opt.price_adjustment)})`}
                          {Number(opt.price_adjustment) < 0 &&
                            ` (−৳${Math.abs(Number(opt.price_adjustment))})`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {groups.length > 0 && !allSelected && (
            <p className="text-xs text-muted mb-4">
              Please select all options above to continue.
            </p>
          )}

          {outOfStock ? (
            <p className="text-sm font-medium text-red-500 mb-4">
              Out of stock
            </p>
          ) : (
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center border border-line rounded-full">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="w-9 h-9 flex items-center justify-center text-ink hover:bg-primary/5 rounded-full transition-colors"
                >
                  <Minus size={16} />
                </button>
                <span className="w-8 text-center text-sm text-ink">
                  {quantity}
                </span>
                <button
                  onClick={() =>
                    setQuantity((q) => Math.min(effectiveStock, q + 1))
                  }
                  aria-label="Increase quantity"
                  className="w-9 h-9 flex items-center justify-center text-ink hover:bg-primary/5 rounded-full transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              <span className="text-xs text-muted">
                {effectiveStock} in stock
              </span>
            </div>
          )}

          <div className="hidden lg:flex gap-3">
            <button
              onClick={handleAddToCart}
              disabled={outOfStock || !allSelected}
              className="flex-1 btn btn-outline"
            >
              {addedMsg ? <Check size={16} /> : <ShoppingBag size={16} />}
              {addedMsg ? "Added" : "Add to Cart"}
            </button>
            <button
              onClick={handleBuyNow}
              disabled={outOfStock || !allSelected}
              className="flex-1 btn btn-accent"
            >
              <Zap size={16} />
              Buy Now
            </button>
          </div>

          {/* WhatsApp & Call Order Buttons */}
          {(showWhatsApp || showPhone) && (
            <div className="mt-6 pt-6 border-t border-line">
              <p className="text-sm font-medium text-ink mb-3">Quick Order</p>
              <div className="flex flex-col sm:flex-row gap-3">
                {showWhatsApp && (
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                      `Hi, I'm interested in "${product.name}". Could you please provide more information?`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                  >
                    <MessageCircle size={20} />
                    Order via WhatsApp
                  </a>
                )}

                {showPhone && (
                  <a
                    href={`tel:${phoneNumber}`}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-[#0088CC] text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                  >
                    <Phone size={20} />
                    Call to Order
                  </a>
                )}
              </div>
            </div>
          )}

          <ShareBar product={product} />
        </div>
      </div>
      {/* Full Description Section */}
      {product.description && (
        <section className="mt-16 pt-8 border-t border-line">
          <h2 className="font-display text-2xl text-ink mb-6">Description</h2>
          <div
            className="prose prose-sm max-w-none text-muted leading-relaxed"
            dangerouslySetInnerHTML={{ __html: toHtml(product.description) }}
          />
        </section>
      )}

      {/* Reviews */}
      <section className="mt-16 pt-8 border-t border-line">
        <h2 className="font-display text-2xl text-ink mb-6">Reviews</h2>
        <ReviewsList
          reviews={product.reviews || []}
          avgRating={product.avg_rating}
          reviewCount={product.review_count}
        />
      </section>

      {/* Spacer so the mobile sticky bar never covers page content */}
      <div className="lg:hidden h-24" aria-hidden="true" />

      {/* Mobile sticky buy bar */}
      <div className="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-surface/95 backdrop-blur border-t border-line px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        {outOfStock ? (
          <p className="text-sm font-medium text-red-500 text-center py-3">
            Out of stock
          </p>
        ) : (
          <div className="flex items-center gap-3 max-w-[97%] mx-auto">
            <div className="shrink-0 leading-tight">
              <p className="text-[10px] text-muted uppercase tracking-wide">
                Price
              </p>
              <p className="text-base font-semibold text-accent">
                ৳{price.toFixed(2)}
              </p>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={!allSelected}
              className="flex-1 btn btn-outline btn-sm h-11"
            >
              {addedMsg ? <Check size={16} /> : <ShoppingBag size={16} />}
              {addedMsg ? "Added" : "Add to Cart"}
            </button>
            <button
              onClick={handleBuyNow}
              disabled={!allSelected}
              className="flex-1 btn btn-accent btn-sm h-11"
            >
              <Zap size={16} />
              Buy Now
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function ShareBar({ product }) {
  const [copied, setCopied] = useState(false);

  function shareUrl() {
    if (typeof window !== "undefined") return window.location.href;
    const base = process.env.NEXT_PUBLIC_SITE_URL || "";
    return `${base}/product/${product.slug}`;
  }

  function shareText() {
    return `${product.name} — order it online`;
  }

  function openShare(url) {
    window.open(url, "_blank", "noopener,noreferrer,width=640,height=520");
  }

  function copyLink() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(shareUrl()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const buttons = [
    {
      label: "Share on Facebook",
      onClick: () =>
        openShare(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            shareUrl(),
          )}`,
        ),
      className: "bg-[#1877F2] hover:bg-[#166FE5]",
      icon: <Facebook size={16} />,
    },
    {
      label: "Share on WhatsApp",
      onClick: () =>
        openShare(
          `https://wa.me/?text=${encodeURIComponent(
            `${shareText()} ${shareUrl()}`,
          )}`,
        ),
      className: "bg-[#25D366] hover:bg-[#1FB857]",
      icon: <WhatsAppIcon />,
    },
    {
      label: "Share on X (Twitter)",
      onClick: () =>
        openShare(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(
            shareText(),
          )}&url=${encodeURIComponent(shareUrl())}`,
        ),
      className: "bg-[#14171A] hover:bg-black",
      icon: <Twitter size={16} />,
    },
    {
      label: "Share on Telegram",
      onClick: () =>
        openShare(
          `https://t.me/share/url?url=${encodeURIComponent(
            shareUrl(),
          )}&text=${encodeURIComponent(shareText())}`,
        ),
      className: "bg-[#229ED9] hover:bg-[#1e8fc4]",
      icon: <Send size={16} />,
    },
  ];

  return (
    <div className="mt-6 pt-6 border-t border-line">
      <p className="flex items-center gap-2 text-sm font-medium text-ink mb-3">
        <Share2 size={15} /> Share this product
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={b.onClick}
            aria-label={b.label}
            className={`flex items-center justify-center w-10 h-10 rounded-full text-white transition-colors ${b.className}`}
          >
            {b.icon}
          </button>
        ))}
        <button
          type="button"
          onClick={copyLink}
          aria-label="Copy link"
          className="flex items-center justify-center gap-2 h-10 px-4 rounded-full border border-line text-ink hover:border-primary transition-colors"
        >
          {copied ? <Check size={15} /> : <Link2 size={15} />}
          <span className="text-xs font-medium">
            {copied ? "Copied!" : "Copy link"}
          </span>
        </button>
      </div>
    </div>
  );
}
