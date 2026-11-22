// Minimal Gemini function-calling agent for the chat assistant.
// Server-only. The model can only call the tools we hand it; every tool
// is implemented in assistantCustomerTools.js / assistantAdminTools.js.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_HISTORY = 14;
const MAX_TEXT = 1500;

export class AssistantError extends Error {
  constructor(message, status = 500, code = "assistant_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function chatModel() {
  return (
    process.env.GEMINI_CHAT_MODEL ||
    process.env.GEMINI_MODEL ||
    "gemini-2.5-flash"
  );
}

function thinkingConfig(model) {
  if (/^gemini-2\.5/.test(model)) return { thinkingBudget: 0 };
  if (/^gemini-3/.test(model)) return { thinkingLevel: "low" };
  return undefined;
}

async function generate({ system, contents, tools }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new AssistantError(
      "The AI assistant is not configured (GEMINI_API_KEY is missing on the server).",
      503,
      "not_configured",
    );
  }

  const model = chatModel();
  const tc = thinkingConfig(model);

  let res;
  try {
    res = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        tools: [{ functionDeclarations: tools }],
        toolConfig: { functionCallingConfig: { mode: "AUTO" } },
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1500,
          ...(tc ? { thinkingConfig: tc } : {}),
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new AssistantError(
        "The AI took too long to answer. Please try again.",
        504,
        "timeout",
      );
    }
    console.error("[assistant] network error:", err?.message || err);
    throw new AssistantError("Could not reach the AI service.", 502, "network");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `[assistant] Gemini HTTP ${res.status} (${model}):`,
      body.slice(0, 500),
    );
    if (res.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(body)) {
      throw new AssistantError(
        "AI quota reached. Please try again in a few minutes.",
        429,
        "quota",
      );
    }
    if (res.status === 404) {
      throw new AssistantError(
        `AI model "${model}" was not found. Set GEMINI_CHAT_MODEL to a current Flash model.`,
        502,
        "model_not_found",
      );
    }
    throw new AssistantError(
      "The AI service returned an error.",
      502,
      "upstream",
    );
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  if (!candidate?.content?.parts?.length) {
    console.error(
      "[assistant] empty candidate:",
      candidate?.finishReason,
      JSON.stringify(data?.promptFeedback || {}),
    );
    throw new AssistantError(
      "The AI could not produce an answer. Please rephrase.",
      502,
      "empty",
    );
  }
  return candidate.content;
}

/**
 * Runs the model <-> tools loop until the model answers in plain text.
 * handlers[name](args, artifacts) -> JSON-serialisable result for the model.
 * `artifacts` is a per-request bag handlers fill for the UI (product cards,
 * order draft) so the UI never depends on the model re-typing data.
 */
export async function runAgent({
  system,
  history,
  tools,
  handlers,
  maxSteps = 6,
}) {
  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));
  const artifacts = { products: [], orderDraft: null };
  const toolsUsed = [];

  for (let step = 0; step < maxSteps; step++) {
    const content = await generate({ system, contents, tools });
    const parts = content.parts || [];
    const calls = parts.filter((p) => p.functionCall);

    if (calls.length === 0) {
      const text = parts
        .map((p) => p.text || "")
        .join("")
        .trim();
      if (!text) {
        throw new AssistantError(
          "The AI returned an empty answer. Please try again.",
          502,
          "empty",
        );
      }
      return { text, artifacts, toolsUsed };
    }

    // Push the model turn back unchanged (keeps thought signatures intact).
    contents.push(content);

    const responses = [];
    for (const { functionCall } of calls) {
      const { name, args } = functionCall;
      toolsUsed.push(name);
      let out;
      try {
        const handler = handlers[name];
        out = handler
          ? await handler(args || {}, artifacts)
          : { error: `Unknown tool: ${name}` };
      } catch (err) {
        console.error(
          `[assistant] tool "${name}" failed:`,
          err?.message || err,
        );
        out = { error: err?.message || "Tool failed." };
      }
      responses.push({ functionResponse: { name, response: { result: out } } });
    }
    contents.push({ role: "user", parts: responses });
  }

  throw new AssistantError(
    "The assistant needed too many steps. Please ask in a simpler way.",
    502,
    "too_many_steps",
  );
}

function clip(value, max) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function productContext(products) {
  const rows = products.slice(0, 8).map((p) => {
    const variants = (Array.isArray(p.variants) ? p.variants : [])
      .slice(0, 12)
      .map((v) => `${clip(v.id, 40)}=${clip(v.name, 20)}:${clip(v.value, 20)}`)
      .join("; ");
    return `id=${clip(p.id, 40)} | ${clip(p.name, 80)} | ৳${
      Number(p.price) || 0
    }${variants ? ` | variants: ${variants}` : ""}`;
  });
  return `[Products already shown to the customer]\n${rows.join("\n")}`;
}

/** Client sends {role,text,products?}[]; we keep only what the model needs. */
export function sanitizeHistory(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const m of list.slice(-MAX_HISTORY)) {
    const role =
      m?.role === "assistant"
        ? "assistant"
        : m?.role === "user"
          ? "user"
          : null;
    let text = String(m?.text ?? "")
      .trim()
      .slice(0, MAX_TEXT);
    if (!role || !text) continue;
    if (
      role === "assistant" &&
      Array.isArray(m.products) &&
      m.products.length
    ) {
      text += `\n${productContext(m.products)}`;
    }
    const last = out[out.length - 1];
    if (last && last.role === role) last.text += `\n${text}`;
    else out.push({ role, text });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

/** Best-effort log row. Never throws, never blocks the answer. */
export async function logChat(client, row) {
  try {
    const { error } = await client.from("assistant_logs").insert({
      mode: row.mode,
      user_message: clip(row.userMessage, 1000) || null,
      reply: clip(row.reply, 2000) || null,
      tools: row.tools || [],
      error: row.error ? clip(row.error, 500) : null,
    });
    if (error) console.error("[assistant] log insert failed:", error.message);
  } catch (err) {
    console.error("[assistant] log insert failed:", err?.message || err);
  }
}
