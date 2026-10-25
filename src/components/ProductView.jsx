"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Phone,
  MessageCircle,
  Plus,
  X,
  Facebook,
  Twitter,
  Send,
  Link2,
  Share2,
  ZoomIn,
  MapPin,
  Truck,
  Banknote,
  RotateCcw,
  Shield,
  Info,
  ShoppingCart,
  Zap,
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { trackViewContent, trackAddToCart } from "@/components/Analytics";
import { productPixelPayload } from "@/lib/pixel";
import { useToast } from "@/components/Toast";
import { useSiteSettings } from "@/components/SiteSettingsContext";
import { supabase } from "@/lib/supabase";
import LocationSelect from "@/components/LocationSelect";
import { formatLocation } from "@/lib/bangladeshLocations";
import { chargeForLocation } from "@/lib/deliveryCharge";
import { useDeliveryLocation } from "@/hooks/useDeliveryLocation";
import StarRating from "./StarRating";
import ReviewsList from "./ReviewsList";

const ProductEnquiryModal = dynamic(
  () => import("@/components/ProductEnquiryModal"),
  { ssr: false },
);

export default function ProductView({
  product,
  categories = [],
  descriptionHtml = "",
  reviews = [],
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const { success } = useToast();
  const siteSettings = useSiteSettings();
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedMsg, setAddedMsg] = useState(false);
  const [selected, setSelected] = useState({});
  const [activeTab, setActiveTab] = useState("description");
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [deliveryLocations, setDeliveryLocations] = useState([]);
  const delivery = useDeliveryLocation(deliveryLocations);

  useEffect(() => {
    trackViewContent(productPixelPayload(product));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  useEffect(() => {
    supabase
      .from("delivery_locations")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then((res) => setDeliveryLocations(res.error ? [] : res.data || []));
  }, []);

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
  const regularPrice = Number(product.regular_price) || 0;
  const discount =
    regularPrice > price
      ? Math.round(((regularPrice - price) / regularPrice) * 100)
      : 0;

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
  const showEnquiry =
    outOfStock && siteSettings?.enquiry_enabled !== false;

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
    success(`${product.name} added to cart`);
    const unitPrice =
      Number(product.price) +
      selection.reduce((s, o) => s + Number(o.price_adjustment || 0), 0);
    trackAddToCart(
      productPixelPayload(product, { quantity, value: unitPrice }),
    );
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
    const unitPrice =
      Number(product.price) +
      selection.reduce((s, o) => s + Number(o.price_adjustment || 0), 0);
    trackAddToCart(
      productPixelPayload(product, { quantity, value: unitPrice }),
    );
    router.push("/checkout");
  }

  const showWhatsApp =
    siteSettings?.whatsapp_enabled && siteSettings?.whatsapp_number;
  const showPhone = siteSettings?.store_phone;
  const whatsappNumber = siteSettings?.whatsapp_number || "";
  const phoneNumber = siteSettings?.store_phone || "";
  const crumbs = buildBreadcrumbs(product, categories);

  return (
    <>
      <nav className="flex flex-wrap items-center gap-1 text-xs text-muted mb-3 overflow-hidden">
        <Link href="/" className="hover:text-accent shrink-0">
          Home
        </Link>
        {crumbs.map((c, i) => (
          <span key={`${c.href}-${c.label}-${i}`} className="flex items-center gap-1 min-w-0">
            <span className="text-line">/</span>
            <Link href={c.href} className="hover:text-accent truncate">
              {c.label}
            </Link>
          </span>
        ))}
        <span className="flex items-center gap-1 min-w-0">
          <span className="text-line">/</span>
          <span className="text-ink truncate">{product.name}</span>
        </span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)_300px] gap-5 lg:gap-6 items-start">
        <div className="bg-surface">
          <ProductImageMagnifier
            src={
              images[activeImage]?.image_url ||
              "https://placehold.co/600x600?text=No+Image"
            }
            alt={product.name}
            images={images}
            activeImage={activeImage}
            setActiveImage={setActiveImage}
          />
          {images.length > 1 && (
            <div className="flex items-center gap-1 mt-3">
              <button
                type="button"
                onClick={() =>
                  setActiveImage(
                    (i) => (i - 1 + images.length) % images.length,
                  )
                }
                aria-label="Previous image"
                className="w-7 h-16 shrink-0 flex items-center justify-center text-muted hover:text-ink"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
                {images.map((img, i) => (
                  <button
                    key={img.id || img.image_url || i}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={`relative w-14 h-14 shrink-0 overflow-hidden border ${
                      i === activeImage
                        ? "border-accent"
                        : "border-line hover:border-primary/40"
                    }`}
                  >
                    <Image
                      src={img.image_url}
                      alt=""
                      fill
                      sizes="56px"
                      loading="lazy"
                      quality={60}
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setActiveImage((i) => (i + 1) % images.length)}
                aria-label="Next image"
                className="w-7 h-16 shrink-0 flex items-center justify-center text-muted hover:text-ink"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <h1 className="text-[20px] sm:text-[22px] leading-snug font-medium text-ink">
            {product.name}
          </h1>

          <div className="flex flex-wrap items-center gap-2 mt-2 mb-3">
            <StarRating rating={product.avg_rating} />
            <button
              type="button"
              onClick={() => setActiveTab("reviews")}
              className="text-sm text-accent hover:underline"
            >
              Ratings {product.review_count || 0}
            </button>
            {product.total_sold > 0 && (
              <span className="text-sm text-muted">
                · {product.total_sold} sold
              </span>
            )}
          </div>

          <p className="text-sm text-muted mb-4">
            Brand:{" "}
            {product.brands?.name ? (
              <Link
                href={`/shop?brand=${encodeURIComponent(product.brands.slug || "")}`}
                className="text-accent hover:underline"
              >
                {product.brands.name}
              </Link>
            ) : (
              <span className="text-ink">No Brand</span>
            )}
            {product.categories?.name ? (
              <>
                {" | "}
                <Link
                  href={`/shop?category=${encodeURIComponent(product.categories.slug || "")}`}
                  className="text-accent hover:underline"
                >
                  More from {product.categories.name}
                </Link>
              </>
            ) : null}
          </p>

          <div className="py-3 border-y border-line mb-4">
            <div className="flex items-end gap-3">
              <p className="text-[28px] sm:text-[32px] leading-none font-semibold text-accent">
                ৳{Math.round(price)}
              </p>
              {regularPrice > price && (
                <>
                  <p className="text-sm text-muted line-through pb-0.5">
                    ৳{Math.round(regularPrice)}
                  </p>
                  <p className="text-sm text-ink pb-0.5">-{discount}%</p>
                </>
              )}
            </div>
          </div>

          {product.short_description && (
            <p className="text-sm text-muted leading-relaxed mb-4">
              {product.short_description}
            </p>
          )}

          {groups.length > 0 && (
            <div className="space-y-4 mb-5">
              {groups.map((g) => {
                const colorLike = isColorGroup(g.name);
                const current = g.options.find((o) => o.id === selected[g.name]);
                return (
                  <div
                    key={g.name}
                    className="grid grid-cols-[88px_1fr] gap-3 items-start"
                  >
                    <p className="text-sm text-muted pt-1.5">{g.name}</p>
                    <div>
                      {colorLike && current && (
                        <p className="text-sm text-ink mb-2">{current.value}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {g.options.map((opt, idx) => {
                          const active = selected[g.name] === opt.id;
                          const disabled = Number(opt.stock) <= 0;
                          if (colorLike) {
                            const swatch = images[idx]?.image_url;
                            return (
                              <button
                                key={opt.id ?? `${g.name}-${opt.value}-${idx}`}
                                type="button"
                                onClick={() => selectVariant(g.name, opt.id)}
                                disabled={disabled}
                                title={opt.value}
                                className={`relative w-12 h-12 overflow-hidden rounded-lg border ${
                                  active
                                    ? "border-accent ring-1 ring-accent"
                                    : disabled
                                      ? "border-line opacity-50"
                                      : "border-line hover:border-primary/40"
                                }`}
                              >
                                {swatch ? (
                                  <Image
                                    src={swatch}
                                    alt={opt.value}
                                    fill
                                    sizes="48px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <span className="text-[10px] text-ink px-1">
                                    {opt.value}
                                  </span>
                                )}
                              </button>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => selectVariant(g.name, opt.id)}
                              disabled={disabled}
                              key={opt.id ?? `${g.name}-${opt.value}-${idx}`}
                              className={`min-w-11 h-9 px-3 rounded-lg border text-sm ${
                                active
                                  ? "border-accent text-ink bg-accent/10"
                                  : disabled
                                    ? "border-line text-muted line-through opacity-60 cursor-not-allowed"
                                    : "border-line text-ink hover:border-primary/40"
                              }`}
                            >
                              {opt.value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {groups.length > 0 && !allSelected && (
            <p className="text-xs text-muted mb-4">
              Please select all options above to continue.
            </p>
          )}

          {outOfStock ? (
            <div className="mb-4">
              <p className="text-sm font-medium text-red-500 mb-3">
                Out of stock
              </p>
              {showEnquiry && (
                <button
                  type="button"
                  onClick={() => setEnquiryOpen(true)}
                  className="btn btn-primary w-full sm:w-auto"
                >
                  <MessageCircle size={16} />
                  Request enquiry
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-[88px_1fr] gap-3 items-center mb-5">
              <p className="text-sm text-muted">Quantity</p>
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center border border-line rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    disabled={quantity <= 1}
                    className="w-9 h-9 flex items-center justify-center text-ink hover:bg-background disabled:text-line"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-11 text-center text-sm font-medium text-ink border-x border-line h-9 flex items-center justify-center">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((q) => Math.min(effectiveStock, q + 1))
                    }
                    aria-label="Increase quantity"
                    disabled={quantity >= effectiveStock}
                    className="w-9 h-9 flex items-center justify-center text-ink hover:bg-background disabled:text-line"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {effectiveStock > 0 && effectiveStock <= 10 && (
                  <span className="text-xs text-accent">
                    Only {effectiveStock} left
                  </span>
                )}
              </div>
            </div>
          )}

          {!outOfStock && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={handleAddToCart}
                  disabled={!allSelected}
                  className="flex-1 btn btn-primary h-12 rounded-xl disabled:opacity-50"
                >
                  {addedMsg ? (
                    <>
                      <Check size={16} />
                      Added
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={16} />
                      Add to Cart
                    </>
                  )}
                </button>
                <button
                  onClick={handleBuyNow}
                  disabled={!allSelected}
                  className="flex-1 btn btn-accent h-12 rounded-xl disabled:opacity-50"
                >
                  <Zap size={16} />
                  Buy Now
                </button>
              </div>
              <ShareBar product={product} compact />
            </div>
          )}

          {outOfStock && (
            <div className="mt-4">
              <ShareBar product={product} compact />
            </div>
          )}

          {(showWhatsApp || showPhone) && (
            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              {showWhatsApp && (
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                    `Hi, I'm interested in "${product.name}". Could you please provide more information?`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-[#25D366] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <MessageCircle size={16} />
                  WhatsApp
                </a>
              )}
              {showPhone && (
                <a
                  href={`tel:${phoneNumber}`}
                  className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border border-primary text-primary text-sm font-medium hover:bg-primary hover:text-white transition-colors"
                >
                  <Phone size={16} />
                  Call
                </a>
              )}
            </div>
          )}
        </div>

        <DeliverySidebar
          siteSettings={siteSettings}
          extras={deliveryLocations}
          delivery={delivery}
        />
      </div>
      {/* Description & Reviews tabs */}
      <section className="mt-8 pt-6 border-t border-line">
        <div className="flex items-center gap-6 border-b border-line mb-6">
          <button
            onClick={() => setActiveTab("description")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === "description"
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Description
          </button>
          <button
            onClick={() => setActiveTab("reviews")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === "reviews"
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Reviews ({product.review_count || 0})
          </button>
        </div>

        {activeTab === "description" ? (
          descriptionHtml ? (
            <div
              className="prose prose-sm max-w-none text-muted leading-relaxed"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          ) : (
            <p className="text-sm text-muted py-6">No description available.</p>
          )
        ) : (
          <ReviewsList
            reviews={reviews}
            avgRating={product.avg_rating}
            reviewCount={product.review_count}
          />
        )}
      </section>

      {/* Spacer so the mobile sticky bar never covers page content */}
      <div className="lg:hidden h-20" aria-hidden="true" />

      {/* Mobile sticky buy bar */}
      <div className="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-surface/95 backdrop-blur border-t border-line px-3 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        {outOfStock ? (
          <div className="max-w-[97%] mx-auto">
            {showEnquiry ? (
              <button
                type="button"
                onClick={() => setEnquiryOpen(true)}
                className="w-full btn btn-primary h-11 rounded-xl"
              >
                <MessageCircle size={16} />
                Request enquiry
              </button>
            ) : (
              <p className="text-sm font-medium text-red-500 text-center py-3">
                Out of stock
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 max-w-[97%] mx-auto">
            <div className="shrink-0 leading-tight min-w-[4.5rem]">
              <p className="text-[10px] text-muted uppercase tracking-wide">
                Price
              </p>
              <p className="text-base font-semibold text-accent">
                ৳{Math.round(price)}
              </p>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={!allSelected}
              className="flex-1 btn btn-primary h-11 rounded-xl text-sm px-3 disabled:opacity-50"
            >
              {addedMsg ? "Added" : "Add to Cart"}
            </button>
            <button
              onClick={handleBuyNow}
              disabled={!allSelected}
              className="flex-1 btn btn-accent h-11 rounded-xl text-sm px-3 disabled:opacity-50"
            >
              Buy Now
            </button>
          </div>
        )}
      </div>
      {enquiryOpen && (
        <ProductEnquiryModal
          open={enquiryOpen}
          onClose={() => setEnquiryOpen(false)}
          product={product}
        />
      )}
    </>
  );
}

function ProductImageMagnifier({
  src,
  alt,
  images,
  activeImage,
  setActiveImage,
}) {
  const containerRef = useRef(null);
  const [hovering, setHovering] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [lightbox, setLightbox] = useState(false);
  const [lbIndex, setLbIndex] = useState(activeImage);
  const [lbZoom, setLbZoom] = useState(1);
  const [lbOrigin, setLbOrigin] = useState({ x: 50, y: 50 });

  const ZOOM = 2.4;
  const gallery = images && images.length > 0 ? images : [{ image_url: src }];
  const canHoverZoom = useRef(false);

  useEffect(() => {
    canHoverZoom.current = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;
  }, []);

  function updateOrigin(clientX, clientY) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setOrigin({
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y)),
    });
  }

  function openLightbox() {
    setLbIndex(activeImage);
    setLbZoom(1);
    setLbOrigin({ x: 50, y: 50 });
    setLightbox(true);
  }

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e) {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowLeft") {
        setLbIndex((i) => (i - 1 + gallery.length) % gallery.length);
        setLbZoom(1);
      }
      if (e.key === "ArrowRight") {
        setLbIndex((i) => (i + 1) % gallery.length);
        setLbZoom(1);
      }
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightbox, gallery.length]);

  const lbSrc = gallery[lbIndex]?.image_url || src;

  return (
    <>
      <div
        ref={containerRef}
        className="relative aspect-square overflow-hidden bg-primary/5 w-full cursor-zoom-in group"
        onMouseEnter={() => {
          if (canHoverZoom.current) setHovering(true);
        }}
        onMouseLeave={() => setHovering(false)}
        onMouseMove={(e) => {
          if (!canHoverZoom.current) return;
          updateOrigin(e.clientX, e.clientY);
        }}
        onClick={openLightbox}
        role="button"
        tabIndex={0}
        aria-label={`Magnify ${alt}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openLightbox();
          }
        }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority
          quality={80}
          sizes="(min-width: 1024px) 45vw, 95vw"
          className="object-cover transition-transform duration-150 ease-out will-change-transform"
          style={{
            transform: hovering ? `scale(${ZOOM})` : "scale(1)",
            transformOrigin: `${origin.x}% ${origin.y}%`,
          }}
        />
        <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-ink/70 text-white text-[11px] font-medium px-2.5 py-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          <ZoomIn size={12} />
          Zoom
        </span>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Product image lightbox"
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
          >
            <X size={20} />
          </button>

          {gallery.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLbIndex((i) => (i - 1 + gallery.length) % gallery.length);
                  setLbZoom(1);
                }}
                aria-label="Previous image"
                className="absolute left-3 sm:left-6 z-10 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLbIndex((i) => (i + 1) % gallery.length);
                  setLbZoom(1);
                }}
                aria-label="Next image"
                className="absolute right-3 sm:right-6 z-10 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          <div
            className="relative w-[92vw] h-[78vh] max-w-5xl"
            onClick={(e) => {
              e.stopPropagation();
              setLbZoom((z) => (z > 1 ? 1 : 2.5));
            }}
            onMouseMove={(e) => {
              if (lbZoom <= 1) return;
              const rect = e.currentTarget.getBoundingClientRect();
              setLbOrigin({
                x: ((e.clientX - rect.left) / rect.width) * 100,
                y: ((e.clientY - rect.top) / rect.height) * 100,
              });
            }}
          >
            <Image
              src={lbSrc}
              alt={alt}
              fill
              sizes="92vw"
              className="object-contain transition-transform duration-200 ease-out"
              style={{
                transform: `scale(${lbZoom})`,
                transformOrigin: `${lbOrigin.x}% ${lbOrigin.y}%`,
                cursor: lbZoom > 1 ? "zoom-out" : "zoom-in",
              }}
            />
          </div>

          {gallery.length > 1 && (
            <div
              className="absolute bottom-4 inset-x-0 flex justify-center gap-2 px-4"
              onClick={(e) => e.stopPropagation()}
            >
              {gallery.map((img, i) => (
                <button
                  key={img.id || i}
                  type="button"
                  onClick={() => {
                    setLbIndex(i);
                    setLbZoom(1);
                    setActiveImage(i);
                  }}
                  className={`relative w-12 h-12 rounded-md overflow-hidden border-2 ${
                    i === lbIndex ? "border-white" : "border-transparent opacity-70"
                  }`}
                >
                  <Image
                    src={img.image_url}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function isColorGroup(name) {
  return /color|colour|shade/i.test(String(name || ""));
}

function buildBreadcrumbs(product, categories = []) {
  const crumbs = [{ href: "/shop", label: "Shop" }];
  const cat = product?.categories;
  if (!cat?.name) return crumbs;
  const byId = Object.fromEntries((categories || []).map((c) => [c.id, c]));
  const chain = [];
  let current = categories.find((c) => c.slug === cat.slug) || null;
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parent_id ? byId[current.parent_id] : null;
  }
  chain.forEach((c) => {
    crumbs.push({
      href: `/shop?category=${encodeURIComponent(c.slug || "")}`,
      label: c.name,
    });
  });
  if (!chain.length) {
    crumbs.push({
      href: `/shop?category=${encodeURIComponent(cat.slug || "")}`,
      label: cat.name,
    });
  }
  return crumbs;
}

function deliveryWindow() {
  const start = new Date();
  start.setDate(start.getDate() + 3);
  const end = new Date();
  end.setDate(end.getDate() + 5);
  const fmt = (d) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return `${fmt(start)}-${fmt(end).replace(/^\d+\s/, "")}`;
}

function DeliverySidebar({ siteSettings, extras, delivery }) {
  const [changing, setChanging] = useState(false);
  const loc = delivery.location;
  const charge = loc
    ? chargeForLocation(loc, siteSettings, extras)
    : null;

  return (
    <aside className="bg-surface border border-line lg:sticky lg:top-24">
      <div className="px-4 py-3 border-b border-line">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-ink">Delivery Options</p>
          <span className="text-muted" title="Delivery depends on your area">
            <Info size={14} />
          </span>
        </div>
        <div className="flex items-start gap-2">
          <MapPin size={16} className="text-muted mt-0.5 shrink-0" />
          <p className="text-sm text-ink flex-1 leading-snug">
            {loc ? formatLocation(loc) : "Select your delivery area"}
          </p>
          <button
            type="button"
            onClick={() => setChanging((v) => !v)}
            className="text-xs font-semibold text-accent hover:underline shrink-0"
          >
            {changing ? "CLOSE" : "CHANGE"}
          </button>
        </div>
        {changing && (
          <div className="mt-3">
            <LocationSelect
              value={delivery.areaKey}
              extras={extras}
              chargeFor={(item) =>
                chargeForLocation(item, siteSettings, extras)
              }
              onChange={(next) => {
                delivery.select(next);
                setChanging(false);
              }}
            />
          </div>
        )}
        <div className="flex items-start gap-2 mt-4">
          <Truck size={16} className="text-muted mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-ink">Estimate Delivery Cost</p>
            <p className="text-xs text-muted">
              Guaranteed by {deliveryWindow()}
            </p>
          </div>
          <p className="text-sm font-medium text-ink shrink-0">
            {loc ? `৳${Math.round(charge || 0)}` : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Banknote size={16} className="text-muted shrink-0" />
          <p className="text-sm text-ink">Cash on Delivery Available</p>
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-ink">Return & Warranty</p>
          <span className="text-muted">
            <Info size={14} />
          </span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <RotateCcw size={16} className="text-muted shrink-0" />
            <p className="text-sm text-ink">Change of Mind</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full border border-muted text-[10px] text-muted flex items-center justify-center shrink-0">
              14
            </span>
            <p className="text-sm text-ink">14 days easy return</p>
          </div>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-muted shrink-0" />
            <p className="text-sm text-ink">Warranty not available</p>
          </div>
        </div>
      </div>
    </aside>
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

function ShareBar({ product, compact = false }) {
  const { success } = useToast();
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
      success("Link copied.");
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
      icon: <Facebook size={15} />,
    },
    {
      label: "Share on WhatsApp",
      onClick: () =>
        openShare(
          `https://wa.me/?text=${encodeURIComponent(
            `${shareText()} ${shareUrl()}`,
          )}`,
        ),
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
      icon: <Twitter size={15} />,
    },
    {
      label: "Share on Telegram",
      onClick: () =>
        openShare(
          `https://t.me/share/url?url=${encodeURIComponent(
            shareUrl(),
          )}&text=${encodeURIComponent(shareText())}`,
        ),
      icon: <Send size={15} />,
    },
  ];

  return (
    <div
      className={
        compact
          ? "pt-1"
          : "mt-6 pt-6 border-t border-line"
      }
    >
      <p className="flex items-center gap-2 text-xs font-medium text-muted mb-2">
        <Share2 size={14} /> Share this product
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={b.onClick}
            aria-label={b.label}
            className="flex items-center justify-center w-9 h-9 rounded-full border border-line text-ink bg-surface hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
          >
            {b.icon}
          </button>
        ))}
        <button
          type="button"
          onClick={copyLink}
          aria-label="Copy link"
          className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-full border border-line text-ink bg-surface hover:border-primary hover:text-primary transition-colors"
        >
          {copied ? <Check size={14} /> : <Link2 size={14} />}
          <span className="text-xs font-medium">
            {copied ? "Copied!" : "Copy link"}
          </span>
        </button>
      </div>
    </div>
  );
}
