import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/admin";
import { getTheme } from "@/lib/site";
import {
  AssistantError,
  logChat,
  runAgent,
  sanitizeHistory,
} from "@/lib/gemini";
import { adminSystemPrompt } from "@/lib/assistantPrompts";
import { ADMIN_TOOLS, createAdminHandlers } from "@/lib/assistantAdminTools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  let sb = null;
  let userMessage = "";
  try {
    await requireAdmin(); // 401 for anyone without an admin session
    sb = await createAdminClient();

    const body = await req.json().catch(() => ({}));
    const history = sanitizeHistory(body.messages);
    if (history.length === 0 || history[history.length - 1].role !== "user") {
      return NextResponse.json(
        { error: "Send a message first." },
        { status: 400 },
      );
    }
    userMessage = history[history.length - 1].text;

    const theme = await getTheme();
    const { text, toolsUsed } = await runAgent({
      system: adminSystemPrompt(theme?.store_name || "the store"),
      history,
      tools: ADMIN_TOOLS,
      handlers: createAdminHandlers(sb),
    });

    await logChat(sb, {
      mode: "admin",
      userMessage,
      reply: text,
      tools: toolsUsed,
    });

    return NextResponse.json({ ok: true, reply: text });
  } catch (err) {
    const known = err instanceof AssistantError;
    if (!known && !err?.status) console.error("[api/admin/chat] error:", err);
    if (sb) {
      await logChat(sb, {
        mode: "admin",
        userMessage,
        error: err?.message || "unknown",
      });
    }
    return NextResponse.json(
      {
        error: known
          ? err.message
          : err?.status === 401
            ? "Unauthorized"
            : "Something went wrong. Please try again.",
        code: known ? err.code : "unexpected",
      },
      { status: err?.status || 500 },
    );
  }
}
