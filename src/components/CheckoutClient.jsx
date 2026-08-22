"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ticket, X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/hooks/useCart";
import { pickBestDiscount } from "@/lib/pricing";
import { trackInitiateCheckout, trackPurchase } from "@/components/Analytics";

export default function CheckoutClient() {
  const { items, totalAmount, clearCart, updateQuantity, removeItem } =
    useCart();
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [zones, setZones] = useState([]);
  const [zoneId, setZoneId] = useState("");
  const [siteSettings, setSiteSettings] = useState(null);
  const [discountRules, setDiscountRules] = useState([]);

  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    trackInitiateCheckout({
      value: totalAmount,
      currency: "BDT",
      num_items: items.reduce((s, i) => s + Number(i.quantity || 1), 0),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadPricing() {
      const [{ data: zoneData }, { data: settingsData }, { data: ruleData }] =
        await Promise.all([
          supabase
            .from("delivery_zones")
            .select("*")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
          supabase
            .from("site_settings")
            .select("*")
            .eq("id", 1)
            .maybeSingle(),
          supabase.from("discount_rules").select("*").eq("is_active", true),
        ]);

      setZones(zoneData || []);
      if (zoneData && zoneData.length > 0) setZoneId(zoneData[0].id);
      setSiteSettings(settingsData || null);
      setDiscountRules(ruleData || []);
    }
    loadPricing();
  }, []);

  const selectedZone = zones.find((z) => z.id === zoneId);
  const baseDeliveryCharge = selectedZone ? Number(selectedZone.charge) : 0;

  const freeDeliveryApplies =
    siteSettings?.free_delivery_enabled &&
    totalAmount >= Number(siteSettings.free_delivery_threshold || 0);

  const deliveryCharge = freeDeliveryApplies ? 0 : baseDeliveryCharge;

  const autoBest = pickBestDiscount(discountRules, totalAmount);
  const autoDiscount = autoBest ? autoBest.amount : 0;

  const totalDiscount = Math.min(autoDiscount + couponDiscount, totalAmount);
  const grandTotal = totalAmount - totalDiscount + deliveryCharge;

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setCouponLoading(true);
    setCouponError("");

    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal: totalAmount }),
      });
      const data = await res.json();

      if (data.ok) {
        setCouponApplied(data.coupon);
        setCouponDiscount(data.discount);
        setCouponCode("");
      } else {
        setCouponError(data.reason || "Invalid coupon.");
        setCouponApplied(null);
        setCouponDiscount(0);
      }
    } catch {
      setCouponError("Could not validate coupon. Try again.");
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setCouponApplied(null);
    setCouponDiscount(0);
    setCouponError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (items.length === 0) return;

    if (zones.length > 0 && !zoneId) {
      setError("Please select your delivery area.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          customer: form,
          zoneId: zoneId || null,
          couponCode: couponApplied?.code || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong placing your order.");
        setLoading(false);
        return;
      }

      trackPurchase({
        transaction_id: data.trackingCode,
        value: grandTotal,
        currency: "BDT",
        items: items.map((i) => ({
          id: i.product_id,
          name: i.product_name,
          quantity: i.quantity,
          price: i.price,
        })),
      });

      clearCart();
      router.push(`/track/${data.trackingCode}?placed=1`);
    } catch (err) {
      setError(err.message || "Something went wrong placing your order.");
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24 px-5">
        <p className="text-lg text-ink mb-2">Your cart is empty</p>
        <a href="/shop" className="text-sm text-accent hover:underline">
          Continue shopping
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <h1 className="font-display text-2xl sm:text-3xl text-ink mb-8">
        Checkout
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Cart summary */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <h2 className="text-sm font-semibold text-ink mb-4">
            Order Summary
          </h2>
          <ul className="space-y-4 mb-4">
            {items.map((item) => (
              <li key={item._key} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink truncate">{item.product_name}</p>
                  {item.variant_text && (
                    <p className="text-xs text-muted truncate mt-0.5">
                      {item.variant_text}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() =>
                        updateQuantity(item._key, Math.max(1, item.quantity - 1))
                      }
                      aria-label="Decrease"
                      className="w-6 h-6 flex items-center justify-center text-xs border border-line rounded-full text-ink hover:bg-primary/5"
                    >
                      −
                    </button>
                    <span className="text-xs text-ink w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(item._key, item.quantity + 1)
                      }
                      aria-label="Increase"
                      className="w-6 h-6 flex items-center justify-center text-xs border border-line rounded-full text-ink hover:bg-primary/5"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeItem(item._key)}
                      className="text-xs text-red-500 hover:underline ml-2"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <p className="text-sm font-medium text-ink shrink-0">
                  ৳{(item.price * item.quantity).toFixed(2)}
                </p>
              </li>
            ))}
          </ul>

          {/* Coupon */}
          <div className="border border-line rounded-xl p-4 bg-surface mb-4">
            <p className="flex items-center gap-2 text-sm font-medium text-ink mb-3">
              <Ticket size={16} /> Have a coupon?
            </p>
            {couponApplied ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg px-3 py-2.5">
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  {couponApplied.label}
                </span>
                <button
                  onClick={removeCoupon}
                  aria-label="Remove coupon"
                  className="text-emerald-700 hover:text-emerald-900"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Coupon code"
                  className="input"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  className="btn btn-outline shrink-0 px-4"
                >
                  {couponLoading ? <Loader2 size={16} className="animate-spin" /> : "Apply"}
                </button>
              </div>
            )}
            {couponError && (
              <p className="text-xs text-red-600 mt-2">{couponError}</p>
            )}
          </div>

          <div className="border-t border-line pt-4 space-y-2">
            <div className="flex items-center justify-between text-sm text-muted">
              <span>Subtotal</span>
              <span>৳{totalAmount.toFixed(2)}</span>
            </div>

            {autoBest && (
              <div className="flex items-center justify-between text-sm text-emerald-600">
                <span>{autoBest.rule.label}</span>
                <span>−৳{autoDiscount.toFixed(2)}</span>
              </div>
            )}

            {couponApplied && (
              <div className="flex items-center justify-between text-sm text-emerald-600">
                <span>{couponApplied.label}</span>
                <span>−৳{couponDiscount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                Delivery{selectedZone ? ` (${selectedZone.name})` : ""}
              </span>
              {freeDeliveryApplies ? (
                <span className="text-emerald-600 font-medium">FREE</span>
              ) : (
                <span>৳{deliveryCharge.toFixed(2)}</span>
              )}
            </div>

            {siteSettings?.free_delivery_enabled && !freeDeliveryApplies && (
              <p className="text-xs text-muted">
                Add ৳
                {(
                  Number(siteSettings.free_delivery_threshold) - totalAmount
                ).toFixed(2)}{" "}
                more for free delivery
              </p>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-line">
              <p className="text-sm font-semibold text-ink">Total</p>
              <p className="text-lg font-semibold text-accent">
                ৳{grandTotal.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-3 order-1 lg:order-2">
          <form
            onSubmit={handleSubmit}
            className="space-y-4 bg-surface border border-line rounded-2xl p-6"
          >
            <div>
              <label className="label">Full Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label">Phone</label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="input"
              />
              <p className="text-xs text-muted mt-1">
                We will send your order confirmation and tracking code here.
              </p>
            </div>

            {zones.length > 0 && (
              <div>
                <label className="label">Delivery Area</label>
                <select
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  className="input appearance-none bg-surface"
                >
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name} —{" "}
                      {freeDeliveryApplies
                        ? "FREE"
                        : `৳${Number(zone.charge).toFixed(2)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="label">Delivery Address</label>
              <textarea
                required
                rows={3}
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="House, road, area — full address within your selected delivery zone"
                className="input"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-accent w-full disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Placing order...
                </>
              ) : (
                `Place Order — ৳${grandTotal.toFixed(2)}`
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
