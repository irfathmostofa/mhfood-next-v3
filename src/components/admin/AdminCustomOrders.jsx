"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  Paperclip,
  ExternalLink,
  Trash2,
  Phone,
  Mail,
  Save,
  PackagePlus,
} from "lucide-react";
import Pagination from "./Pagination";
import { useToast } from "@/components/Toast";
import { CUSTOM_ORDER_STATUSES, formatFileSize } from "@/lib/customOrders";

const STATUS_PILL = {
  new: "bg-amber-50 text-amber-700 border-amber-200",
  contacted: "bg-sky-50 text-sky-700 border-sky-200",
  quoted: "bg-indigo-50 text-indigo-700 border-indigo-200",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

export default function AdminCustomOrders() {
  const { success, error: toastError } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/custom-orders");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrders(data.orders || []);
    } catch (err) {
      setError(err.message || "Could not load custom orders.");
    } finally {
      setLoading(false);
    }
  }

  async function patchOrder(id, patch) {
    const res = await fetch(`/api/admin/custom-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, ...data.order, file_url: o.file_url } : o,
      ),
    );
  }

  async function updateStatus(order, status) {
    try {
      await patchOrder(order.id, { status });
      success("Status updated.");
    } catch (err) {
      toastError(err.message || "Could not update status.");
    }
  }

  async function saveNote(order, note) {
    try {
      await patchOrder(order.id, { admin_note: note });
      success("Note saved.");
    } catch (err) {
      toastError(err.message || "Could not save note.");
    }
  }

  async function deleteOrder(order) {
    if (
      !confirm(
        `Delete custom order ${order.code}? The uploaded file will be removed too.`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/admin/custom-orders/${order.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      success("Custom order deleted.");
    } catch (err) {
      toastError(err.message || "Could not delete.");
    }
  }

  const counts = useMemo(() => {
    const map = { all: orders.length };
    for (const o of orders) map[o.status] = (map[o.status] || 0) + 1;
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (!q) return true;
      return `${o.code} ${o.customer_name} ${o.phone} ${o.email || ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [orders, filter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display text-ink">Custom Orders</h1>
        <p className="text-sm text-muted mt-1">
          Made-to-order requests submitted from the storefront.
        </p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          {[{ key: "all", label: "All" }, ...CUSTOM_ORDER_STATUSES].map((s) => (
            <button
              key={s.key}
              onClick={() => {
                setFilter(s.key);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs border ${
                filter === s.key
                  ? "bg-primary text-white border-primary"
                  : "bg-surface text-ink border-line"
              }`}
            >
              {s.label} ({counts[s.key] || 0})
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm sm:ml-auto">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search code, name, phone…"
            className="input pl-9"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted py-10 text-center">
          <Loader2 size={16} className="inline animate-spin mr-2" />
          Loading…
        </p>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <PackagePlus size={28} className="mx-auto text-muted mb-3" />
          <p className="text-sm text-ink font-medium">No custom orders found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-line">
            {paged.map((order) => {
              const open = expanded === order.id;
              return (
                <li key={order.id}>
                  <button
                    onClick={() => setExpanded(open ? null : order.id)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-surface"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {open ? (
                          <ChevronDown
                            size={15}
                            className="text-muted shrink-0"
                          />
                        ) : (
                          <ChevronRight
                            size={15}
                            className="text-muted shrink-0"
                          />
                        )}
                        <p className="text-sm font-medium text-ink truncate">
                          {order.customer_name}
                        </p>
                        {(order.file_path || order.drive_url) && (
                          <Paperclip
                            size={13}
                            className="text-muted shrink-0"
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5 pl-5 truncate">
                        {order.code} · {order.phone} ·{" "}
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wide border ${
                        STATUS_PILL[order.status] ||
                        "bg-primary/10 text-primary border-primary/20"
                      }`}
                    >
                      {order.status}
                    </span>
                  </button>

                  {open && (
                    <OrderDetail
                      order={order}
                      onStatus={updateStatus}
                      onSaveNote={saveNote}
                      onDelete={deleteOrder}
                    />
                  )}
                </li>
              );
            })}
          </ul>

          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={filtered.length}
            onChange={(p, ps) => {
              setPage(p);
              setPageSize(ps);
            }}
          />
        </div>
      )}
    </div>
  );
}

function OrderDetail({ order, onStatus, onSaveNote, onDelete }) {
  const [note, setNote] = useState(order.admin_note || "");
  const [savingNote, setSavingNote] = useState(false);

  async function handleSaveNote() {
    setSavingNote(true);
    await onSaveNote(order, note);
    setSavingNote(false);
  }

  return (
    <div className="px-5 pb-5">
      <div className="border border-line rounded-xl p-4 sm:p-5 bg-surface space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {CUSTOM_ORDER_STATUSES.map((s) => (
            <button
              key={s.key}
              onClick={() => onStatus(order, s.key)}
              disabled={order.status === s.key}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border disabled:opacity-60 ${
                order.status === s.key
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-ink border-line hover:border-primary"
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={() => onDelete(order)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-line text-red-600 hover:bg-red-50"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-ink">
          <a
            href={`tel:${order.phone}`}
            className="inline-flex items-center gap-1.5 hover:text-accent"
          >
            <Phone size={14} className="text-muted" /> {order.phone}
          </a>
          {order.email && (
            <a
              href={`mailto:${order.email}`}
              className="inline-flex items-center gap-1.5 hover:text-accent"
            >
              <Mail size={14} className="text-muted" /> {order.email}
            </a>
          )}
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-1">
            Message
          </p>
          <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
            {order.message}
          </p>
        </div>

        {(order.file_path || order.drive_url) && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-2">
              Attachments
            </p>
            <div className="flex flex-wrap gap-2">
              {order.file_path &&
                (order.file_url ? (
                  <a
                    href={order.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-white text-sm text-ink hover:border-primary"
                  >
                    <Paperclip size={14} />
                    {order.file_name || "Download file"}
                    <span className="text-xs text-muted">
                      ({formatFileSize(order.file_size)})
                    </span>
                    <ExternalLink size={12} className="text-muted" />
                  </a>
                ) : (
                  <span className="text-xs text-muted">
                    File link unavailable — refresh the page.
                  </span>
                ))}
              {order.drive_url && (
                <a
                  href={order.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-white text-sm text-ink hover:border-primary"
                >
                  Google Drive link{" "}
                  <ExternalLink size={12} className="text-muted" />
                </a>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="label">Internal note</label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Quote, follow-up details… (only visible to admin)"
            className="input"
          />
          <button
            onClick={handleSaveNote}
            disabled={savingNote || note === (order.admin_note || "")}
            className="btn btn-primary btn-sm mt-2 disabled:opacity-60"
          >
            {savingNote ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}
