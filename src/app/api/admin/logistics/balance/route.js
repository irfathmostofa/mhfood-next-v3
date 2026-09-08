import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadSteadfastCredentials } from "@/lib/logistics";
import { getSteadfastBalance } from "@/lib/steadfast";

export async function GET() {
  try {
    await requireAdmin();
    const { credentials } = await loadSteadfastCredentials();
    const data = await getSteadfastBalance(credentials);
    return NextResponse.json({
      ok: true,
      current_balance: data?.current_balance ?? data?.balance ?? 0,
      raw: data,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Could not load courier balance." },
      { status: err.status || 500 },
    );
  }
}
