import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/admin";
import { publicSmsSettings } from "@/lib/sms";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("sms_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message ||
            "Could not load SMS settings. Run 014_sms_settings.sql first.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, settings: publicSmsSettings(data) });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: err.status || 500 },
    );
  }
}

export async function PATCH(req) {
  try {
    await requireAdmin();
    const supabase = await createAdminClient();
    const body = await req.json();

    const payload = {
      id: 1,
      provider: "bulksmsbd",
      is_enabled: Boolean(body.is_enabled),
    };

    if (typeof body.sender_id === "string") {
      payload.sender_id = body.sender_id.trim();
    }
    if (typeof body.api_key === "string" && body.api_key.trim()) {
      payload.api_key = body.api_key.trim();
    }

    const { data, error } = await supabase
      .from("sms_settings")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Could not save SMS settings." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, settings: publicSmsSettings(data) });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: err.status || 500 },
    );
  }
}
