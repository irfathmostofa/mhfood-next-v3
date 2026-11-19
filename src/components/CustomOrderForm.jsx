"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Send, Upload, X, CheckCircle2, FileText } from "lucide-react";
import { useToast } from "@/components/Toast";
import {
  FILE_ACCEPT,
  MAX_FILE_BYTES,
  formatFileSize,
} from "@/lib/customOrders";

const EMPTY = {
  name: "",
  phone: "",
  email: "",
  message: "",
  drive_url: "",
  website: "", // honeypot
};

export default function CustomOrderForm() {
  const { success, error: toastError } = useToast();
  const inputRef = useRef(null);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [doneCode, setDoneCode] = useState("");

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onPickFile(e) {
    const next = e.target.files?.[0];
    e.target.value = "";
    if (!next) return;
    if (next.size > MAX_FILE_BYTES) {
      const msg = `File is ${formatFileSize(next.size)}. Maximum size is 2 MB — or paste a Google Drive link instead.`;
      setError(msg);
      toastError("File is larger than 2 MB.");
      return;
    }
    if (!/\.(jpe?g|png|webp|pdf|docx?)$/i.test(next.name)) {
      setError("Unsupported file. Use JPG, PNG, WebP, PDF, DOC or DOCX.");
      return;
    }
    setError("");
    setFile(next);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v));
      if (file) body.append("file", file);

      const res = await fetch("/api/custom-orders", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not submit request.");

      setDoneCode(data.code);
      setForm(EMPTY);
      setFile(null);
      success("Custom order request sent.");
    } catch (err) {
      const msg = err.message || "Could not submit request.";
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (doneCode) {
    return (
      <div className="card p-8 text-center">
        <CheckCircle2 size={36} className="mx-auto text-emerald-600 mb-3" />
        <h2 className="font-display text-xl text-ink">Request received</h2>
        <p className="text-sm text-muted mt-2">
          Thank you! We will contact you shortly on the phone number you gave.
        </p>
        <p className="mt-4 text-xs uppercase tracking-wide text-muted">
          Reference
        </p>
        <p className="text-lg font-semibold text-ink">{doneCode}</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => setDoneCode("")}
            className="btn btn-outline"
          >
            Send another request
          </button>
          <Link href="/shop" className="btn btn-primary">
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-surface border border-line rounded-2xl p-5 sm:p-6"
    >
      {/* Honeypot — hidden from people, bots fill it */}
      <div className="hidden" aria-hidden="true">
        <input
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => update("website", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Full name</label>
          <input
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            required
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="01XXXXXXXXX"
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label">Email (optional)</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          className="input"
        />
      </div>

      <div>
        <label className="label">Your request</label>
        <textarea
          required
          rows={5}
          maxLength={2000}
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
          placeholder="What do you need? Quantity, size, colour, deadline, budget…"
          className="input"
        />
        <p className="text-[11px] text-muted mt-1">
          {form.message.length}/2000
        </p>
      </div>

      <div>
        <label className="label">Reference file (optional, max 2 MB)</label>
        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5">
            <FileText size={18} className="text-muted shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink truncate">{file.name}</p>
              <p className="text-xs text-muted">{formatFileSize(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              aria-label="Remove file"
              className="p-1.5 text-muted hover:text-red-600"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-line py-5 text-sm text-muted hover:border-accent hover:text-accent transition-colors flex flex-col items-center gap-1.5"
          >
            <Upload size={18} />
            Upload JPG, PNG, WebP, PDF, DOC or DOCX
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={FILE_ACCEPT}
          onChange={onPickFile}
          className="hidden"
        />
      </div>

      <div>
        <label className="label">Or Google Drive share link (optional)</label>
        <input
          type="url"
          value={form.drive_url}
          onChange={(e) => update("drive_url", e.target.value)}
          placeholder="https://drive.google.com/…"
          className="input"
        />
        <p className="text-[11px] text-muted mt-1">
          For larger files: upload to Google Drive, set sharing to “Anyone with
          the link”, and paste the link here.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn btn-accent w-full disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Send size={16} /> Submit custom order
          </>
        )}
      </button>
    </form>
  );
}
