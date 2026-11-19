import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/admin";
import { CUSTOM_ORDER_BUCKET, CUSTOM_ORDER_STATUSES } from "@/lib/customOrders";

export async function PATCH(req, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const supabase = await createAdminClient();

    const patch = {};
    if (body.status !== undefined) {
      if (!CUSTOM_ORDER_STATUSES.some((s) => s.key === body.status)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      patch.status = body.status;
    }
    if (body.admin_note !== undefined) {
      patch.admin_note =
        String(body.admin_note || "")
          .trim()
          .slice(0, 2000) || null;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("custom_orders")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, order: data });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Could not update." },
      { status: err.status || 500 },
    );
  }
}

export async function DELETE(_req, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const supabase = await createAdminClient();

    const { data: row } = await supabase
      .from("custom_orders")
      .select("file_path")
      .eq("id", id)
      .maybeSingle();

    if (row?.file_path) {
      await supabase.storage.from(CUSTOM_ORDER_BUCKET).remove([row.file_path]);
    }

    const { error } = await supabase
      .from("custom_orders")
      .delete()
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Could not delete." },
      { status: err.status || 500 },
    );
  }
}
