import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { sendBulkSMS } from "@/lib/sms";

export async function POST(req) {
  try {
    await requireAdmin();
    const { phones, message } = await req.json();

    if (!phones || phones.length === 0 || !message?.trim()) {
      return NextResponse.json(
        { error: "Phone numbers and a message are required." },
        { status: 400 },
      );
    }

    const result = await sendBulkSMS({ phones, message });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Could not send SMS." },
      { status: 500 },
    );
  }
}
