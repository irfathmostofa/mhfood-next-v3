import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/admin";
import { getTheme } from "@/lib/site";
import { logChat, runAgent, sanitizeHistory } from "@/lib/gemini";
import { streamResponse } from "@/lib/assistantStream";
import { adminSystemPrompt } from "@/lib/assistantPrompts";
import { ADMIN_TOOLS, createAdminHandlers } from "@/lib/assistantAdminTools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  try {
    await requireAdmin(); // 401 for anyone without an admin session
  } catch (err) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: err?.status || 401 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const history = sanitizeHistory(body.messages);
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Send a message first." },
      { status: 400 },
    );
  }
  const userMessage = history[history.length - 1].text;

  const [sb, theme] = await Promise.all([createAdminClient(), getTheme()]);

  return streamResponse(async (send) => {
    try {
      const { text, toolsUsed } = await runAgent({
        system: adminSystemPrompt(theme?.store_name || "the store"),
        history,
        tools: ADMIN_TOOLS,
        handlers: createAdminHandlers(sb),
        onEvent: send,
      });
      send({ type: "done", reply: text });
      await logChat(sb, {
        mode: "admin",
        userMessage,
        reply: text,
        tools: toolsUsed,
      });
    } catch (err) {
      await logChat(sb, { mode: "admin", userMessage, error: err?.message });
      throw err;
    }
  });
}
