"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Send, X, ShoppingBag, Check, Loader2, Minus } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/components/Toast";
import { trackPurchase } from "@/components/Analytics";
import { cartPixelPayload } from "@/lib/pixel";

const COPY = {
  customer: {
    endpoint: "/api/chat",
    title: "Shopping assistant",
    launcher: "Ask AI",
    nudge: "কিছু খুঁজছেন? আমাকে জিজ্ঞেস করুন",
    hello:
      "আসসালামু আলাইকুম! কী খুঁজছেন? বলুন, আমি পণ্য বেছে দিতে ও অর্ডার নিতে সাহায্য করব।\n\nHi! Tell me what you need and I'll help you choose a product and place your order.",
    placeholder: "বাংলা বা English-এ লিখুন…",
    chips: [
      "আজকের অফার কী?",
      "Show me popular products",
      "আমি একটি গিফট খুঁজছি",
    ],
  },
  admin: {
    endpoint: "/api/admin/chat",
    title: "Store assistant",
    launcher: "Assistant",
    nudge: "",
    hello:
      "Ask me about sales, profit, stock, orders or expenses, in Bangla or English.\n\nবিক্রি, লাভ, স্টক, অর্ডার বা খরচ নিয়ে যেকোনো প্রশ্ন করুন।",
    placeholder: "e.g. আজকের সেলস কত? / low stock products",
    chips: [
      "আজকের সেলস রিপোর্ট",
      "Low stock products",
      "This month profit",
      "এখন কী কী দেখা দরকার?",
    ],
  },
};

const STATUS = {
  search_products: ["পণ্য খুঁজছি…", "Searching products…"],
  list_categories: ["ক্যাটাগরি দেখছি…", "Checking categories…"],
  find_delivery_area: ["এলাকা খুঁজছি…", "Finding your area…"],
  get_pickup_points: ["পিকআপ পয়েন্ট দেখছি…", "Checking pickup points…"],
  prepare_order: ["অর্ডার হিসাব করছি…", "Preparing your order…"],
  sales_summary: ["রিপোর্ট তৈরি করছি…", "Building the report…"],
  top_products: ["সেরা পণ্য দেখছি…", "Ranking products…"],
  stock_report: ["স্টক দেখছি…", "Checking stock…"],
  order_lookup: ["অর্ডার খুঁজছি…", "Looking up orders…"],
  expenses_summary: ["খরচ হিসাব করছি…", "Summing expenses…"],
  attention_summary: ["দেখে নিচ্ছি…", "Checking what needs attention…"],
};

const hasBangla = (s) => /[\u0980-\u09FF]/.test(String(s || ""));
const money = (n) => `৳${Number(n || 0).toFixed(0)}`;

export default function ChatAssistant({ mode = "customer" }) {
  const copy = COPY[mode];
  const isAdmin = mode === "admin";
  const pathname = usePathname();
  const { addItem } = useCart();
  const { success, error: toastError } = useToast();

  const [open, setOpen] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [placing, setPlacing] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to newest content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);

  // Focus the input when the panel opens; close on Escape
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // One-time friendly nudge for customers
  useEffect(() => {
    if (isAdmin || !copy.nudge) return;
    try {
      if (sessionStorage.getItem("ai_nudge_seen")) return;
    } catch {
      return;
    }
    const show = setTimeout(() => setNudge(true), 5000);
    const hide = setTimeout(() => setNudge(false), 14000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [isAdmin, copy.nudge]);

  function openPanel() {
    setOpen(true);
    setNudge(false);
    try {
      sessionStorage.setItem("ai_nudge_seen", "1");
    } catch {
      // ignore
    }
  }

  const lastDraftIndex = messages.reduce(
    (idx, m, i) => (m.orderDraft ? i : idx),
    -1,
  );

  async function send(raw) {
    const text = String(raw ?? input).trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user", text }];
    const idx = next.length; // index of the streaming assistant message
    setMessages([...next, { role: "assistant", text: "", streaming: true }]);
    setInput("");
    setLoading(true);
    setStatus("");
    const bn = hasBangla(text);

    let acc = "";
    const patch = (fields) =>
      setMessages((prev) =>
        prev.map((m, i) => (i === idx ? { ...m, ...fields } : m)),
      );

    try {
      const res = await fetch(copy.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next
            .filter((m) => !m.error)
            .slice(-14)
            .map((m) => ({ role: m.role, text: m.text, products: m.products })),
        }),
      });

      if (
        !res.ok ||
        !res.headers.get("content-type")?.includes("text/event-stream")
      ) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const handle = (evt) => {
        if (evt.type === "text") {
          acc += evt.delta;
          setStatus("");
          patch({ text: acc });
        } else if (evt.type === "status") {
          acc = ""; // drop any pre-tool chatter
          patch({ text: "" });
          const label = STATUS[evt.tool];
          setStatus(label ? label[bn ? 0 : 1] : "…");
        } else if (evt.type === "done") {
          patch({
            text: acc || evt.reply,
            streaming: false,
            products: evt.products || [],
            orderDraft: evt.orderDraft || null,
          });
        } else if (evt.type === "error") {
          throw new Error(evt.error || "Something went wrong.");
        }
      };

      const handleChunk = (raw) => {
        for (const line of raw.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          try {
            handle(JSON.parse(line.slice(5).trim()));
          } catch (err) {
            if (err instanceof SyntaxError) continue;
            throw err;
          }
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let m;
        while ((m = /\r?\n\r?\n/.exec(buf))) {
          handleChunk(buf.slice(0, m.index));
          buf = buf.slice(m.index + m[0].length);
        }
      }
      if (buf.trim()) handleChunk(buf);
    } catch (err) {
      patch({
        text: err.message || "Something went wrong.",
        error: true,
        streaming: false,
      });
    } finally {
      setLoading(false);
      setStatus("");
    }
  }

  async function confirmOrder(index) {
    const draft = messages[index]?.orderDraft;
    if (!draft || placing || draft.placedCode) return;
    setPlacing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: draft.items,
          customer: draft.customer,
          fulfillment: draft.fulfillment,
          locationKey: draft.locationKey,
          pickupPointId: draft.pickupPointId,
          couponCode: draft.couponCode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not place the order.");

      trackPurchase(
        cartPixelPayload(draft.items, draft.total, {
          order_id: data.trackingCode,
          transaction_id: data.trackingCode,
        }),
      );
      success("Order placed successfully.");
      setMessages((prev) => [
        ...prev.map((m, i) =>
          i === index
            ? {
                ...m,
                orderDraft: { ...m.orderDraft, placedCode: data.trackingCode },
              }
            : m,
        ),
        {
          role: "assistant",
          text: `অর্ডার সম্পন্ন হয়েছে! Order placed. Tracking code: ${data.trackingCode}`,
          trackingCode: data.trackingCode,
        },
      ]);
    } catch (err) {
      toastError(err.message || "Could not place the order.");
    } finally {
      setPlacing(false);
    }
  }

  function addToCart(product) {
    addItem(product, 1, []);
    success(`${product.name} added to cart`);
  }

  const isProductPage = /^\/product\/.+/.test(pathname || "");

  // Literal class strings so Tailwind can see them.
  const sideLauncher = isAdmin
    ? "right-4 sm:right-6 bottom-5 sm:bottom-6"
    : `left-4 ${isProductPage ? "bottom-[88px] lg:bottom-5" : "bottom-5"}`;
  const panelPos = isAdmin
    ? "sm:right-6 sm:bottom-6 sm:w-[420px] sm:h-[620px] origin-bottom-right"
    : "sm:left-5 sm:bottom-5 sm:w-[380px] sm:h-[560px] origin-bottom-left";

  const streamingEmpty =
    loading &&
    messages[messages.length - 1]?.streaming &&
    !messages[messages.length - 1]?.text;

  return (
    <>
      {/* ---------- Launcher ---------- */}
      <div className={`fixed z-[40] ${sideLauncher}`}>
        {nudge && !open && (
          <div className="absolute bottom-full mb-3 left-0 whitespace-nowrap animate-[fadeUp_0.3s_ease-out]">
            <div className="relative flex items-center gap-2 bg-surface border border-line rounded-2xl rounded-bl-md shadow-lg pl-3.5 pr-2 py-2 text-sm text-ink">
              <button type="button" onClick={openPanel} className="text-left">
                {copy.nudge}
              </button>
              <button
                type="button"
                onClick={() => setNudge(false)}
                aria-label="Dismiss"
                className="p-1 text-muted hover:text-ink"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={openPanel}
          aria-label={`Open ${copy.title}`}
          className={`group relative inline-flex items-center gap-2.5 h-12 pl-3 pr-4 rounded-full bg-primary text-white text-sm font-medium shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-95 ${
            open
              ? "scale-0 opacity-0 pointer-events-none"
              : "scale-100 opacity-100"
          }`}
        >
          <span className="relative flex items-center justify-center w-7 h-7">
            <span className="absolute inset-0 rounded-full bg-accent/60 animate-ping" />
            <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white transition-transform duration-300 group-hover:rotate-12">
              <Bot size={16} />
            </span>
          </span>
          <span>{copy.launcher}</span>
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
        </button>
      </div>

      {/* ---------- Panel ---------- */}
      <div
        aria-hidden={!open}
        className={`fixed z-[80] inset-0 sm:inset-auto flex flex-col bg-surface border border-line sm:rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ease-out ${panelPos} ${
          open
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-4 scale-95 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between px-4 h-12 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
            </span>
            <p className="text-sm font-medium text-ink">{copy.title}</p>
          </div>
          <div className="flex items-center gap-0.5">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => !loading && setMessages([])}
                className="px-2 py-1 text-xs text-muted hover:text-ink"
              >
                New chat
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Minimise"
              className="p-1.5 rounded-full text-muted hover:text-ink"
            >
              <Minus size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <Bubble role="assistant" text={copy.hello} />

          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {copy.chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => send(chip)}
                  className="px-3 py-1.5 rounded-full border border-line text-xs text-ink hover:border-primary hover:-translate-y-0.5 transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className="space-y-2">
              {(m.text || !m.streaming) && (
                <Bubble role={m.role} text={m.text} error={m.error} />
              )}

              {m.trackingCode && (
                <Link
                  href={`/track/${m.trackingCode}?placed=1`}
                  className="inline-block text-xs text-accent hover:underline"
                >
                  Track this order →
                </Link>
              )}

              {m.products?.length > 0 && (
                <div className="space-y-2">
                  {m.products.map((p) => (
                    <ProductRow key={p.id} product={p} onAdd={addToCart} />
                  ))}
                </div>
              )}

              {m.orderDraft && (
                <OrderDraftCard
                  draft={m.orderDraft}
                  active={i === lastDraftIndex}
                  placing={placing}
                  onConfirm={() => confirmOrder(i)}
                />
              )}
            </div>
          ))}

          {(streamingEmpty || status) && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </span>
              {status}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2 border-t border-line p-3 shrink-0"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            maxLength={1000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={copy.placeholder}
            className="input resize-none max-h-28"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center transition-transform active:scale-90 disabled:opacity-40"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </form>
      </div>

      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

function Bubble({ role, text, error }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed rounded-2xl px-3.5 py-2.5 ${
          mine
            ? "bg-primary text-white"
            : error
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-background text-ink border border-line"
        }`}
      >
        {text}
      </p>
    </div>
  );
}

function ProductRow({ product, onAdd }) {
  const hasOptions = product.variants?.length > 0;
  const outOfStock = Number(product.stock) <= 0;
  const onSale = product.regular_price > product.price;
  return (
    <div className="flex items-center gap-3 border border-line rounded-xl p-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={product.image_url || "https://placehold.co/100x100?text=No+Image"}
        alt={product.name}
        className="w-14 h-14 rounded-lg object-cover bg-primary/5 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <Link
          href={`/product/${product.slug}`}
          className="block text-sm font-medium text-ink truncate hover:text-accent"
        >
          {product.name}
        </Link>
        <p className="text-sm text-accent font-semibold">
          {money(product.price)}
          {onSale && (
            <span className="ml-1.5 text-xs text-muted line-through font-normal">
              {money(product.regular_price)}
            </span>
          )}
          {product.unit && (
            <span className="ml-1.5 text-[11px] text-muted font-normal">
              {product.unit}
            </span>
          )}
        </p>
      </div>
      {outOfStock ? (
        <span className="text-[11px] text-muted shrink-0">Out of stock</span>
      ) : hasOptions ? (
        <Link
          href={`/product/${product.slug}`}
          className="text-xs text-accent hover:underline shrink-0"
        >
          Options
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => onAdd(product)}
          aria-label={`Add ${product.name} to cart`}
          className="shrink-0 w-9 h-9 rounded-full border border-line text-ink flex items-center justify-center hover:border-primary active:scale-90 transition-transform"
        >
          <ShoppingBag size={15} />
        </button>
      )}
    </div>
  );
}

function OrderDraftCard({ draft, active, placing, onConfirm }) {
  const placed = Boolean(draft.placedCode);
  return (
    <div className="border border-line rounded-xl p-3.5 text-sm bg-surface">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
        Order summary
      </p>
      <ul className="space-y-1 mb-3">
        {draft.items.map((item, i) => (
          <li key={i} className="flex justify-between gap-3 text-ink">
            <span className="min-w-0">
              {item.product_name}
              {item.variant_text && (
                <span className="text-xs text-muted">
                  {" "}
                  ({item.variant_text})
                </span>
              )}{" "}
              × {item.quantity}
            </span>
            <span className="shrink-0">
              {money(item.price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-line pt-2 space-y-1 text-muted">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{money(draft.subtotal)}</span>
        </div>
        {draft.discount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>{draft.discountLabel || "Discount"}</span>
            <span>−{money(draft.discount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>{draft.deliveryLabel}</span>
          <span>
            {draft.deliveryCharge > 0 ? money(draft.deliveryCharge) : "FREE"}
          </span>
        </div>
        <div className="flex justify-between font-semibold text-ink pt-1">
          <span>Total (cash on delivery)</span>
          <span>{money(draft.total)}</span>
        </div>
      </div>
      <p className="text-xs text-muted mt-2">
        {draft.customer.name} · {draft.customer.phone}
        {draft.customer.address ? ` · ${draft.customer.address}` : ""}
      </p>

      {placed ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700">
          <Check size={14} /> Placed — {draft.placedCode}
        </p>
      ) : (
        <button
          type="button"
          onClick={onConfirm}
          disabled={!active || placing}
          className="btn btn-accent w-full mt-3 disabled:opacity-50"
        >
          {placing ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Placing…
            </>
          ) : active ? (
            "Confirm order"
          ) : (
            "Superseded by a newer summary"
          )}
        </button>
      )}
    </div>
  );
}
