import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadSteadfastCredentials } from "@/lib/logistics";
import {
  buildParcelPayload,
  createSteadfastBulkOrders,
  validateParcelPayload,
} from "@/lib/steadfast";

export async function POST(req) {
  try {
    await requireAdmin();
    const { supabase, credentials } = await loadSteadfastCredentials();
    const body = await req.json();
    const orderIds = Array.isArray(body.orderIds) ? body.orderIds : [];

    if (orderIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one order." },
        { status: 400 },
      );
    }
    if (orderIds.length > 500) {
      return NextResponse.json(
        { error: "Maximum 500 parcels can be created at once." },
        { status: 400 },
      );
    }

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .in("id", orderIds);

    if (ordersError) throw ordersError;

    const eligible = (orders || []).filter(
      (order) =>
        order.fulfillment_method !== "pickup" &&
        order.status !== "cancelled" &&
        !order.consignment_id,
    );

    if (eligible.length === 0) {
      return NextResponse.json(
        { error: "No eligible delivery orders without a parcel." },
        { status: 400 },
      );
    }

    const { data: items } = await supabase
      .from("order_items")
      .select("order_id, product_name, variant_text, quantity")
      .in(
        "order_id",
        eligible.map((order) => order.id),
      );

    const itemsByOrder = {};
    for (const item of items || []) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    }

    const payloads = [];
    const skipped = [];
    for (const order of eligible) {
      const payload = buildParcelPayload({
        order,
        items: itemsByOrder[order.id] || [],
        defaultDeliveryType: credentials.defaultDeliveryType,
      });
      const validationError = validateParcelPayload(payload);
      if (validationError) {
        skipped.push({
          order_id: order.id,
          tracking_code: order.tracking_code,
          error: validationError,
        });
        continue;
      }
      payloads.push({ order, payload });
    }

    if (payloads.length === 0) {
      return NextResponse.json(
        { error: "No valid parcels could be built.", skipped },
        { status: 400 },
      );
    }

    const result = await createSteadfastBulkOrders(
      payloads.map((row) => row.payload),
      credentials,
    );
    let rows = [];
    if (Array.isArray(result)) {
      rows = result;
    } else if (Array.isArray(result?.data)) {
      rows = result.data;
    } else if (typeof result?.data === "string") {
      try {
        const parsed = JSON.parse(result.data);
        if (Array.isArray(parsed)) rows = parsed;
      } catch {
        rows = [];
      }
    }

    const byInvoice = new Map(
      rows.map((row) => [String(row.invoice || ""), row]),
    );
    const now = new Date().toISOString();
    const created = [];
    const failed = [...skipped];

    for (const { order, payload } of payloads) {
      const row = byInvoice.get(payload.invoice);
      if (!row || row.status === "error" || !row.consignment_id) {
        failed.push({
          order_id: order.id,
          tracking_code: order.tracking_code,
          error: row?.message || "Courier rejected this parcel.",
        });
        continue;
      }

      const nextStatus =
        order.status === "pending" ? "confirmed" : order.status;
      const { data: updated, error: updateError } = await supabase
        .from("orders")
        .update({
          consignment_id: row.consignment_id,
          courier_tracking_code: row.tracking_code || null,
          courier_status: row.status === "success" ? "in_review" : row.status,
          courier_invoice: row.invoice || payload.invoice,
          parcel_note: payload.note || null,
          courier_delivery_type: payload.delivery_type,
          parcel_created_at: now,
          courier_synced_at: now,
          status: nextStatus,
          updated_at: now,
        })
        .eq("id", order.id)
        .select("id, tracking_code, consignment_id, courier_tracking_code, courier_status")
        .single();

      if (updateError) {
        failed.push({
          order_id: order.id,
          tracking_code: order.tracking_code,
          error: updateError.message,
        });
        continue;
      }
      created.push(updated);
    }

    return NextResponse.json({
      ok: true,
      created,
      failed,
      message: `Created ${created.length} parcel(s).`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Could not create bulk parcels." },
      { status: err.status || 500 },
    );
  }
}
