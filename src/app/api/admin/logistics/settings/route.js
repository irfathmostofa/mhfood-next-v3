import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/admin";
import { maskSecret, resolveSteadfastCredentials } from "@/lib/steadfast";

function publicSettings(row) {
  const credentials = resolveSteadfastCredentials(row);
  return {
    id: row?.id || 1,
    provider: row?.provider || "steadfast",
    is_enabled: Boolean(row?.is_enabled),
    default_delivery_type: Number(row?.default_delivery_type || 0) === 1 ? 1 : 0,
    api_key_masked: maskSecret(row?.api_key),
    secret_key_masked: maskSecret(row?.secret_key),
    has_api_key: Boolean(row?.api_key),
    has_secret_key: Boolean(row?.secret_key),
    env_configured: Boolean(
      process.env.STEADFAST_API_KEY && process.env.STEADFAST_SECRET_KEY,
    ),
    configured: credentials.configured,
    updated_at: row?.updated_at || null,
  };
}

export async function GET() {
  try {
    await requireAdmin();
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("logistics_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message ||
            "Could not load logistics settings. Run 012_logistics.sql first.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, settings: publicSettings(data) });
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
      provider: "steadfast",
      is_enabled: Boolean(body.is_enabled),
      default_delivery_type: Number(body.default_delivery_type) === 1 ? 1 : 0,
    };

    if (typeof body.api_key === "string" && body.api_key.trim()) {
      payload.api_key = body.api_key.trim();
    }
    if (typeof body.secret_key === "string" && body.secret_key.trim()) {
      payload.secret_key = body.secret_key.trim();
    }

    const { data, error } = await supabase
      .from("logistics_settings")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Could not save logistics settings." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, settings: publicSettings(data) });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: err.status || 500 },
    );
  }
}
