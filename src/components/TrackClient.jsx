"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Search, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";

const STEPS = [
  { key: "pending", label: "Received" },
  { key: "confirmed", label: "Confirmed" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

export default function TrackClient() {
  const { code } = useParams();
  const searchParams = useSearchParams();
  const justPlaced = searchParams.get("placed") === "1";

  const [inputCode, setInputCode] = useState(code || "");
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(!!code);
  const [error, setError] = useState("");

  useEffect(() => {
    if (code) lookupOrder(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function lookupOrder(trackingCode) {
    setLoading(true);
    setError("");
    setOrder(null);

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("tracking_code", String(trackingCode).trim().toUpperCase())
      .maybeSingle();

    if (orderError || !orderData) {
      setError(
        "No order found with that tracking code. Please check and try again.",
      );
      setLoading(false);
      return;
    }

    const { data: itemRows } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderData.id);

    setOrder(orderData);
    setItems(itemRows || []);
    setLoading(false);
  }

  function handleSearch(e) {
    e.preventDefault();
    if (!inputCode.trim()) return;
    window.location.href = `/track/${inputCode.trim().toUpperCase()}`;
  }

  const isCancelled = order?.status === "cancelled";
  const currentStepIndex = order
    ? STEPS.findIndex((s) => s.key === order.status)
    : -1;

  return (
    <div className="max-w-4xl mx-auto px-5 py-12">
      {justPlaced && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl px-5 py-4 mb-8">
          Your order has been placed! A confirmation email is on its way —
          save this tracking code to check your order status anytime.
        </div>
      )}

      <h1 className="font-display text-2xl sm:text-3xl text-ink mb-6">
        Track Your Order
      </h1>

      <form onSubmit={handleSearch} className="flex gap-2 mb-10">
        <input
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          placeholder="Enter tracking code, e.g. TRK-8F2K9"
          className="input"
        />
        <button type="submit" className="btn btn-primary shrink-0 px-6">
          <Search size={16} /> Track
        </button>
      </form>

      {loading && (
        <p className="text-sm text-muted">Looking up your order...</p>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {order && (
        <div className="card p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted mb-1">
                Tracking Code
              </p>
              <p className="text-lg font-semibold text-ink">
                {order.tracking_code}
              </p>
            </div>
            <p className="text-sm text-muted">
              {new Date(order.created_at).toLocaleDateString()}
            </p>
          </div>

          {isCancelled ? (
            <div className="mb-8 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              This order has been cancelled.
            </div>
          ) : (
            <div className="mb-8">
              <div className="flex items-start">
                {STEPS.map((step, i) => (
                  <div key={step.key} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-medium shrink-0 ${
                          i <= currentStepIndex
                            ? "bg-primary text-white"
                            : "bg-primary/10 text-muted"
                        }`}
                      >
                        {i < currentStepIndex ? <Check size={14} /> : i + 1}
                      </div>
                      <p
                        className={`text-[9px] sm:text-xs mt-1.5 sm:mt-2 text-center w-12 sm:w-20 leading-tight ${
                          i <= currentStepIndex ? "text-ink font-medium" : "text-muted"
                        }`}
                      >
                        {step.label}
                      </p>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-0.5 sm:mx-1 mt-3 sm:mt-4 ${
                          i < currentStepIndex ? "bg-primary" : "bg-primary/10"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-line pt-5">
            <p className="text-sm font-medium text-ink mb-3">Items</p>
            <ul className="space-y-2 mb-5">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between text-sm text-muted">
                  <span>
                    {item.product_name}
                    {item.variant_text && (
                      <span className="text-xs text-muted/70"> ({item.variant_text})</span>
                    )}{" "}
                    × {item.quantity}
                  </span>
                  <span>৳{(item.price * item.quantity).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5 border-t border-line pt-3">
              <div className="flex justify-between text-sm text-muted">
                <span>Subtotal</span>
                <span>
                  ৳
                  {(
                    Number(order.total_amount) -
                    Number(order.delivery_charge || 0) +
                    Number(order.discount_amount || 0)
                  ).toFixed(2)}
                </span>
              </div>
              {Number(order.discount_amount) > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>{order.discount_label || "Discount"}</span>
                  <span>−৳{Number(order.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-muted">
                <span>Delivery</span>
                <span>
                  {Number(order.delivery_charge) === 0 ? (
                    <span className="text-emerald-600 font-medium">FREE</span>
                  ) : (
                    `৳${Number(order.delivery_charge || 0).toFixed(2)}`
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-ink border-t border-line pt-2">
                <span>Total</span>
                <span>৳{order.total_amount}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-line mt-5 pt-5 text-sm text-muted">
            <p className="font-medium text-ink mb-1">Delivery Address</p>
            <p>{order.address}</p>
            <p className="mt-1">{order.phone}</p>
          </div>
        </div>
      )}
    </div>
  );
}
