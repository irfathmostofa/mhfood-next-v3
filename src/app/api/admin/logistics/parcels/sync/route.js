import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadSteadfastCredentials } from "@/lib/logistics";
import { getSteadfastStatusByCid } from "@/lib/steadfast";
import { sendOrderDeliveredEmail } from "@/lib/email";
import { sendOrderDeliveredSMS } from "@/lib/sms";

export async function POST(req) {
  try {
    await requireAdmin();
    const { supabase, credentials } = await loadSteadfastCredentials();
    const body = await req.json().catch(() => ({}));
    const orderIds = Array.isArray(body.orderIds) ? body.orderIds : null;

    let query = supabase
      .from("orders")
      .select(
        "id, consignment_id, courier_status, status, tracking_code, customer_name, phone, email",
      )
      .not("consignment_id", "is", null);

    if (orderIds?.length) {
      query = query.in("id", orderIds);
    } else {
      query = query.not("courier_status", "in", `(delivered,cancelled)`);
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    const results = [];
    for (const order of orders || []) {
      try {
        const data = await getSteadfastStatusByCid(
          order.consignment_id,
          credentials,
        );
        const courierStatus = data?.delivery_status || data?.status;
        if (!courierStatus) {
          results.push({
            order_id: order.id,
            ok: false,
            error: "No status returned.",
          });
          continue;
        }

        const patch = {
          courier_status: courierStatus,
          courier_synced_at: new Date().toISOString(),
        };

        if (courierStatus === "delivered" && order.status !== "delivered") {
          patch.status = "delivered";
        } else if (
          courierStatus === "cancelled" &&
          order.status !== "cancelled" &&
          order.status !== "delivered"
        ) {
          patch.status = "cancelled";
        } else if (
          ["pending", "in_review", "hold"].includes(courierStatus) &&
          order.status === "pending"
        ) {
          patch.status = "confirmed";
        } else if (
          courierStatus === "delivered_approval_pending" &&
          order.status !== "delivered"
        ) {
          patch.status = "out_for_delivery";
        }

        const { error: updateError } = await supabase
          .from("orders")
          .update(patch)
          .eq("id", order.id);

        if (updateError) throw updateError;

        if (patch.status === "delivered") {
          const { data: items } = await supabase
            .from("order_items")
            .select("product_name, variant_text, quantity, price")
            .eq("order_id", order.id);
          if (order.email) {
            sendOrderDeliveredEmail({
              toEmail: order.email,
              customerName: order.customer_name,
              trackingCode: order.tracking_code,
              delivery: "Delivered",
              orderId: order.id,
              items: items || [],
            }).catch((err) => {
              console.error("Order delivered email failed:", err.message);
            });
          }
          sendOrderDeliveredSMS({
            phone: order.phone,
            customerName: order.customer_name,
            trackingCode: order.tracking_code,
          }).catch((err) => {
            console.error("Order delivered SMS failed:", err.message);
          });
        }

        results.push({
          order_id: order.id,
          ok: true,
          courier_status: courierStatus,
        });
      } catch (syncErr) {
        results.push({
          order_id: order.id,
          ok: false,
          error: syncErr.message,
        });
      }
    }

    const updated = results.filter((row) => row.ok).length;
    return NextResponse.json({
      ok: true,
      updated,
      total: results.length,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Could not sync parcel statuses." },
      { status: err.status || 500 },
    );
  }
}
