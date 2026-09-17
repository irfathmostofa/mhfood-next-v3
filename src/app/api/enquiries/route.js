import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";

function clean(value) {
  return String(value || "").trim();
}

export async function POST(req) {
  const ip = clientIp(req);
  const limited = rateLimit(`enquiry:${ip}`, { limit: 8, windowMs: 10 * 60 * 1000 });
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  try {
    const body = await req.json();
    const name = clean(body.name);
    const phone = clean(body.phone);
    const email = clean(body.email);
    const message = clean(body.message);
    const productId = clean(body.product_id);
    const quantity = Math.max(1, Math.min(99, Number(body.quantity) || 1));

    if (!name || !phone) {
      return NextResponse.json(
        { error: "Name and phone are required." },
        { status: 400 },
      );
    }
    if (!productId) {
      return NextResponse.json(
        { error: "Product is required." },
        { status: 400 },
      );
    }
    if (phone.replace(/\D/g, "").length < 8) {
      return NextResponse.json(
        { error: "Enter a valid phone number." },
        { status: 400 },
      );
    }

    const { data: settings } = await supabase
      .from("site_settings")
      .select("enquiry_enabled")
      .eq("id", 1)
      .maybeSingle();

    if (settings && settings.enquiry_enabled === false) {
      return NextResponse.json(
        { error: "Product enquiry is currently disabled." },
        { status: 403 },
      );
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, slug, is_active")
      .eq("id", productId)
      .maybeSingle();

    if (productError || !product || product.is_active === false) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const { error } = await supabase.from("product_enquiries").insert({
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      customer_name: name,
      phone,
      email: email || null,
      quantity,
      message: message || null,
      status: "new",
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Could not submit enquiry." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not submit enquiry." },
      { status: 500 },
    );
  }
}
