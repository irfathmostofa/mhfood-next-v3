import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadSteadfastCredentials } from "@/lib/logistics";
import { generateTrackingCode } from "@/lib/tracking";
import {
  buildParcelPayload,
  createSteadfastOrder,
  validateParcelPayload,
} from "@/lib/steadfast";
import { sendOrderPlacedEmails } from "@/lib/email";
import { sendOrderPlacedSMS } from "@/lib/sms";

export async function POST(req) {
  try {
    await requireAdmin();
    const { supabase, credentials } = await loadSteadfastCredentials();
    const body = await req.json();

    const invoice = String(body.invoice || "").trim() || generateTrackingCode();
    const itemDescription = String(body.item_description || "").trim();
    const quantity = Math.max(1, Number(body.total_lot) || 1);

    const draftOrder = {
      tracking_code: invoice,
      customer_name: body.recipient_name,
      phone: body.recipient_phone,
      email: body.recipient_email || null,
      address: body.recipient_address,
      total_amount: body.cod_amount,
      notes: body.note || null,
    };

    const payload = buildParcelPayload({
      order: draftOrder,
      items: itemDescription
        ? [{ product_name: itemDescription, quantity }]
        : [],
      overrides: {
        ...body,
        invoice,
      },
      defaultDeliveryType: credentials.defaultDeliveryType,
    });
    payload.invoice = invoice;

    const validationError = validateParcelPayload(payload);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

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
    const orderInsert = {
      tracking_code: invoice,
      customer_name: payload.recipient_name,
      phone: payload.recipient_phone,
      email: payload.recipient_email || null,
      address: payload.recipient_address,
      status: "confirmed",
      fulfillment_method: "delivery",
      delivery_charge: 0,
      discount_amount: 0,
      total_amount: payload.cod_amount,
      notes: payload.note || "Manual order from logistics",
      created_at: now,
      updated_at: now,
    };

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderInsert)
      .select()
      .single();

    if (orderError) throw orderError;

    if (itemDescription) {
      const { error: itemError } = await supabase.from("order_items").insert({
        order_id: order.id,
        product_name: itemDescription,
        price: payload.cod_amount,
        quantity,
      });
      if (itemError) {
        await supabase.from("orders").delete().eq("id", order.id);
        throw itemError;
      }
    }

    let result;
    try {
      result = await createSteadfastOrder(payload, credentials);
    } catch (courierError) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw courierError;
    }

    const consignment = result?.consignment || result;
    if (!consignment?.consignment_id && !consignment?.tracking_code) {
      await supabase.from("orders").delete().eq("id", order.id);
      return NextResponse.json(
        {
          error: result?.message || "Courier did not return a consignment id.",
        },
        { status: 502 },
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({
        consignment_id: consignment.consignment_id || null,
        courier_tracking_code: consignment.tracking_code || null,
        courier_status: consignment.status || "in_review",
        courier_invoice: consignment.invoice || payload.invoice,
        parcel_note: payload.note || null,
        courier_delivery_type: payload.delivery_type,
        parcel_created_at: now,
        courier_synced_at: now,
        updated_at: now,
      })
      .eq("id", order.id)
      .select()
      .single();

    if (updateError) throw updateError;

    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    if (updated.email) {
      sendOrderPlacedEmails({
        toEmail: updated.email,
        customerName: updated.customer_name,
        phone: updated.phone,
        address: updated.address,
        trackingCode: updated.tracking_code,
        items: itemDescription
          ? [
              {
                product_name: itemDescription,
                quantity,
                price: payload.cod_amount,
              },
            ]
          : [],
        delivery: "Steadfast courier",
        totalAmount: payload.cod_amount,
        origin,
      }).catch((err) => {
        console.error("Manual order email failed:", err.message);
      });
    }
    sendOrderPlacedSMS({
      phone: updated.phone,
      customerName: updated.customer_name,
      trackingCode: updated.tracking_code,
      origin,
    }).catch((err) => {
      console.error("Manual order SMS failed:", err.message);
    });

    return NextResponse.json({
      ok: true,
      order: updated,
      consignment,
      message: result?.message || "Manual order created.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Could not create manual order." },
      { status: err.status || 500 },
    );
  }
}
