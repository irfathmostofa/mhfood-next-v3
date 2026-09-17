"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import Modal from "@/components/admin/Modal";
import { useToast } from "@/components/Toast";

export default function ProductEnquiryModal({
  open,
  onClose,
  product,
}) {
  const { success, error: toastError } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    quantity: 1,
    message: "",
  });

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    if (saving) return;
    setError("");
    onClose();
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: product.id,
          name: form.name,
          phone: form.phone,
          email: form.email,
          quantity: form.quantity,
          message: form.message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit enquiry.");
      success("Enquiry submitted. We will contact you soon.");
      setForm({ name: "", phone: "", email: "", quantity: 1, message: "" });
      onClose();
    } catch (err) {
      const msg = err.message || "Could not submit enquiry.";
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Request this product"
      subtitle={product?.name ? `We will notify you about ${product.name}.` : ""}
      size="sm"
    >
      <form onSubmit={submit} className="space-y-3">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        <div>
          <label className="label">Your name</label>
          <input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="input input-sm"
            required
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            className="input input-sm"
            placeholder="01XXXXXXXXX"
            required
          />
        </div>
        <div>
          <label className="label">Email (optional)</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className="input input-sm"
          />
        </div>
        <div>
          <label className="label">Quantity</label>
          <input
            type="number"
            min="1"
            max="99"
            value={form.quantity}
            onChange={(e) => update("quantity", Number(e.target.value) || 1)}
            className="input input-sm"
          />
        </div>
        <div>
          <label className="label">Message (optional)</label>
          <textarea
            rows={3}
            value={form.message}
            onChange={(e) => update("message", e.target.value)}
            className="input input-sm"
            placeholder="Tell us how many you need or when you need it."
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary w-full disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Sending...
            </>
          ) : (
            <>
              <Send size={16} /> Submit enquiry
            </>
          )}
        </button>
      </form>
    </Modal>
  );
}
