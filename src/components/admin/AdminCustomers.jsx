"use client";

import { useEffect, useState } from "react";
import { Search, Send, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Pagination from "./Pagination";

const STATUS_PILL = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-sky-50 text-sky-700 border-sky-200",
  out_for_delivery: "bg-indigo-50 text-indigo-700 border-indigo-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

// GSM-7 character counting for SMS segments (160 chars/segment, 70 for unicode).
function countSegments(message) {
  const unicodeChars = [...message].filter((c) => c.charCodeAt(0) > 127).length;
  const perSegment = unicodeChars > 0 ? 70 : 160;
  return Math.max(1, Math.ceil([...message].length / perSegment));
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [smsOpen, setSmsOpen] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [smsResult, setSmsResult] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [orderItems, setOrderItems] = useState({});
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    const { data: orders } = await supabase
      .from("orders")
      .select(
        "id, tracking_code, customer_name, phone, email, total_amount, created_at, status, fulfillment_method",
      )
      .order("created_at", { ascending: false });

    const map = {};
    for (const order of orders || []) {
      const key = String(order.phone || "unknown").trim();
      if (key === "unknown") continue;
      if (!map[key]) {
        map[key] = {
          phone: key,
          name: order.customer_name,
          email: order.email,
          orders: 0,
          spent: 0,
          lastOrder: order.created_at,
          orderList: [],
        };
      }
      map[key].orderList.push(order);
      if (order.status !== "cancelled") {
        map[key].orders += 1;
        map[key].spent += Number(order.total_amount || 0);
      }
      if (
        !map[key].lastOrder ||
        new Date(order.created_at) > new Date(map[key].lastOrder)
      ) {
        map[key].lastOrder = order.created_at;
        map[key].name = order.customer_name || map[key].name;
        map[key].email = order.email || map[key].email;
      }
    }

    setCustomers(Object.values(map).sort((a, b) => b.spent - a.spent));
    setLoading(false);
  }

  async function loadOrderItems(orders) {
    const missing = orders.filter((o) => !orderItems[o.id]).map((o) => o.id);
    if (missing.length === 0) return;
    setLoadingItems(true);
    const { data } = await supabase
      .from("order_items")
      .select("id, order_id, product_name, variant_text, quantity, price")
      .in("order_id", missing);
    const next = { ...orderItems };
    for (const id of missing) next[id] = [];
    for (const item of data || []) {
      if (!next[item.order_id]) next[item.order_id] = [];
      next[item.order_id].push(item);
    }
    setOrderItems(next);
    setLoadingItems(false);
  }

  function toggleCustomer(customer) {
    const isOpen = expanded === customer.phone;
    if (isOpen) {
      setExpanded(null);
      return;
    }
    setExpanded(customer.phone);
    loadOrderItems(customer.orderList);
  }

  function toggleSelect(phone) {
    setSelected((prev) => ({ ...prev, [phone]: !prev[phone] }));
  }

  function toggleAll() {
    const allSelected =
      filtered.length > 0 && filtered.every((c) => selected[c.phone]);
    const next = { ...selected };
    filtered.forEach((c) => {
      next[c.phone] = !allSelected;
    });
    setSelected(next);
  }

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const selectedCount = filtered.filter((c) => selected[c.phone]).length;
  const segments = smsMessage ? countSegments(smsMessage) : 0;

  async function sendSMS(e) {
    e.preventDefault();
    const phones = filtered
      .filter((c) => selected[c.phone])
      .map((c) => c.phone);
    if (phones.length === 0 || !smsMessage.trim()) return;

    setSending(true);
    setSmsResult("");
    const res = await fetch("/api/admin/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phones, message: smsMessage }),
    });
    const data = await res.json();
    setSmsResult(
      data.ok
        ? `SMS sent to ${phones.length} customer(s).`
        : data.error || "Could not send SMS.",
    );
    setSending(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display text-ink">Customers</h1>
        <button
          onClick={() => setSmsOpen((v) => !v)}
          className="btn btn-primary"
        >
          <Send size={16} /> Bulk SMS
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
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
            placeholder="Search customers..."
            className="input pl-9"
          />
        </div>
        <span className="text-xs text-muted">
          {customers.length} customers · {selectedCount} selected
        </span>
      </div>

      {smsOpen && (
        <form onSubmit={sendSMS} className="card p-6 mb-6 space-y-3">
          <h2 className="text-sm font-semibold text-ink">
            Send SMS to selected customers ({selectedCount})
          </h2>
          <textarea
            rows={3}
            value={smsMessage}
            onChange={(e) => setSmsMessage(e.target.value)}
            placeholder="Type your message..."
            className="input"
            required
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">
              ~{segments} segment{segments > 1 ? "s" : ""}
              {segments > 1 && " (long messages cost extra)"}
            </p>
            <button
              type="submit"
              disabled={sending || selectedCount === 0}
              className="btn btn-primary disabled:opacity-60"
            >
              {sending ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Send size={16} /> Send
                </>
              )}
            </button>
          </div>
          {smsResult && (
            <p
              className={`text-sm rounded-lg px-3 py-2 border ${
                smsResult.startsWith("SMS")
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                  : "text-red-600 bg-red-50 border-red-200"
              }`}
            >
              {smsResult}
            </p>
          )}
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted py-10 text-center">
          Loading customers...
        </p>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-line flex items-center gap-2">
            <input
              type="checkbox"
              checked={
                filtered.length > 0 && filtered.every((c) => selected[c.phone])
              }
              onChange={toggleAll}
            />
            <span className="text-xs text-muted">Select all</span>
          </div>
          <ul className="divide-y divide-line">
            {paged.map((customer) => {
              const isOpen = expanded === customer.phone;
              return (
                <li key={customer.phone}>
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    <input
                      type="checkbox"
                      checked={!!selected[customer.phone]}
                      onChange={() => toggleSelect(customer.phone)}
                    />
                    <button
                      type="button"
                      onClick={() => toggleCustomer(customer)}
                      className="min-w-0 flex-1 flex items-center gap-3 text-left"
                    >
                      {isOpen ? (
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
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">
                          {customer.name}
                        </p>
                        <p className="text-xs text-muted">
                          {customer.phone}
                          {customer.email ? ` · ${customer.email}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm text-ink">
                          ৳{customer.spent.toFixed(0)} ·{" "}
                          {customer.orderList.length} order
                          {customer.orderList.length === 1 ? "" : "s"}
                        </p>
                        <p className="text-xs text-muted">
                          Last:{" "}
                          {new Date(customer.lastOrder).toLocaleDateString()}
                        </p>
                      </div>
                    </button>
                  </div>

                  {isOpen && (
                    <div className="px-5 pb-4 pl-14">
                      <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-2">
                        Orders
                      </p>
                      <ul className="border border-line rounded-xl overflow-hidden divide-y divide-line">
                        {customer.orderList.map((order) => {
                          const items = orderItems[order.id];
                          return (
                            <li
                              key={order.id}
                              className="px-3.5 py-2.5 bg-background/50"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm text-ink truncate">
                                    {order.tracking_code}
                                  </p>
                                  <p className="text-xs text-muted">
                                    {new Date(
                                      order.created_at,
                                    ).toLocaleString()}{" "}
                                    ·{" "}
                                    {order.fulfillment_method === "pickup"
                                      ? "Pickup"
                                      : "Delivery"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <p className="text-sm font-medium text-ink">
                                    ৳
                                    {Number(order.total_amount || 0).toFixed(0)}
                                  </p>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide border ${
                                      STATUS_PILL[order.status] ||
                                      "bg-primary/10 text-primary border-primary/20"
                                    }`}
                                  >
                                    {order.status.replace(/_/g, " ")}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2 pl-0">
                                {!items || (loadingItems && !items.length) ? (
                                  <p className="text-xs text-muted">
                                    Loading products...
                                  </p>
                                ) : items.length === 0 ? (
                                  <p className="text-xs text-muted">
                                    No products on this order.
                                  </p>
                                ) : (
                                  <ul className="space-y-1">
                                    {items.map((item) => (
                                      <li
                                        key={item.id}
                                        className="flex justify-between gap-3 text-xs text-ink"
                                      >
                                        <span className="min-w-0">
                                          {item.product_name}
                                          {item.variant_text ? (
                                            <span className="text-muted">
                                              {" "}
                                              ({item.variant_text})
                                            </span>
                                          ) : null}{" "}
                                          × {item.quantity}
                                        </span>
                                        <span className="shrink-0 text-muted">
                                          ৳
                                          {(
                                            Number(item.price || 0) *
                                            Number(item.quantity || 0)
                                          ).toFixed(0)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
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
