import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  pickBestDiscount,
  couponDiscount,
  validateCoupon,
} from "@/lib/pricing";
import { generateTrackingCode } from "@/lib/tracking";
import { sendOrderPlacedEmails } from "@/lib/email";
import { sendOrderPlacedSMS } from "@/lib/sms";

class StockError extends Error {
  constructor() {
    super("Stock changed while placing your order. Please try again.");
    this.status = 400;
    this.rollback = true;
  }
}

class VariantStockError extends Error {
  constructor() {
    super("A product option changed while placing your order. Please try again.");
    this.status = 400;
    this.rollback = true;
  }
}

export async function POST(req) {
  let order = null;
  let items = [];
  let decrementedProducts = [];
  let decrementedVariants = [];

  try {
    const body = await req.json();
    const { items: cartItems, customer, zoneId, couponCode } = body;

    if (!customer?.name?.trim() || !customer?.phone?.trim()) {
      return NextResponse.json(
        { error: "Name and phone are required." },
        { status: 400 },
      );
    }
    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json(
        { error: "Your cart is empty." },
        { status: 400 },
      );
    }

    // ---- Pricing data ----
    const [{ data: zones }, { data: settings }, { data: rules }, { data: coupon }] =
      await Promise.all([
        supabase
          .from("delivery_zones")
          .select("*")
          .eq("is_active", true),
        supabase
          .from("site_settings")
          .select("*")
          .eq("id", 1)
          .maybeSingle(),
        supabase.from("discount_rules").select("*").eq("is_active", true),
        couponCode
          ? supabase
              .from("coupons")
              .select("*")
              .eq("code", String(couponCode).trim().toUpperCase())
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    const selectedZone = zones?.find((z) => z.id === zoneId) || null;
    if (zones && zones.length > 0 && !selectedZone) {
      return NextResponse.json(
        { error: "Please select your delivery area." },
        { status: 400 },
      );
    }

    // ---- Verify products + stock ----
    const productIds = [...new Set(cartItems.map((i) => i.product_id))];
    const { data: productRows } = await supabase
      .from("products")
      .select("id, name, price, stock")
      .in("id", productIds);

    const productMap = Object.fromEntries(
      (productRows || []).map((p) => [p.id, p]),
    );

    const variantIds = [...new Set(cartItems.flatMap((i) => i.variant_ids || []))];
    let variantMap = {};
    if (variantIds.length > 0) {
      const { data: variantRows } = await supabase
        .from("product_variants")
        .select("id, product_id, name, value, price_adjustment, stock")
        .in("id", variantIds);
      variantMap = Object.fromEntries((variantRows || []).map((v) => [v.id, v]));
    }

    // ---- Build item rows + subtotal (server-side pricing) ----
    let subtotal = 0;
    const itemRows = [];
    for (const item of cartItems) {
      const product = productMap[item.product_id];
      if (!product) {
        return NextResponse.json(
          { error: "One of the products in your cart is no longer available." },
          { status: 400 },
        );
      }

      const variantTextParts = [];
      let adjustment = 0;
      let variantStock = Infinity;
      for (const vid of item.variant_ids || []) {
        const v = variantMap[vid];
        if (!v) {
          return NextResponse.json(
            { error: `A selected option for ${product.name} is no longer available.` },
            { status: 400 },
          );
        }
        variantTextParts.push(`${v.name}: ${v.value}`);
        adjustment += Number(v.price_adjustment || 0);
        variantStock = Math.min(variantStock, Number(v.stock));
      }

      const effectiveStock =
        (item.variant_ids?.length || 0) > 0
          ? variantStock
          : Number(product.stock);

      const qty = Math.max(1, Number(item.quantity) || 1);
      if (effectiveStock < qty) {
        return NextResponse.json(
          {
            error: `"${product.name}" doesn't have enough stock. Only ${effectiveStock} left.`,
          },
          { status: 400 },
        );
      }

      const unitPrice = Number(product.price) + adjustment;
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;

      itemRows.push({
        product_id: product.id,
        product_name: item.product_name || product.name,
        price: unitPrice,
        quantity: qty,
        variant_text:
          item.variant_text ||
          (variantTextParts.length > 0 ? variantTextParts.join(" · ") : null),
      });
    }

    // ---- Discounts ----
    const autoBest = pickBestDiscount(rules || [], subtotal);
    const autoDiscount = autoBest ? autoBest.amount : 0;

    let couponApplied = null;
    let couponDiscountAmount = 0;
    if (coupon) {
      const validation = validateCoupon(coupon, subtotal);
      if (validation.ok) {
        couponDiscountAmount = couponDiscount(coupon, subtotal);
        couponApplied = coupon;
      }
    }

    const totalDiscount = Math.min(autoDiscount + couponDiscountAmount, subtotal);

    // ---- Delivery ----
    const freeDeliveryApplies =
      settings?.free_delivery_enabled &&
      subtotal >= Number(settings.free_delivery_threshold || 0);
    const deliveryCharge =
      zones && zones.length > 0
        ? freeDeliveryApplies
          ? 0
          : Number(selectedZone.charge || 0)
        : 0;

    const grandTotal = subtotal - totalDiscount + deliveryCharge;

    const trackingCode = generateTrackingCode();

    // ---- Insert order + items ----
    const { data: newOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        tracking_code: trackingCode,
        customer_name: customer.name.trim(),
        phone: customer.phone.trim(),
        email: customer.email?.trim() || null,
        address: customer.address?.trim() || "",
        total_amount: grandTotal,
        delivery_zone_id: selectedZone?.id || null,
        delivery_charge: deliveryCharge,
        delivery_zone_name: selectedZone?.name || null,
        discount_amount: totalDiscount,
        discount_label:
          couponApplied?.code || (autoBest ? autoBest.rule.label : null),
        coupon_code: couponApplied?.code || null,
        status: "pending",
      })
      .select()
      .single();

    if (orderError) throw orderError;
    order = newOrder;

    const itemsWithOrder = itemRows.map((r) => ({
      ...r,
      order_id: newOrder.id,
    }));
    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(itemsWithOrder);
    if (itemsError) throw itemsError;
    items = itemRows;

    // ---- Decrement stock atomically (products + variants) ----
    // Aggregate total quantity per product / variant, then call the
    // single-statement RPCs so concurrent orders can't oversell. Each RPC
    // returns true only if enough stock was available. If the RPCs don't
    // exist yet (migration 003 not applied), fall back to the legacy
    // read-then-write update so checkout keeps working.
    const productQtyMap = {};
    const variantQtyMap = {};
    for (const item of cartItems) {
      productQtyMap[item.product_id] =
        (productQtyMap[item.product_id] || 0) + Math.max(1, Number(item.quantity) || 1);
      for (const vid of item.variant_ids || []) {
        variantQtyMap[vid] =
          (variantQtyMap[vid] || 0) + Math.max(1, Number(item.quantity) || 1);
      }
    }

    for (const [productId, qty] of Object.entries(productQtyMap)) {
      const { data: ok, error } = await supabase
        .rpc("decrement_stock", { p_product_id: productId, p_quantity: qty });
      if (error) {
        if (error.message?.includes("Could not find the function")) {
          const next = Math.max(
            0,
            Number(productMap[productId]?.stock || 0) - qty,
          );
          await supabase.from("products").update({ stock: next }).eq("id", productId);
          continue;
        }
        throw error;
      }
      if (!ok) {
        throw new StockError();
      }
      decrementedProducts.push([productId, qty]);
    }

    for (const [variantId, qty] of Object.entries(variantQtyMap)) {
      const { data: ok, error } = await supabase
        .rpc("decrement_variant_stock", { p_variant_id: variantId, p_quantity: qty });
      if (error) {
        if (error.message?.includes("Could not find the function")) {
          const next = Math.max(
            0,
            Number(variantMap[variantId]?.stock || 0) - qty,
          );
          await supabase.from("product_variants").update({ stock: next }).eq("id", variantId);
          continue;
        }
        throw error;
      }
      if (!ok) {
        throw new VariantStockError();
      }
      decrementedVariants.push([variantId, qty]);
    }

    // ---- Coupon usage count ----
    if (couponApplied) {
      await supabase
        .from("coupons")
        .update({ used_count: Number(coupon.used_count || 0) + 1 })
        .eq("id", coupon.id);
    }

    // ---- Notifications (non-blocking) ----
    const deliveryLabel = selectedZone
      ? `${selectedZone.name} (${freeDeliveryApplies ? "FREE" : `৳${deliveryCharge}`})`
      : "N/A";

    sendOrderPlacedEmails({
      toEmail: customer.email,
      customerName: customer.name,
      phone: customer.phone,
      address: customer.address,
      trackingCode,
      items: itemRows,
      delivery: deliveryLabel,
      totalAmount: grandTotal,
    }).catch((err) => {
      console.error("Order confirmation email failed:", err.message);
    });

    sendOrderPlacedSMS({
      phone: customer.phone,
      customerName: customer.name,
      trackingCode,
    }).catch((err) => {
      console.error("Order confirmation SMS failed:", err.message);
    });

    return NextResponse.json({
      ok: true,
      trackingCode,
      orderId: newOrder.id,
    });
  } catch (err) {
    const rollback = err.rollback === true;
    if (rollback) {
      // Best-effort undo of successful decrements (negative qty re-adds stock).
      await Promise.all(
        decrementedProducts.map(([id, qty]) =>
          supabase.rpc("decrement_stock", { p_product_id: id, p_quantity: -qty }),
        ),
      );
      await Promise.all(
        decrementedVariants.map(([id, qty]) =>
          supabase.rpc("decrement_variant_stock", { p_variant_id: id, p_quantity: -qty }),
        ),
      );
      // Remove the partially-created order (order_items cascade).
      if (order?.id) {
        await supabase.from("orders").delete().eq("id", order.id);
      }
    }
    return NextResponse.json(
      { error: err.message || "Something went wrong placing your order." },
      { status: err.status || 500 },
    );
  }
}
