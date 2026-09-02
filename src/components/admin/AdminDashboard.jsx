"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  ShoppingCart,
  Package,
  Clock,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Zap,
} from "lucide-react";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Revenue, cost (from products.cost via order_items), expenses and
// resulting profit/loss for everything created since `fromISO`.
async function computePeriodStats(fromISO) {
  const { data: orders } = await supabase
    .from("orders")
    .select("id, total_amount, status")
    .gte("created_at", fromISO);

  const validOrders = (orders || []).filter((o) => o.status !== "cancelled");
  const orderIds = validOrders.map((o) => o.id);
  const revenue = validOrders.reduce(
    (s, o) => s + Number(o.total_amount || 0),
    0,
  );

  let costTotal = 0;
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("product_id, quantity")
      .in("order_id", orderIds);

    const productIds = [
      ...new Set((items || []).map((i) => i.product_id).filter(Boolean)),
    ];

    let costMap = {};
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, cost")
        .in("id", productIds);
      costMap = Object.fromEntries(
        (products || []).map((p) => [p.id, Number(p.cost) || 0]),
      );
    }

    costTotal = (items || []).reduce(
      (s, i) => s + (costMap[i.product_id] || 0) * Number(i.quantity || 0),
      0,
    );
  }

  const { data: expenseRows } = await supabase
    .from("expenses")
    .select("amount")
    .gte("expense_date", fromISO);
  const expenseTotal = (expenseRows || []).reduce(
    (s, e) => s + Number(e.amount || 0),
    0,
  );

  const grossProfit = revenue - costTotal;
  const netProfit = grossProfit - expenseTotal;

  return {
    orders: validOrders.length,
    revenue,
    grossProfit,
    expenses: expenseTotal,
    netProfit,
  };
}

async function loadActiveDiscountSessions() {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("discount_sessions")
    .select("id, name, slug, style, ends_at, discount_session_products(id)")
    .eq("is_active", true)
    .lte("starts_at", now)
    .gte("ends_at", now)
    .order("ends_at", { ascending: true });
  return data || [];
}

function money(n) {
  return `৳${Number(n || 0).toFixed(0)}`;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [todayStats, setTodayStats] = useState(null);
  const [monthStats, setMonthStats] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [period, setPeriod] = useState("today"); // "today" | "month"

  useEffect(() => {
    async function load() {
      const { count: productCount } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true });

      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);

      const { count: orderCount, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true });
      if (error) throw error;

      const { count: pendingCount } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      const { data: revenueData } = await supabase
        .from("orders")
        .select("total_amount")
        .neq("status", "cancelled");

      const totalRevenue = (revenueData || []).reduce(
        (s, o) => s + Number(o.total_amount || 0),
        0,
      );

      const { data: lowStockData } = await supabase
        .from("products")
        .select("id, name, stock, slug")
        .lte("stock", 5)
        .order("stock", { ascending: true })
        .limit(8);

      setStats({
        products: productCount || 0,
        orders: orderCount || 0,
        pending: pendingCount || 0,
        revenue: totalRevenue,
      });
      setRecentOrders(orders || []);
      setLowStock(lowStockData || []);
    }
    load();
  }, []);
  function Stat({ label, value, tone = "default", hint, icon: Icon }) {
    const toneClass =
      tone === "positive"
        ? "text-emerald-600"
        : tone === "negative"
          ? "text-red-600"
          : "text-ink";

    return (
      <div>
        <p className="flex items-center gap-1.5 text-xs text-muted uppercase tracking-wide mb-1.5">
          {Icon && <Icon size={13} className="shrink-0" />}
          {label}
          {hint && <span className="normal-case text-muted/70"> ({hint})</span>}
        </p>
        <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
      </div>
    );
  }
  useEffect(() => {
    async function loadPeriods() {
      setPeriodsLoading(true);
      const todayStart = startOfDay(new Date()).toISOString();
      const monthStart = startOfMonth(new Date()).toISOString();

      const [today, month, sessions] = await Promise.all([
        computePeriodStats(todayStart),
        computePeriodStats(monthStart),
        loadActiveDiscountSessions(),
      ]);

      setTodayStats(today);
      setMonthStats(month);
      setActiveSessions(sessions);
      setPeriodsLoading(false);
    }
    loadPeriods();
  }, []);

  if (!stats) {
    return <p className="text-sm text-muted">Loading dashboard...</p>;
  }

  const cards = [
    { label: "Total Orders", value: stats.orders, icon: ShoppingCart },
    { label: "Pending Orders", value: stats.pending, icon: Clock },
    { label: "Products", value: stats.products, icon: Package },
    { label: "Revenue (৳)", value: stats.revenue.toFixed(0), icon: TrendingUp },
  ];

  const active = period === "today" ? todayStats : monthStats;
  const isLoss = active && active.netProfit < 0;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-display text-ink">Dashboard</h1>
        <p className="text-sm text-muted mt-1">
          An overview of your store&apos;s performance.
        </p>
      </div>

      {/* Overview */}
      <div className="card p-0 mb-4 grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-line">
        {cards.map((card) => (
          <div key={card.label} className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-2.5">
              <card.icon size={15} className="text-muted" />
              <p className="text-xs text-muted">{card.label}</p>
            </div>
            <p className="text-2xl font-semibold text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Performance */}
        <div className="card p-6 sm:p-7">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-ink">Performance</h2>
            <div className="inline-flex rounded-full border border-line p-0.5">
              <button
                onClick={() => setPeriod("today")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  period === "today"
                    ? "bg-primary text-white"
                    : "text-muted hover:text-ink"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setPeriod("month")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  period === "month"
                    ? "bg-primary text-white"
                    : "text-muted hover:text-ink"
                }`}
              >
                This Month
              </button>
            </div>
          </div>

          {periodsLoading || !active ? (
            <p className="text-sm text-muted py-8 text-center">Loading...</p>
          ) : (
            <div className="flex flex-wrap gap-x-8 gap-y-6">
              <Stat label="Orders" value={active.orders} />
              <Stat label="Revenue" value={money(active.revenue)} />
              <Stat
                label="Profit"
                value={money(active.grossProfit)}
                tone={active.grossProfit >= 0 ? "positive" : "negative"}
                hint="before expenses"
              />
              <Stat
                label="Expenses"
                value={money(active.expenses)}
                tone="muted"
              />

              <div className="w-full border-t border-line pt-5 flex items-baseline gap-3">
                <span className="text-xs font-medium text-muted uppercase tracking-wide">
                  Net {isLoss ? "loss" : "profit"}
                </span>
                <span
                  className={`text-2xl font-semibold ${
                    isLoss ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {isLoss ? "−" : ""}
                  {money(Math.abs(active.netProfit))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Active discount sessions */}
        <div className="card p-6 sm:p-7">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-ink flex items-center gap-1.5">
              <Zap size={14} className="text-accent" /> Active Discount Sessions
            </h2>
            <Link
              href="/admin/discounts"
              className="flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Manage <ArrowRight size={12} />
            </Link>
          </div>

          {periodsLoading ? (
            <p className="text-sm text-muted py-8 text-center">Loading...</p>
          ) : activeSessions.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">
              No sessions running right now.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/sale/${session.slug}`}
                  target="_blank"
                  className="group flex items-center gap-2 px-3.5 py-2 rounded-full border border-line hover:border-accent transition-colors"
                >
                  <span className="text-sm text-ink group-hover:text-accent transition-colors">
                    {session.name}
                  </span>
                  <span className="text-xs text-muted">
                    {session.discount_session_products?.length || 0} items
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink">Recent Orders</h2>
            <Link
              href="/admin/orders"
              className="flex items-center gap-1 text-xs text-accent hover:underline"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">
              No orders yet.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {recentOrders.map((order) => (
                <li
                  key={order.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm text-ink">{order.customer_name}</p>
                    <p className="text-xs text-muted">{order.tracking_code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-ink">
                      ৳{order.total_amount}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-primary/10 text-primary">
                      {order.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Low stock */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600" /> Low Stock
            </h2>
            <Link
              href="/admin/products"
              className="flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Manage <ArrowRight size={12} />
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">
              All products are well stocked.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {lowStock.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between py-3"
                >
                  <p className="text-sm text-ink truncate pr-4">
                    {product.name}
                  </p>
                  <span
                    className={`shrink-0 text-xs font-medium ${
                      product.stock <= 0 ? "text-red-600" : "text-amber-600"
                    }`}
                  >
                    {product.stock <= 0
                      ? "Out of stock"
                      : `${product.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "default", hint }) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-red-600"
        : tone === "muted"
          ? "text-ink"
          : "text-ink";

  return (
    <div>
      <p className="text-xs text-muted uppercase tracking-wide mb-1">
        {label}
        {hint && <span className="normal-case text-muted/70"> ({hint})</span>}
      </p>
      <p className={`text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
