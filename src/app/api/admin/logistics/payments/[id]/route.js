import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadSteadfastCredentials } from "@/lib/logistics";
import { getSteadfastPayment } from "@/lib/steadfast";

export async function GET(_req, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Payment id is required." },
        { status: 400 },
      );
    }
    const { credentials } = await loadSteadfastCredentials();
    const data = await getSteadfastPayment(id, credentials);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Could not load payment." },
      { status: err.status || 500 },
    );
  }
}
