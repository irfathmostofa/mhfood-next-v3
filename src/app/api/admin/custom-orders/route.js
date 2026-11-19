import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/admin";
import { CUSTOM_ORDER_BUCKET } from "@/lib/customOrders";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from("custom_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message ||
            "Could not load custom orders. Run 023_custom_orders.sql first.",
        },
        { status: 500 },
      );
    }

    const rows = data || [];
    const paths = rows.map((r) => r.file_path).filter(Boolean);
    const urlByPath = {};

    if (paths.length > 0) {
      const { data: signed } = await supabase.storage
        .from(CUSTOM_ORDER_BUCKET)
        .createSignedUrls(paths, 60 * 60); // 1 hour
      for (const item of signed || []) {
        if (item?.path && item?.signedUrl)
          urlByPath[item.path] = item.signedUrl;
      }
    }

    return NextResponse.json({
      ok: true,
      orders: rows.map((r) => ({
        ...r,
        file_url: r.file_path ? urlByPath[r.file_path] || null : null,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: err.status || 500 },
    );
  }
}
