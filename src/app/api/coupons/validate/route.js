import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { couponDiscount, validateCoupon } from "@/lib/pricing";

export async function POST(req) {
  try {
    const { code, subtotal } = await req.json();
    if (!code) {
      return NextResponse.json({ ok: false, reason: "Enter a coupon code." });
    }

    const normalized = String(code).trim().toUpperCase();

    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", normalized)
      .maybeSingle();

    if (error || !coupon) {
      return NextResponse.json({ ok: false, reason: "Coupon not found." });
    }

    const validation = validateCoupon(coupon, Number(subtotal) || 0);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, reason: validation.reason });
    }

    const discount = couponDiscount(coupon, Number(subtotal) || 0);

    return NextResponse.json({
      ok: true,
      discount,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        label: `${coupon.code} — ${coupon.discount_type === "percentage"
          ? `${coupon.discount_value}% off`
          : `৳${coupon.discount_value} off`}`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, reason: err.message || "Could not validate coupon." },
      { status: 500 },
    );
  }
}
