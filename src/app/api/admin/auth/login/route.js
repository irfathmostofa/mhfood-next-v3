import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin";

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const supabase = await createAdminClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
