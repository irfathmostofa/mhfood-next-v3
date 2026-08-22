import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { sendOrderDeliveredEmail } from "@/lib/email";
import { sendOrderDeliveredSMS } from "@/lib/sms";

export async function PATCH(req, { params }) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "Order id and status are required." },
        { status: 400 },
      );
    }

    const { data: current, error: fetchError } = await supabase
      .from("orders")
      .select("id, status, tracking_code, customer_name, phone, email")
      .eq("id", id)
      .single();
    if (fetchError || !current) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const { data: updated, error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // When an order is delivered, fire the review-request email + SMS.
    if (status === "delivered" && current.status !== "delivered") {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_name, variant_text, quantity, price")
        .eq("order_id", id);

      if (current.email) {
        sendOrderDeliveredEmail({
          toEmail: current.email,
          customerName: current.customer_name,
          trackingCode: current.tracking_code,
          delivery: "Delivered",
          orderId: id,
          items: items || [],
        }).catch(() => {});
      }
      sendOrderDeliveredSMS({
        phone: current.phone,
        customerName: current.customer_name,
        trackingCode: current.tracking_code,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, order: updated });
  } catch (err) {
    const status = err.status || 500;
    return NextResponse.json(
      { error: err.message || "Something went wrong." },
      { status },
    );
  }
}
