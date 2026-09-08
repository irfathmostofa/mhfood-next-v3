import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadSteadfastCredentials } from "@/lib/logistics";
import { getSteadfastPayments } from "@/lib/steadfast";

export async function GET() {
  try {
    await requireAdmin();
    const { credentials } = await loadSteadfastCredentials();
    const data = await getSteadfastPayments(credentials);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Could not load courier payments." },
      { status: err.status || 500 },
    );
  }
}
