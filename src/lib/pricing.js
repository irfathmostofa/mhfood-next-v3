// Shared pricing math used by both the checkout UI and the order API route,
// so the amount shown to the customer always matches what's stored.

export function pickBestDiscount(rules, subtotal) {
  const eligible = (rules || []).filter(
    (r) =>
      subtotal >= Number(r.min_amount || 0) &&
      (r.max_amount === null || r.max_amount === undefined || subtotal <= Number(r.max_amount)),
  );
  if (eligible.length === 0) return null;

  let best = null;
  let bestAmount = 0;
  for (const rule of eligible) {
    const amount =
      rule.discount_type === "percentage"
        ? (subtotal * Number(rule.discount_value)) / 100
        : Number(rule.discount_value);
    const capped = Math.min(amount, subtotal);
    if (capped > bestAmount) {
      bestAmount = capped;
      best = rule;
    }
  }
  return best ? { rule: best, amount: bestAmount } : null;
}

export function couponDiscount(coupon, subtotal) {
  if (!coupon) return 0;
  let amount =
    coupon.discount_type === "percentage"
      ? (subtotal * Number(coupon.discount_value)) / 100
      : Number(coupon.discount_value);
  if (coupon.max_discount != null && coupon.max_discount > 0) {
    amount = Math.min(amount, Number(coupon.max_discount));
  }
  return Math.min(amount, subtotal);
}

export function validateCoupon(coupon, subtotal, now = new Date()) {
  if (!coupon) return { ok: false, reason: "Coupon not found." };
  if (!coupon.is_active) return { ok: false, reason: "This coupon is not active." };
  if (subtotal < Number(coupon.min_subtotal || 0)) {
    return {
      ok: false,
      reason: `Minimum order of ৳${Number(coupon.min_subtotal).toFixed(2)} required.`,
    };
  }
  if (coupon.starts_at && now < new Date(coupon.starts_at)) {
    return { ok: false, reason: "This coupon hasn't started yet." };
  }
  if (coupon.ends_at && now > new Date(coupon.ends_at)) {
    return { ok: false, reason: "This coupon has expired." };
  }
  if (
    Number(coupon.usage_limit || 0) > 0 &&
    Number(coupon.used_count || 0) >= Number(coupon.usage_limit)
  ) {
    return { ok: false, reason: "This coupon's usage limit has been reached." };
  }
  return { ok: true };
}
