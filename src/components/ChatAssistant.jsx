"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Send, X, Loader2, ShoppingBag, Check } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/components/Toast";
import { trackPurchase } from "@/components/Analytics";
import { cartPixelPayload } from "@/lib/pixel";

const COPY = {
  customer: {
    endpoint: "/api/chat",
    title: "Shopping assistant",
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

const money = (n) => `৳${Number(n || 0).toFixed(0)}`;

export default function ChatAssistant({
  mode = "customer",
  variant = "floating",
}) {
  const copy = COPY[mode];
  const pathname = usePathname();
  const { addItem } = useCart();
  const { success, error: toastError } = useToast();

  const [open, setOpen] = useState(variant === "page");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);

  const lastDraftIndex = messages.reduce(
    (idx, m, i) => (m.orderDraft ? i : idx),
    -1,
  );

  async function send(raw) {
    const text = String(raw ?? input).trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    setLoading(true);

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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply,
          products: data.products || [],
          orderDraft: data.orderDraft || null,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: err.message, error: true },
      ]);
    } finally {
      setLoading(false);
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

  const panel = (
    <div
      className={
        variant === "page"
          ? "flex flex-col h-[calc(100dvh-8rem)] sm:h-[calc(100dvh-6rem)] bg-surface border border-line rounded-2xl overflow-hidden"
          : "fixed z-[80] inset-0 sm:inset-auto sm:bottom-5 sm:left-5 sm:w-[380px] sm:h-[560px] flex flex-col bg-surface border border-line sm:rounded-2xl shadow-xl overflow-hidden"
      }
    >
      <div className="flex items-center justify-between px-4 h-12 border-b border-line shrink-0">
        <p className="text-sm font-medium text-ink">{copy.title}</p>
        {variant === "floating" && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close assistant"
            className="p-1.5 rounded-full text-muted hover:text-ink"
          >
            <X size={18} />
          </button>
        )}
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
                className="px-3 py-1.5 rounded-full border border-line text-xs text-ink hover:border-primary"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="space-y-2">
            <Bubble role={m.role} text={m.text} error={m.error} />

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

        {loading && (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Loader2 size={13} className="animate-spin" /> Thinking…
          </p>
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
          className="shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );

  if (variant === "page") return panel;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open shopping assistant"
          className={`fixed left-4 z-[40] inline-flex items-center gap-2 h-11 px-4 rounded-full bg-primary text-white text-sm font-medium shadow-lg hover:opacity-90 transition-opacity ${
            isProductPage ? "bottom-[88px] lg:bottom-5" : "bottom-5"
          }`}
        >
          <Bot size={18} /> Ask AI
        </button>
      )}
      {open && panel}
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
          className="shrink-0 w-9 h-9 rounded-full border border-line text-ink flex items-center justify-center hover:border-primary"
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
