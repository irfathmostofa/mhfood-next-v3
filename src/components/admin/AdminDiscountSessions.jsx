"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  Loader2,
  Search,
  X,
  Percent,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Modal from "./Modal";
import {
  computeSalePrice,
  sessionStatus,
  slugifySession,
} from "@/lib/salePricing";

const EMPTY = {
  id: null,
  name: "",
  slug: "",
  subtitle: "",
  style: "flash",
  starts_at: "",
  ends_at: "",
  is_active: true,
  items: [],
};

const STYLES = [
  { value: "flash", label: "Flash Sale" },
  { value: "blackfriday", label: "Black Friday" },
  { value: "sale", label: "Campaign Sale" },
];

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function statusBadge(status) {
  if (status === "live")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "upcoming")
    return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "ended") return "bg-stone-100 text-stone-500 border-stone-200";
  return "bg-red-50 text-red-600 border-red-200";
}

export default function AdminDiscountSessions() {
  const [sessions, setSessions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [bulkPercent, setBulkPercent] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: sessionRows }, { data: productRows }] = await Promise.all([
      supabase
        .from("discount_sessions")
        .select(
          "*, discount_session_products(id, product_id, discount_type, discount_value, sort_order)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("products")
        .select("id, name, price, regular_price, cost, stock, is_active")
        .order("name"),
    ]);
    setSessions(sessionRows || []);
    setProducts(productRows || []);
    setLoading(false);
  }

  function showFlash(msg) {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  }

  function openNew() {
    setError("");
    setProductQuery("");
    setBulkPercent("");
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setEditing({
      ...EMPTY,
      starts_at: toLocalInput(now.toISOString()),
      ends_at: toLocalInput(end.toISOString()),
    });
  }

  function openEdit(session) {
    setError("");
    setProductQuery("");
    setBulkPercent("");
    const items = [...(session.discount_session_products || [])]
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((i) => ({
        product_id: i.product_id,
        discount_type: i.discount_type || "percentage",
        discount_value: String(i.discount_value ?? ""),
      }));
    setEditing({
      id: session.id,
      name: session.name || "",
      slug: session.slug || "",
      subtitle: session.subtitle || "",
      style: session.style || "flash",
      starts_at: toLocalInput(session.starts_at),
      ends_at: toLocalInput(session.ends_at),
      is_active: session.is_active !== false,
      items,
    });
  }

  function toggleProduct(productId) {
    setEditing((prev) => {
      const exists = prev.items.some((i) => i.product_id === productId);
      if (exists) {
        return {
          ...prev,
          items: prev.items.filter((i) => i.product_id !== productId),
        };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            product_id: productId,
            discount_type: "percentage",
            discount_value: bulkPercent || "10",
          },
        ],
      };
    });
  }

  function updateItem(productId, field, value) {
    setEditing((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.product_id === productId ? { ...i, [field]: value } : i,
      ),
    }));
  }

  function applyBulkPercent() {
    const value = String(Number(bulkPercent) || 0);
    if (Number(value) <= 0) return;
    setEditing((prev) => ({
      ...prev,
      items: prev.items.map((i) => ({
        ...i,
        discount_type: "percentage",
        discount_value: value,
      })),
    }));
  }

  async function saveSession(e) {
    e.preventDefault();
    if (!editing?.name?.trim()) {
      setError("Session name is required.");
      return;
    }
    const startsAt = fromLocalInput(editing.starts_at);
    const endsAt = fromLocalInput(editing.ends_at);
    if (!startsAt || !endsAt) {
      setError("Start and end date are required.");
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError("End date must be after the start date.");
      return;
    }
    if (editing.items.length === 0) {
      setError("Select at least one product.");
      return;
    }

    setSaving(true);
    setError("");

    const slug =
      slugifySession(editing.slug || editing.name) ||
      `sale-${Date.now().toString(36)}`;

    const payload = {
      name: editing.name.trim(),
      slug,
      subtitle: editing.subtitle.trim(),
      style: editing.style || "flash",
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: editing.is_active,
    };

    const { data: saved, error: saveError } = editing.id
      ? await supabase
          .from("discount_sessions")
          .update(payload)
          .eq("id", editing.id)
          .select()
          .single()
      : await supabase
          .from("discount_sessions")
          .insert(payload)
          .select()
          .single();

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    await supabase
      .from("discount_session_products")
      .delete()
      .eq("session_id", saved.id);

    const rows = editing.items.map((item, index) => ({
      session_id: saved.id,
      product_id: item.product_id,
      discount_type: item.discount_type === "fixed" ? "fixed" : "percentage",
      discount_value: Number(item.discount_value) || 0,
      sort_order: index,
    }));

    const { error: itemsError } = await supabase
      .from("discount_session_products")
      .insert(rows);

    if (itemsError) {
      setError(itemsError.message);
      setSaving(false);
      return;
    }

    setEditing(null);
    showFlash(editing.id ? "Session updated." : "Session created.");
    await loadAll();
    setSaving(false);
  }

  async function deleteSession(session) {
    if (!confirm(`Delete session "${session.name}"?`)) return;
    await supabase.from("discount_sessions").delete().eq("id", session.id);
    showFlash("Session deleted.");
    await loadAll();
  }

  async function toggleActive(session) {
    await supabase
      .from("discount_sessions")
      .update({ is_active: !session.is_active })
      .eq("id", session.id);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === session.id ? { ...s, is_active: !s.is_active } : s,
      ),
    );
  }

  const productMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p])),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, productQuery]);

  const selectedIds = new Set(editing?.items.map((i) => i.product_id) || []);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display text-ink">Discount Sessions</h1>
          <p className="text-sm text-muted mt-1">
            Timed campaigns with product-wise discounts. Live sessions appear in
            the header and on the homepage.
          </p>
        </div>
        <button onClick={openNew} className="btn btn-primary">
          <Plus size={16} /> New Session
        </button>
      </div>

      {flash && (
        <p className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
          {flash}
        </p>
      )}

      {loading ? (
        <div className="py-16 flex justify-center text-muted">
          <Loader2 className="animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="card p-10 text-center">
          <Zap className="mx-auto mb-3 text-accent" size={28} />
          <p className="text-ink font-medium">No discount sessions yet</p>
          <p className="text-sm text-muted mt-1">
            Create a Flash Sale or Black Friday campaign.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const status = sessionStatus(session);
            const count = session.discount_session_products?.length || 0;
            return (
              <div
                key={session.id}
                className="card p-4 sm:p-5 flex flex-wrap items-center gap-4"
              >
                <div className="flex-1 min-w-[200px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">{session.name}</p>
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusBadge(status)}`}
                    >
                      {status}
                    </span>
                    <span className="text-[11px] text-muted">
                      {STYLES.find((s) => s.value === session.style)?.label ||
                        session.style}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {new Date(session.starts_at).toLocaleString()} —{" "}
                    {new Date(session.ends_at).toLocaleString()} · {count}{" "}
                    product{count === 1 ? "" : "s"}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={session.is_active}
                    onChange={() => toggleActive(session)}
                  />
                  Active
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(session)}
                    className="btn btn-ghost"
                  >
                    <Pencil size={15} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSession(session)}
                    className="btn btn-ghost text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? "Edit session" : "New discount session"}
        subtitle="Name the campaign, set the period, then choose products and discounts."
        size="xl"
      >
        {editing && (
          <form onSubmit={saveSession} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Session name</label>
                <input
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      name: e.target.value,
                      slug: editing.id ? editing.slug : "",
                    })
                  }
                  placeholder="Flash Sale, Black Friday…"
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Style</label>
                <select
                  value={editing.style}
                  onChange={(e) =>
                    setEditing({ ...editing, style: e.target.value })
                  }
                  className="input"
                >
                  {STYLES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Subtitle</label>
              <input
                value={editing.subtitle}
                onChange={(e) =>
                  setEditing({ ...editing, subtitle: e.target.value })
                }
                placeholder="Limited time — ends soon"
                className="input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Starts</label>
                <input
                  type="datetime-local"
                  value={editing.starts_at}
                  onChange={(e) =>
                    setEditing({ ...editing, starts_at: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Ends</label>
                <input
                  type="datetime-local"
                  value={editing.ends_at}
                  onChange={(e) =>
                    setEditing({ ...editing, ends_at: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(e) =>
                  setEditing({ ...editing, is_active: e.target.checked })
                }
              />
              Active (shows in header & homepage while live)
            </label>

            <div className="border border-line rounded-xl p-4">
              <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold text-ink">Products</p>
                  <p className="text-xs text-muted">
                    Select products, then set a shared % or per-product amount.
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="label">Apply % to all selected</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={bulkPercent}
                        onChange={(e) => setBulkPercent(e.target.value)}
                        placeholder="20"
                        className="input w-24"
                      />
                      <button
                        type="button"
                        onClick={applyBulkPercent}
                        className="btn btn-outline"
                      >
                        <Percent size={14} /> Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative mb-3">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Search products…"
                  className="input pl-9"
                />
              </div>

              <div className="max-h-40 overflow-y-auto border border-line rounded-lg divide-y divide-line mb-4">
                {filteredProducts.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted">No products.</p>
                ) : (
                  filteredProducts.map((p) => {
                    const hasRegularPrice =
                      p.regular_price && Number(p.regular_price) > 0;

                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-primary/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleProduct(p.id)}
                        />
                        <span className="flex-1 text-ink truncate">
                          {p.name}
                        </span>
                        <div className="flex items-center gap-4 text-xs text-muted">
                          {/* Cost */}
                          <span className="flex flex-col items-end">
                            <span className="text-[10px] text-muted/70">
                              Cost
                            </span>
                            <span className="font-mono">
                              ৳{Number(p.cost || 0).toFixed(2)}
                            </span>
                          </span>
                          {/* Current Sale Price */}
                          <span className="flex flex-col items-end">
                            <span className="text-[10px] text-muted/70">
                              Current
                            </span>
                            <span
                              className={`font-mono ${hasRegularPrice ? "line-through text-muted/60" : ""}`}
                            >
                              ৳{Number(p.price).toFixed(2)}
                            </span>
                          </span>
                          {/* Old Sale Price (regular_price) */}
                          {hasRegularPrice && (
                            <span className="flex flex-col items-end">
                              <span className="text-[10px] text-muted/70">
                                Old Sale
                              </span>
                              <span className="font-mono text-amber-600">
                                ৳{Number(p.regular_price).toFixed(2)}
                              </span>
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              {editing.items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted">
                        <th className="pb-2 pr-3 font-medium">Product</th>
                        <th className="pb-2 pr-3 font-medium">Cost</th>
                        <th className="pb-2 pr-3 font-medium">Current Price</th>
                        <th className="pb-2 pr-3 font-medium">Old Sale</th>
                        <th className="pb-2 pr-3 font-medium">Type</th>
                        <th className="pb-2 pr-3 font-medium">Value</th>
                        <th className="pb-2 pr-3 font-medium">New Sale</th>
                        <th className="pb-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {editing.items.map((item) => {
                        const p = productMap[item.product_id];
                        if (!p) return null;

                        const sale = computeSalePrice(
                          p.price,
                          item.discount_type,
                          item.discount_value,
                        );
                        const hasRegularPrice =
                          p.regular_price && Number(p.regular_price) > 0;

                        // Calculate margin: (sale - cost) / sale * 100
                        const cost = Number(p.cost || 0);
                        const margin =
                          sale > 0 && cost > 0
                            ? (((sale - cost) / sale) * 100).toFixed(1)
                            : null;

                        return (
                          <tr
                            key={item.product_id}
                            className="border-t border-line"
                          >
                            <td className="py-2 pr-3 text-ink">
                              {p?.name || "Unknown"}
                            </td>
                            <td className="py-2 pr-3 text-xs font-mono text-muted">
                              ৳{Number(p.cost || 0).toFixed(2)}
                            </td>
                            <td className="py-2 pr-3 font-mono text-xs">
                              ৳{Number(p.price || 0).toFixed(2)}
                              {hasRegularPrice && (
                                <span className="ml-1 text-[10px] text-muted/60 line-through">
                                  ৳{Number(p.regular_price).toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-3 font-mono text-xs text-amber-600">
                              {hasRegularPrice
                                ? `৳${Number(p.regular_price).toFixed(2)}`
                                : "—"}
                            </td>
                            <td className="py-2 pr-3">
                              <select
                                value={item.discount_type}
                                onChange={(e) =>
                                  updateItem(
                                    item.product_id,
                                    "discount_type",
                                    e.target.value,
                                  )
                                }
                                className="input input-sm"
                              >
                                <option value="percentage">%</option>
                                <option value="fixed">Amount ৳</option>
                              </select>
                            </td>
                            <td className="py-2 pr-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.discount_value}
                                onChange={(e) =>
                                  updateItem(
                                    item.product_id,
                                    "discount_value",
                                    e.target.value,
                                  )
                                }
                                className="input input-sm w-24"
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <div className="flex flex-col">
                                <span className="font-mono font-medium text-accent">
                                  ৳{sale.toFixed(2)}
                                </span>
                                {margin !== null && (
                                  <span
                                    className={`text-[10px] ${Number(margin) < 0 ? "text-red-500" : "text-emerald-600"}`}
                                  >
                                    {Number(margin) >= 0 ? "+" : ""}
                                    {margin}% margin
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2">
                              <button
                                type="button"
                                onClick={() => toggleProduct(item.product_id)}
                                className="p-1.5 text-muted hover:text-red-600"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={saving}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />{" "}
                    {editing.id ? "Save Changes" : "Create Session"}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
