import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/admin";

export async function POST(req) {
  try {
    await requireAdmin();

    const { imagePath, productId, mode, language, name, storeName } = await req
      .json()
      .catch(() => ({}));
    if (!imagePath || !productId) {
      return NextResponse.json(
        { error: "imagePath and productId are required." },
        { status: 400 },
      );
    }

    const supabase = await createAdminClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : undefined;

    const { data, error } = await supabase.functions.invoke(
      "process-product-image",
      {
        headers,
        body: {
          imagePath,
          productId,
          mode,
          language,
          name,
          storeName: storeName || "M.H.Food",
        },
      },
    );

    if (error) {
      // error.context is the raw Response from the edge function when it
      // returned a non-2xx status (a FunctionsHttpError). Read its body to
      // get our own fail()-generated message and real status code instead
      // of collapsing every failure into a blanket 502/generic message.
      //
      // Duck-type instead of `instanceof Response` -- in some Next.js dev
      // setups more than one Response implementation can be loaded in the
      // same process, which makes `instanceof` silently return false even
      // when error.context genuinely is a Response, and we lose the real
      // message. Checking for a callable .json()/.text() is more reliable.
      let detail = error.message || "The AI pipeline failed.";
      let status = 500;
      const ctx = error?.context;

      console.error(
        "[ai/process] raw error before extraction:",
        JSON.stringify({
          name: error?.name,
          message: error?.message,
          ctxType: ctx?.constructor?.name,
          ctxStatus: ctx?.status,
          ctxOk: ctx?.ok,
          hasJsonFn: typeof ctx?.json === "function",
          hasTextFn: typeof ctx?.text === "function",
        }),
      );

      if (ctx && typeof ctx.status === "number") {
        status = ctx.status;
      }

      if (ctx && typeof ctx.json === "function") {
        try {
          const cloned = typeof ctx.clone === "function" ? ctx.clone() : ctx;
          const body = await cloned.json();
          if (body && typeof body === "object" && body.error) {
            detail = body.error;
          }
        } catch (jsonErr) {
          if (typeof ctx.text === "function") {
            try {
              const cloned =
                typeof ctx.clone === "function" ? ctx.clone() : ctx;
              const text = await cloned.text();
              if (text) detail = text;
            } catch (textErr) {
              console.error(
                "[ai/process] could not read error.context body as json or text:",
                jsonErr?.message,
                textErr?.message,
              );
            }
          }
        }
      } else if (ctx && (ctx.message || ctx.error)) {
        // context is already a plain object (e.g. FunctionsRelayError),
        // not a Response -- read fields directly.
        detail = ctx.message || ctx.error;
      }

      console.error(
        "[ai/process] invoke failed:",
        JSON.stringify({ status, detail, name: error?.name }),
      );
      return NextResponse.json({ error: String(detail) }, { status });
    }

    return NextResponse.json(data ?? { ok: true });
  } catch (err) {
    const status = err?.status || 500;
    console.error("[ai/process] route error:", err);
    return NextResponse.json(
      { error: err?.message || "Something went wrong." },
      { status },
    );
  }
}
