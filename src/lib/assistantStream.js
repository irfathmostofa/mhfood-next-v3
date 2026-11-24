import { AssistantError } from "@/lib/gemini";

// Wraps an async worker as a Server-Sent-Events response.
// work(send) calls send({type: "status" | "text" | "done" | "error", ...}).
export function streamResponse(work) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(obj)}\n\n`),
          );
        } catch {
          // client disconnected
        }
      };
      try {
        await work(send);
      } catch (err) {
        const known = err instanceof AssistantError;
        if (!known) console.error("[assistant] unexpected error:", err);
        send({
          type: "error",
          error: known
            ? err.message
            : "Something went wrong. Please try again.",
          code: known ? err.code : "unexpected",
        });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
