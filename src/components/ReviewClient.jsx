"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import StarRating from "@/components/StarRating";

export default function ReviewClient() {
  const { orderId } = useParams();

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [submittedId, setSubmittedId] = useState(null);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    async function loadOrder() {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("id, customer_name")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError || !orderData) {
        setError("Order not found. Please check the link and try again.");
        setLoading(false);
        return;
      }

      const { data: itemRows } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderData.id)
        .order("created_at", { ascending: true });

      setOrder(orderData);
      setItems(itemRows || []);
      setForm({
        ...(itemRows || []).reduce((acc, item) => {
          acc[item.id] = {
            rating: 5,
            comment: "",
            customer_name: orderData.customer_name || "",
          };
          return acc;
        }, {}),
      });
      setLoading(false);
    }
    loadOrder();
  }, [orderId]);

  function setField(itemId, field, value) {
    setForm((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  }

  async function submitReview(item, e) {
    e.preventDefault();
    const values = form[item.id] || { rating: 5, comment: "", customer_name: "" };
    setSubmittingId(item.id);
    setSubmitError("");

    try {
      const { error: insertError } = await supabase.from("reviews").insert({
        order_item_id: item.id,
        product_id: item.product_id,
        customer_name: values.customer_name || order.customer_name || "Customer",
        rating: values.rating,
        comment: values.comment,
        approved: true,
      });

      if (insertError) {
        const isDup =
          String(insertError.message || "").includes("duplicate") ||
          String(insertError.code || "").includes("23505");
        if (isDup) {
          setSubmittedId(item.id);
          setSubmittingId(null);
          return;
        }
        setSubmitError(insertError.message || "Could not submit review.");
        setSubmittingId(null);
        return;
      }

      await supabase
        .from("order_items")
        .update({ reviewed: true })
        .eq("id", item.id);

      setSubmittedId(item.id);
      setSubmittingId(null);
    } catch (err) {
      setSubmitError(err.message || "Could not submit review.");
      setSubmittingId(null);
    }
  }

  if (loading) {
    return <p className="py-24 text-center text-sm text-muted">Loading...</p>;
  }

  if (error || !order) {
    return (
      <p className="py-24 text-center text-sm text-red-600 px-5">{error}</p>
    );
  }

  const reviewable = items.filter((i) => !i.reviewed);
  const done = items.length - reviewable.length;

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <h1 className="font-display text-2xl sm:text-3xl text-ink mb-2">
        Review Your Order
      </h1>
      <p className="text-sm text-muted mb-8">
        How was your experience? Share a review to help other customers.
      </p>

      {done > 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6">
          <CheckCircle2 size={16} />
          {done} product{done > 1 ? "s" : ""} already reviewed.
        </div>
      )}

      {submitError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
          {submitError}
        </p>
      )}

      {reviewable.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          Thank you! You have reviewed everything in this order.
        </div>
      ) : (
        <div className="space-y-6">
          {reviewable.map((item) => {
            const isSubmitting = submittingId === item.id;
            const isDone = submittedId === item.id;
            return (
              <div key={item.id} className="card p-6">
                {isDone ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircle2 size={16} />
                    Review submitted — thank you!
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-ink mb-4">
                      {item.product_name}
                      {item.variant_text && (
                        <span className="text-xs text-muted">
                          {" "}({item.variant_text})
                        </span>
                      )}
                    </p>

                    <form onSubmit={(e) => submitReview(item, e)}>
                      <div className="mb-4">
                        <label className="label">Your Rating</label>
                        <StarRating
                          value={form[item.id]?.rating || 5}
                          onChange={(rating) => setField(item.id, "rating", rating)}
                        />
                      </div>

                      <div className="mb-4">
                        <label className="label">Name</label>
                        <input
                          type="text"
                          required
                          value={form[item.id]?.customer_name || ""}
                          onChange={(e) =>
                            setField(item.id, "customer_name", e.target.value)
                          }
                          className="input"
                        />
                      </div>

                      <div className="mb-4">
                        <label className="label">Comment</label>
                        <textarea
                          rows={3}
                          value={form[item.id]?.comment || ""}
                          onChange={(e) =>
                            setField(item.id, "comment", e.target.value)
                          }
                          placeholder="What did you like or dislike?"
                          className="input"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn btn-primary"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />{" "}
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send size={16} /> Submit Review
                          </>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
