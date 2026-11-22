import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { getTheme } from "@/lib/site";
import {
  AssistantError,
  logChat,
  runAgent,
  sanitizeHistory,
} from "@/lib/gemini";
import { customerSystemPrompt } from "@/lib/assistantPrompts";
import {
  CUSTOMER_TOOLS,
  createCustomerHandlers,
} from "@/lib/assistantCustomerTools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  const ip = clientIp(req);
  const limited = rateLimit(`chat:${ip}`, {
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let userMessage = "";
  try {
    const body = await req.json().catch(() => ({}));
    const history = sanitizeHistory(body.messages);
    if (history.length === 0 || history[history.length - 1].role !== "user") {
      return NextResponse.json(
        { error: "Send a message first." },
        { status: 400 },
      );
    }
    userMessage = history[history.length - 1].text;

    const { data: settings } = await supabase
      .from("site_settings")
      .select("ai_assistant_enabled")
      .eq("id", 1)
      .maybeSingle();
    if (settings && settings.ai_assistant_enabled === false) {
      return NextResponse.json(
        { error: "The assistant is currently turned off." },
        { status: 403 },
      );
    }

    const theme = await getTheme();
    const { text, artifacts, toolsUsed } = await runAgent({
      system: customerSystemPrompt(theme?.store_name || "our store"),
      history,
      tools: CUSTOMER_TOOLS,
      handlers: createCustomerHandlers(),
    });

    await logChat(supabase, {
      mode: "customer",
      userMessage,
      reply: text,
      tools: toolsUsed,
    });

    return NextResponse.json({
      ok: true,
      reply: text,
      products: artifacts.products,
      orderDraft: artifacts.orderDraft,
    });
  } catch (err) {
    const known = err instanceof AssistantError;
    if (!known) console.error("[api/chat] unexpected error:", err);
    await logChat(supabase, {
      mode: "customer",
      userMessage,
      error: err?.message || "unknown",
    });
    return NextResponse.json(
      {
        error: known ? err.message : "Something went wrong. Please try again.",
        code: known ? err.code : "unexpected",
      },
      { status: known ? err.status : 500 },
    );
  }
}
