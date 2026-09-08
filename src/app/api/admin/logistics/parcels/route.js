import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadSteadfastCredentials } from "@/lib/logistics";
import {
  buildParcelPayload,
  createSteadfastOrder,
  validateParcelPayload,
} from "@/lib/steadfast";

export async function POST(req) {
  try {
    await requireAdmin();
    const { supabase, credentials } = await loadSteadfastCredentials();
    const body = await req.json();
    const orderId = body.orderId || body.order_id;

    if (!orderId) {
      return NextResponse.json(
        { error: "Order id is required." },
        { status: 400 },
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (order.fulfillment_method === "pickup") {
      return NextResponse.json(
        { error: "Pickup orders cannot be sent to courier." },
        { status: 400 },
      );
    }
    if (order.status === "cancelled") {
      return NextResponse.json(
        { error: "Cancelled orders cannot be sent to courier." },
        { status: 400 },
      );
    }
    if (order.consignment_id) {
      return NextResponse.json(
        { error: "A parcel already exists for this order." },
        { status: 400 },
      );
    }

    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, variant_text, quantity")
      .eq("order_id", orderId);

    const payload = buildParcelPayload({
      order,
      items: items || [],
      overrides: body,
      defaultDeliveryType: credentials.defaultDeliveryType,
    });

    const validationError = validateParcelPayload(payload);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const result = await createSteadfastOrder(payload, credentials);
    const consignment = result?.consignment || result;

    if (!consignment?.consignment_id && !consignment?.tracking_code) {
      return NextResponse.json(
        {
          error:
            result?.message || "Courier did not return a consignment id.",
        },
        { status: 502 },
      );
    }

    const now = new Date().toISOString();
    const nextStatus =
      order.status === "pending" ? "confirmed" : order.status;

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
        status: nextStatus,
        updated_at: now,
      })
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      order: updated,
      consignment,
      message: result?.message || "Parcel created.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Could not create parcel." },
      { status: err.status || 500 },
    );
  }
}
