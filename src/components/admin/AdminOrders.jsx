"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Mail,
  Printer,
  Loader2,
  Check,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { printPOSInvoice } from "@/lib/posInvoice";
import Pagination from "./Pagination";

const STATUSES = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_PILL = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-sky-50 text-sky-700 border-sky-200",
  out_for_delivery: "bg-indigo-50 text-indigo-700 border-indigo-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }

  async function loadItems(orderId) {
    const { data } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);
    return data || [];
  }

  async function toggleExpand(orderId) {
    if (expanded === orderId) {
      setExpanded(null);
      return;
    }
    setExpanded(orderId);
  }

  async function updateStatus(order, status) {
    if (status === order.status) return;
    setUpdatingId(order.id);
    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.ok) {
      await loadOrders();
    }
    setUpdatingId(null);
  }

  const filtered = orders.filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    if (
      search &&
      !`${o.customer_name} ${o.tracking_code} ${o.phone}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <h1 className="text-2xl font-display text-ink mb-6">Orders</h1>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs border ${
            filter === "all"
              ? "bg-primary text-white border-primary"
              : "bg-surface text-ink border-line"
          }`}
        >
          All ({orders.length})
        </button>
        {STATUSES.map((s) => {
          const count = orders.filter((o) => o.status === s.key).length;
          return (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`px-3 py-1.5 rounded-full text-xs border ${
                filter === s.key
                  ? "bg-primary text-white border-primary"
                  : "bg-surface text-ink border-line"
              }`}
            >
              {s.label} ({count})
            </button>
          );
        })}
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search name / code / phone"
          className="input input-sm ml-auto"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted py-10 text-center">Loading orders...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted py-10 text-center">No orders found.</p>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-line">
            {paged.map((order) => (
              <li key={order.id}>
                <button
                  onClick={() => toggleExpand(order.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface"
                >
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      {expanded === order.id ? (
                        <ChevronDown size={15} className="text-muted shrink-0" />
                      ) : (
                        <ChevronRight size={15} className="text-muted shrink-0" />
                      )}
                      <p className="text-sm font-medium text-ink truncate">
                        {order.customer_name}
                      </p>
                    </div>
                    <p className="text-xs text-muted mt-0.5 pl-5">
                      {order.tracking_code} · ৳{order.total_amount} ·{" "}
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wide border ${
                      STATUS_PILL[order.status] ||
                      "bg-primary/10 text-primary border-primary/20"
                    }`}
                  >
                    {order.status.replace(/_/g, " ")}
                  </span>
                </button>

                {expanded === order.id && (
                  <div className="px-5 pb-5">
                    <OrderDetail
                      order={order}
                      loadItems={loadItems}
                      updatingId={updatingId}
                      onUpdateStatus={updateStatus}
                    />
                  </div>
                )}
              </li>
            ))}
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

function OrderDetail({ order, loadItems, updatingId, onUpdateStatus }) {
  const [items, setItems] = useState(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    loadItems(order.id).then(setItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  async function handlePrint() {
    if (printing || !items) return;
    setPrinting(true);
    try {
      const { data: site } = await supabase
        .from("site_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      printPOSInvoice({ order, items, site: site || {} });
    } catch (err) {
      alert("Could not print the invoice.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="border border-line rounded-xl p-4 sm:p-5 bg-surface">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => onUpdateStatus(order, s.key)}
            disabled={updatingId === order.id || order.status === s.key}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border disabled:opacity-50 ${
              order.status === s.key
                ? "bg-primary text-white border-primary"
                : "bg-white text-ink border-line hover:border-primary"
            }`}
          >
            {updatingId === order.id && order.status !== s.key
              ? "..." : null}
            {order.status === s.key ? <Check size={12} className="inline mr-1" /> : null}
            {s.label}
          </button>
        ))}
        <button
          onClick={handlePrint}
          disabled={printing || !items}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-line bg-white text-ink hover:border-primary disabled:opacity-50"
        >
          <Printer size={13} />
          {printing ? "Opening..." : "Print Invoice"}
        </button>
      </div>

      {order.email && (
        <p className="flex items-center gap-1.5 text-xs text-muted mb-3">
          <Mail size={12} /> {order.email}
        </p>
      )}

      {!items ? (
        <p className="text-xs text-muted py-3">Loading items...</p>
      ) : (
        <div>
          <ul className="space-y-1.5 mb-3">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between text-sm text-ink">
                <span className="pr-3">
                  {item.product_name}
                  {item.variant_text && (
                    <span className="text-xs text-muted">
                      {" "}({item.variant_text})
                    </span>
                  )}{" "}
                  × {item.quantity}
                </span>
                <span className="shrink-0">৳{(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>

          <div className="border-t border-line pt-3 space-y-1 text-sm text-muted">
            <div className="flex justify-between">
              <span>Delivery</span>
              <span>
                {Number(order.delivery_charge) === 0
                  ? "FREE"
                  : `৳${Number(order.delivery_charge || 0).toFixed(2)}`}
                {order.delivery_zone_name ? ` (${order.delivery_zone_name})` : ""}
              </span>
            </div>
            {Number(order.discount_amount) > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>{order.discount_label || "Discount"}</span>
                <span>−৳{Number(order.discount_amount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-ink">
              <span>Total</span>
              <span>৳{order.total_amount}</span>
            </div>
          </div>

          <div className="border-t border-line mt-3 pt-3 text-sm text-muted">
            <p className="font-medium text-ink mb-1">Delivery Address</p>
            <p>{order.address}</p>
            <p className="mt-0.5">{order.phone}</p>
          </div>
        </div>
      )}
    </div>
  );
}
