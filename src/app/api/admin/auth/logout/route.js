import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin";

export async function POST() {
  try {
    const supabase = await createAdminClient();
    await supabase.auth.signOut();
  } catch {
    // best-effort — the cookie is cleared by @supabase/ssr on next request
  }
  return NextResponse.json({ ok: true });
}
