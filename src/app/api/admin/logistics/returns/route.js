import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadSteadfastCredentials } from "@/lib/logistics";
import {
  createSteadfastReturn,
  getSteadfastReturns,
} from "@/lib/steadfast";

export async function GET() {
  try {
    await requireAdmin();
    const { credentials } = await loadSteadfastCredentials();
    const data = await getSteadfastReturns(credentials);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Could not load return requests." },
      { status: err.status || 500 },
    );
  }
}

export async function POST(req) {
  try {
    await requireAdmin();
    const { credentials } = await loadSteadfastCredentials();
    const body = await req.json();

    const payload = {
      reason: body.reason || undefined,
    };
    if (body.consignment_id) payload.consignment_id = body.consignment_id;
    else if (body.invoice) payload.invoice = body.invoice;
    else if (body.tracking_code) payload.tracking_code = body.tracking_code;

    if (!payload.consignment_id && !payload.invoice && !payload.tracking_code) {
      return NextResponse.json(
        { error: "Consignment id, invoice, or tracking code is required." },
        { status: 400 },
      );
    }

    const data = await createSteadfastReturn(payload, credentials);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Could not create return request." },
      { status: err.status || 500 },
    );
  }
}
