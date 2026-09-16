import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadLogisticsContext } from "@/lib/logistics";
import { generateTrackingCode } from "@/lib/tracking";
import {
  buildParcelPayload,
  createSteadfastOrder,
  validateParcelPayload,
} from "@/lib/steadfast";
import {
  computeCodCharge,
  computeWeightPricing,
  roundMoney,
  roundWeight,
} from "@/lib/weightPricing";
import { sendOrderPlacedEmails } from "@/lib/email";
import { sendOrderPlacedSMS } from "@/lib/sms";

const EXTENDED_COLUMN_RE =
  /order_type|total_weight|weight_charge|extra_weight_kg|cod_charge|cod_percent/;

function normalizeItems(rawItems, productMap) {
  const rows = [];
  for (const raw of rawItems || []) {
    const product = raw.product_id ? productMap[raw.product_id] : null;
    const name = String(
      raw.product_name || product?.name || "",
    ).trim();
    const quantity = Math.max(1, Math.floor(Number(raw.quantity) || 1));
    const price = Math.max(0, Number(raw.price ?? product?.price ?? 0) || 0);
    const weight = roundWeight(raw.weight ?? product?.weight ?? 0);
    if (!name) continue;
    rows.push({
      product_id: product?.id || null,
      product_name: name,
      price,
      quantity,
      weight,
    });
  }
  return rows;
}

async function upsertCustomer(supabase, fields) {
  const phone = String(fields.phone || "").replace(/\D/g, "");
  if (!phone) return;
  try {
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    const payload = {
      name: String(fields.name || "").trim() || phone,
      phone,
      email: String(fields.email || "").trim() || null,
      address: String(fields.address || "").trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      await supabase.from("customers").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("customers").insert(payload);
    }
  } catch {
    // A missing customers table must not break parcel creation.
  }
}

export async function POST(req) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { supabase, settings, credentials } = await loadLogisticsContext();

    const recipientName = String(
      body.recipient_name ?? body.customer?.name ?? "",
    ).trim();
    const recipientPhone = String(
      body.recipient_phone ?? body.customer?.phone ?? "",
    ).trim();
    const recipientEmail = String(
      body.recipient_email ?? body.customer?.email ?? "",
    ).trim();
    const recipientAddress = String(
      body.recipient_address ?? body.customer?.address ?? "",
    ).trim();

    if (!recipientName) {
      return NextResponse.json(
        { error: "Customer name is required." },
        { status: 400 },
      );
    }
    if (!recipientPhone) {
      return NextResponse.json(
        { error: "Customer phone is required." },
        { status: 400 },
      );
    }
    if (!recipientAddress) {
      return NextResponse.json(
        { error: "Delivery address is required." },
        { status: 400 },
      );
    }

    // ---- Resolve products and build line items ----
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) {
      return NextResponse.json(
        { error: "Add at least one product to the parcel." },
        { status: 400 },
      );
    }

    const productIds = [
      ...new Set(rawItems.map((i) => i.product_id).filter(Boolean)),
    ];
    let productMap = {};
    if (productIds.length > 0) {
      const { data: productRows } = await supabase
        .from("products")
        .select("id, name, price, weight")
        .in("id", productIds);
      productMap = Object.fromEntries(
        (productRows || []).map((p) => [p.id, p]),
      );
    }

    const itemRows = normalizeItems(rawItems, productMap);
    if (itemRows.length === 0) {
      return NextResponse.json(
        { error: "Add at least one valid product to the parcel." },
        { status: 400 },
      );
    }

    const subtotal = roundMoney(
      itemRows.reduce((sum, i) => sum + i.price * i.quantity, 0),
    );
    const itemsWeight = roundWeight(
      itemRows.reduce((sum, i) => sum + i.weight * i.quantity, 0),
    );
    const totalWeight = roundWeight(
      body.total_weight != null && body.total_weight !== ""
        ? body.total_weight
        : itemsWeight,
    );

    // ---- Weight-based delivery charge from the delivery zone ----
    let zone = null;
    if (body.zone_id) {
      const { data } = await supabase
        .from("delivery_zones")
        .select("*")
        .eq("id", body.zone_id)
        .maybeSingle();
      zone = data || null;
    }

    const pricing = computeWeightPricing({
      weightKg: totalWeight,
      baseCharge: zone?.charge,
      baseWeightKg: zone?.base_weight_kg ?? 1,
      extraKgCharge: zone?.extra_kg_charge ?? 0,
    });
    const weightCharge = pricing.weightCharge;

    // ---- Amounts: customer pays items + delivery, admin bears COD fee ----
    const payable = roundMoney(subtotal + weightCharge);
    const codAmount =
      body.cod_amount != null && body.cod_amount !== ""
        ? Math.max(0, roundMoney(body.cod_amount))
        : payable;
    const codPercent = Math.max(0, Number(settings?.cod_percent ?? 1) || 0);
    const codCharge = computeCodCharge(codAmount, codPercent);

    const invoice =
      String(body.invoice || "").trim() || generateTrackingCode();

    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("tracking_code", invoice)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "Invoice / tracking code already exists." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const baseOrder = {
      tracking_code: invoice,
      customer_name: recipientName,
      phone: recipientPhone,
      email: recipientEmail || null,
      address: recipientAddress,
      status: "confirmed",
      fulfillment_method: "delivery",
      delivery_charge: weightCharge,
      delivery_zone_id: zone?.id || null,
      delivery_zone_name: zone?.name || null,
      discount_amount: 0,
      total_amount: codAmount,
      notes: String(body.note || "").trim() || "Manual parcel order",
      created_at: now,
      updated_at: now,
    };
    const extendedOrder = {
      ...baseOrder,
      order_type: "manual",
      total_weight: totalWeight,
      weight_charge: weightCharge,
      extra_weight_kg: pricing.extraKg,
      cod_percent: codPercent,
      cod_charge: codCharge,
    };

    let { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(extendedOrder)
      .select()
      .single();

    if (orderError && EXTENDED_COLUMN_RE.test(orderError.message || "")) {
      const retry = await supabase
        .from("orders")
        .insert(baseOrder)
        .select()
        .single();
      order = retry.data;
      orderError = retry.error;
    }
    if (orderError) throw orderError;

    const itemsWithOrder = itemRows.map((row) => ({ ...row, order_id: order.id }));
    let { error: itemsError } = await supabase
      .from("order_items")
      .insert(itemsWithOrder);
    if (itemsError && /weight/i.test(itemsError.message || "")) {
      const retry = await supabase.from("order_items").insert(
        itemRows.map(({ weight, ...rest }) => ({ ...rest, order_id: order.id })),
      );
      itemsError = retry.error;
    }
    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw itemsError;
    }

    await upsertCustomer(supabase, {
      name: recipientName,
      phone: recipientPhone,
      email: recipientEmail,
      address: recipientAddress,
    });

    // ---- Send the parcel to the courier (best effort) ----
    let consignment = null;
    let warning = "";

    if (credentials?.configured && credentials?.enabled) {
      const payload = buildParcelPayload({
        order,
        items: itemRows,
        overrides: {
          invoice,
          recipient_name: recipientName,
          recipient_phone: recipientPhone,
          alternative_phone: body.alternative_phone,
          recipient_email: recipientEmail,
          recipient_address: recipientAddress,
          cod_amount: codAmount,
          note: body.note,
          delivery_type: body.delivery_type,
        },
        defaultDeliveryType: credentials.defaultDeliveryType,
      });

      const validationError = validateParcelPayload(payload);
      if (validationError) {
        warning = `Order saved, but courier was skipped: ${validationError}`;
      } else {
        try {
          const result = await createSteadfastOrder(payload, credentials);
          const candidate = result?.consignment || result;
          if (candidate?.consignment_id || candidate?.tracking_code) {
            consignment = candidate;
            const { data: updated } = await supabase
              .from("orders")
              .update({
                consignment_id: candidate.consignment_id || null,
                courier_tracking_code: candidate.tracking_code || null,
                courier_status: candidate.status || "in_review",
                courier_invoice: candidate.invoice || invoice,
                parcel_note: payload.note || null,
                courier_delivery_type: payload.delivery_type,
                parcel_created_at: now,
                courier_synced_at: now,
                updated_at: now,
              })
              .eq("id", order.id)
              .select()
              .single();
            if (updated) order = updated;
          } else {
            warning =
              result?.message ||
              "Order saved, but the courier did not return a consignment id.";
          }
        } catch (courierError) {
          warning = `Order saved, but courier failed: ${
            courierError.message || "unknown error"
          }`;
        }
      }
    } else {
      warning =
        "Order saved. Enable Steadfast in Logistics settings to send parcels to the courier.";
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    if (order.email) {
      sendOrderPlacedEmails({
        toEmail: order.email,
        customerName: order.customer_name,
        phone: order.phone,
        address: order.address,
        trackingCode: order.tracking_code,
        items: itemRows,
        delivery: zone?.name ? `${zone.name} courier` : "Steadfast courier",
        totalAmount: order.total_amount,
        origin,
      }).catch((err) => {
        console.error("Manual order email failed:", err.message);
      });
    }
    sendOrderPlacedSMS({
      phone: order.phone,
      customerName: order.customer_name,
      trackingCode: order.tracking_code,
      origin,
    }).catch((err) => {
      console.error("Manual order SMS failed:", err.message);
    });

    return NextResponse.json({
      ok: true,
      order,
      consignment,
      warning: warning || undefined,
      pricing: {
        subtotal,
        itemsWeight,
        totalWeight,
        extraKg: pricing.extraKg,
        baseCharge: pricing.baseCharge,
        extraKgCharge: pricing.extraKgCharge,
        weightCharge,
        codAmount,
        codPercent,
        codCharge,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Could not create manual order." },
      { status: err.status || 500 },
    );
  }
}
