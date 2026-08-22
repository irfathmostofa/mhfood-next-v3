"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  Printer,
  Loader2,
  TrendingUp,
  ShoppingCart,
  PackageCheck,
  Clock,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { printSalesReport } from "@/lib/salesReport";

const STATUSES = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

function toLocalDateInput(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export default function AdminReports() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toLocalDateInput(d);
  });
  const [to, setTo] = useState(() => toLocalDateInput(new Date()));
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState(null);

  useEffect(() => {
    loadSite();
  }, []);

  async function loadSite() {
    const { data } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    setSite(data || null);
  }

  async function loadOrders() {
    setLoading(true);
    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (from) {
      query = query.gte("created_at", startOfDay(new Date(from)).toISOString());
    }
    if (to) {
      query = query.lte("created_at", endOfDay(new Date(to)).toISOString());
    }

    const { data, error } = await query;
    if (!error) setOrders(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  function applyPreset(days, name) {
    const end = new Date();
    let start;
    if (name === "today") start = new Date();
    else if (name === "month") {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
    } else {
      start = new Date();
      start.setDate(start.getDate() - (days - 1));
    }
    setFrom(toLocalDateInput(start));
    setTo(toLocalDateInput(end));
  }

  const stats = (() => {
    const total = orders.length;
    const revenue = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const pending = orders.filter(
      (o) => o.status === "pending" || o.status === "confirmed",
    ).length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    const deliveredOrders = orders.filter(
      (o) => o.status !== "cancelled",
    ).length;
    const avgOrderValue = deliveredOrders
      ? revenue / deliveredOrders
      : 0;

    return { orders: total, revenue, delivered, pending, cancelled, avgOrderValue };
  })();

  const statusBreakdown = STATUSES.map((s) => {
    const list = orders.filter((o) => o.status === s.key);
    return {
      status: s.key,
      label: s.label,
      count: list.length,
      revenue: list
        .filter((o) => o.status !== "cancelled")
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
    };
  }).filter((s) => s.count > 0);

  const maxStatusCount = Math.max(1, ...statusBreakdown.map((s) => s.count));

  const cards = [
    { label: "Total Orders", value: stats.orders, icon: ShoppingCart, color: "text-primary" },
    { label: "Revenue", value: `৳${stats.revenue.toFixed(0)}`, icon: TrendingUp, color: "text-emerald-600" },
    { label: "Delivered", value: stats.delivered, icon: PackageCheck, color: "text-sky-600" },
    { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-600" },
    { label: "Cancelled", value: stats.cancelled, icon: XCircle, color: "text-red-600" },
    { label: "Avg Order", value: `৳${stats.avgOrderValue.toFixed(0)}`, icon: Calendar, color: "text-accent" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display text-ink">Sales Report</h1>
          <p className="text-sm text-muted mt-1">
            Analyze revenue and orders within a date range.
          </p>
        </div>

        <button
          onClick={() =>
            printSalesReport({
              from,
              to,
              stats,
              statusBreakdown,
              orders,
              site,
            })
          }
          disabled={loading || orders.length === 0}
          className="btn btn-primary"
        >
          <Printer size={16} />
          Print Report
        </button>
      </div>

      {/* Date range filter */}
      <div className="card p-5 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">From</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="input input-sm w-auto"
            />
          </div>

          <div>
            <label className="label">To</label>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="input input-sm w-auto"
            />
          </div>

          <div className="flex flex-wrap gap-2 ml-auto">
            <button
              onClick={() => applyPreset(1, "today")}
              className="px-3 py-1.5 rounded-full text-xs border border-line text-ink hover:border-primary transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => applyPreset(7, "days")}
              className="px-3 py-1.5 rounded-full text-xs border border-line text-ink hover:border-primary transition-colors"
            >
              Last 7 days
            </button>
            <button
              onClick={() => applyPreset(30, "days")}
              className="px-3 py-1.5 rounded-full text-xs border border-line text-ink hover:border-primary transition-colors"
            >
              Last 30 days
            </button>
            <button
              onClick={() => applyPreset(0, "month")}
              className="px-3 py-1.5 rounded-full text-xs border border-line text-ink hover:border-primary transition-colors"
            >
              This month
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted py-12 text-center flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading report...
        </p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            {cards.map((card) => (
              <div key={card.label} className="card p-5">
                <card.icon size={20} className={`${card.color} mb-3`} />
                <p className="text-xl font-semibold text-ink">{card.value}</p>
                <p className="text-xs text-muted mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Status breakdown */}
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-ink mb-4">
                Orders by Status
              </h2>
              {statusBreakdown.length === 0 ? (
                <p className="text-sm text-muted py-6 text-center">
                  No orders in this period.
                </p>
              ) : (
                <ul className="space-y-4">
                  {statusBreakdown.map((s) => (
                    <li key={s.status}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="text-ink">{s.label}</span>
                        <span className="text-muted text-xs">
                          {s.count} orders · ৳{s.revenue.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-primary/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{
                            width: `${(s.count / maxStatusCount) * 100}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Revenue by status */}
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-ink mb-4">
                Revenue by Status
              </h2>
              {statusBreakdown.length === 0 ? (
                <p className="text-sm text-muted py-6 text-center">
                  No orders in this period.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {statusBreakdown.map((s) => (
                    <li
                      key={s.status}
                      className="flex items-center justify-between py-3"
                    >
                      <span className="text-sm text-ink">{s.label}</span>
                      <span className="text-sm font-medium text-ink">
                        ৳{s.revenue.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Orders list */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h2 className="text-sm font-semibold text-ink">
                Orders in Period ({orders.length})
              </h2>
              <button
                onClick={loadOrders}
                className="flex items-center gap-1.5 text-xs text-accent hover:underline"
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {orders.length === 0 ? (
              <p className="text-sm text-muted py-10 text-center">
                No orders found in the selected date range.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-line">
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 font-medium">Tracking</th>
                      <th className="px-6 py-3 font-medium">Customer</th>
                      <th className="px-6 py-3 font-medium">Phone</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-surface">
                        <td className="px-6 py-3 text-muted whitespace-nowrap">
                          {new Date(order.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3 text-ink font-medium whitespace-nowrap">
                          {order.tracking_code}
                        </td>
                        <td className="px-6 py-3 text-ink">{order.customer_name}</td>
                        <td className="px-6 py-3 text-muted whitespace-nowrap">
                          {order.phone}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wide bg-primary/10 text-primary">
                            {order.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-ink font-semibold text-right whitespace-nowrap">
                          ৳{Number(order.total_amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
