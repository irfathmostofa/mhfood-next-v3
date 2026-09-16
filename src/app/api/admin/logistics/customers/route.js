import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/admin";

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(0, 15);
}

// Merge the saved customer directory with customers derived from past
// orders so the parcel form always shows the full "old customer" list.
export async function GET() {
  try {
    await requireAdmin();
    const supabase = await createAdminClient();

    const [customerRes, orderRes] = await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1000),
      supabase
        .from("orders")
        .select("customer_name, phone, email, address, created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    // A missing customers table should not break the form.
    const directory =
      customerRes.error && /customers/i.test(customerRes.error.message || "")
        ? []
        : customerRes.data || [];

    const map = new Map();
    for (const c of directory) {
      const phone = normalizePhone(c.phone);
      if (!phone) continue;
      map.set(phone, {
        id: c.id,
        name: c.name || "",
        phone,
        email: c.email || "",
        address: c.address || "",
        saved: true,
      });
    }

    for (const o of orderRes.data || []) {
      const phone = normalizePhone(o.phone);
      if (!phone) continue;
      const existing = map.get(phone);
      if (!existing) {
        map.set(phone, {
          id: null,
          name: o.customer_name || "",
          phone,
          email: o.email || "",
          address: o.address || "",
          saved: false,
        });
        continue;
      }
      if (!existing.name && o.customer_name) existing.name = o.customer_name;
      if (!existing.email && o.email) existing.email = o.email;
      if (!existing.address && o.address) existing.address = o.address;
    }

    const customers = [...map.values()].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || "")),
    );

    return NextResponse.json({ ok: true, customers });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: err.status || 500 },
    );
  }
}

export async function POST(req) {
  try {
    await requireAdmin();
    const supabase = await createAdminClient();
    const body = await req.json();

    const name = String(body.name || "").trim();
    const phone = normalizePhone(body.phone);
    if (!name) {
      return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "Customer phone is required." }, { status: 400 });
    }

    const payload = {
      name,
      phone,
      email: String(body.email || "").trim() || null,
      address: String(body.address || "").trim() || null,
      notes: String(body.notes || "").trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("customers")
      .upsert(payload, { onConflict: "phone" })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Could not save customer." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, customer: data });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: err.status || 500 },
    );
  }
}
