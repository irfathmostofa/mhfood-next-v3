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
} from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStock, setLowStock] = useState([]);

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

  if (!stats) {
    return <p className="text-sm text-muted">Loading dashboard...</p>;
  }

  const cards = [
    { label: "Total Orders", value: stats.orders, icon: ShoppingCart, color: "text-primary" },
    { label: "Pending Orders", value: stats.pending, icon: Clock, color: "text-amber-600" },
    { label: "Products", value: stats.products, icon: Package, color: "text-primary" },
    { label: "Revenue (৳)", value: stats.revenue.toFixed(0), icon: TrendingUp, color: "text-emerald-600" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display text-ink">Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            An overview of your store&apos;s performance.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="card p-5">
            <card.icon size={20} className={`${card.color} mb-3`} />
            <p className="text-2xl font-semibold text-ink">{card.value}</p>
            <p className="text-xs text-muted mt-1">{card.label}</p>
          </div>
        ))}
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
            <p className="text-sm text-muted py-6 text-center">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentOrders.map((order) => (
                <li key={order.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-ink">{order.customer_name}</p>
                    <p className="text-xs text-muted">{order.tracking_code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-ink">৳{order.total_amount}</p>
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
                <li key={product.id} className="flex items-center justify-between py-3">
                  <p className="text-sm text-ink truncate pr-4">{product.name}</p>
                  <span
                    className={`shrink-0 text-xs font-medium ${
                      product.stock <= 0 ? "text-red-600" : "text-amber-600"
                    }`}
                  >
                    {product.stock <= 0 ? "Out of stock" : `${product.stock} left`}
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
