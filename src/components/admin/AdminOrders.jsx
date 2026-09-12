"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Mail,
  Printer,
  Loader2,
  Check,
  Truck,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { printPOSInvoice } from "@/lib/posInvoice";
import Pagination from "./Pagination";
import Modal from "./Modal";
import { useToast } from "@/components/Toast";
import {
  courierStatusLabel,
  courierTrackingUrl,
  COURIER_STATUS_PILL,
  normalizeSteadfastPhone,
} from "@/lib/steadfast";

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

const EMPTY_PARCEL = {
  orderId: "",
  recipient_name: "",
  recipient_phone: "",
  alternative_phone: "",
  recipient_email: "",
  recipient_address: "",
  cod_amount: "",
  note: "",
  delivery_type: 0,
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [parcelForm, setParcelForm] = useState(null);
  const [parcelSaving, setParcelSaving] = useState(false);
  const [parcelError, setParcelError] = useState("");
  const [selected, setSelected] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { success, error: toastError, warning } = useToast();

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

  async function deleteOrder(order) {
    setDeletingId(order.id);
    try {
      // First delete order items
      const { error: itemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", order.id);
      
      if (itemsError) throw itemsError;

      // Then delete the order
      const { error: orderError } = await supabase
        .from("orders")
        .delete()
        .eq("id", order.id);
      
      if (orderError) throw orderError;

      success(`Order ${order.tracking_code} deleted successfully.`);
      await loadOrders();
      setConfirmDelete(null);
      if (expanded === order.id) {
        setExpanded(null);
      }
    } catch (err) {
      toastError(err.message || "Failed to delete order.");
    } finally {
      setDeletingId(null);
    }
  }

  function openParcel(order) {
    setParcelError("");
    setParcelForm({
      ...EMPTY_PARCEL,
      orderId: order.id,
      recipient_name: order.customer_name || "",
      recipient_phone: normalizeSteadfastPhone(order.phone),
      recipient_email: order.email || "",
      recipient_address: order.address || "",
      cod_amount: String(order.total_amount ?? 0),
      note: order.notes || "",
      delivery_type: 0,
    });
  }

  async function createParcel(e) {
    e.preventDefault();
    if (!parcelForm?.orderId) return;
    setParcelSaving(true);
    setParcelError("");
    try {
      const res = await fetch("/api/admin/logistics/parcels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parcelForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setParcelForm(null);
      success("Parcel created with Steadfast.");
      await loadOrders();
    } catch (err) {
      setParcelError(err.message || "Could not create parcel.");
    } finally {
      setParcelSaving(false);
    }
  }

  function toggleSelect(orderId) {
    setSelected((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    );
  }

  const eligibleIds = orders
    .filter(
      (o) =>
        o.fulfillment_method !== "pickup" &&
        o.status !== "cancelled" &&
        !o.consignment_id,
    )
    .map((o) => o.id);

  function toggleSelectPage(ids) {
    const allSelected = ids.every((id) => selected.includes(id));
    setSelected((prev) =>
      allSelected
        ? prev.filter((id) => !ids.includes(id))
        : [...new Set([...prev, ...ids])],
    );
  }

  async function bulkCreateParcels() {
    const ids = selected.filter((id) => eligibleIds.includes(id));
    if (ids.length === 0) return;
    setBulkSaving(true);
    try {
      const res = await fetch("/api/admin/logistics/parcels/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const failed = (data.failed || []).length;
      if (failed) {
        warning(
          `Created ${data.created?.length || 0} parcel(s), ${failed} failed.`,
        );
      } else {
        success(`Created ${data.created?.length || 0} parcel(s).`);
      }
      setSelected([]);
      await loadOrders();
    } catch (err) {
      toastError(err.message || "Bulk parcel create failed.");
    } finally {
      setBulkSaving(false);
    }
  }

  function inDateRange(createdAt) {
    if (!dateFrom && !dateTo) return true;
    const t = new Date(createdAt).getTime();
    if (Number.isNaN(t)) return false;
    if (dateFrom) {
      const start = new Date(`${dateFrom}T00:00:00`).getTime();
      if (t < start) return false;
    }
    if (dateTo) {
      const end = new Date(`${dateTo}T23:59:59.999`).getTime();
      if (t > end) return false;
    }
    return true;
  }

  const datedOrders = orders.filter((o) => inDateRange(o.created_at));

  const filtered = datedOrders.filter((o) => {
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
  const paged = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const pageEligibleIds = paged
    .filter((o) => eligibleIds.includes(o.id))
    .map((o) => o.id);
  const selectedEligible = selected.filter((id) => eligibleIds.includes(id));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <h1 className="text-2xl font-display text-ink">Orders</h1>
        <div className="flex items-center gap-2">
          {selectedEligible.length > 0 && (
            <button
              onClick={bulkCreateParcels}
              disabled={bulkSaving}
              className="btn btn-primary btn-sm"
            >
              {bulkSaving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Truck size={14} />
              )}
              Create {selectedEligible.length} parcel
              {selectedEligible.length === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <button
              onClick={() => {
                setFilter("all");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs border ${
                filter === "all"
                  ? "bg-primary text-white border-primary"
                  : "bg-surface text-ink border-line"
              }`}
            >
              All ({datedOrders.length})
            </button>
            {STATUSES.map((s) => {
              const count = datedOrders.filter((o) => o.status === s.key)
                .length;
              return (
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
                  {s.label} ({count})
                </button>
              );
            })}
          </div>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name / code / phone"
            className="input input-sm w-full sm:w-auto sm:min-w-[200px]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted">
            From
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="input input-sm w-auto"
              aria-label="From date"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            To
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="input input-sm w-auto"
              aria-label="To date"
            />
          </label>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
              className="text-xs text-accent hover:underline"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted py-10 text-center">
          Loading orders...
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted py-10 text-center">No orders found.</p>
      ) : (
        <div className="card overflow-hidden">
          {pageEligibleIds.length > 0 && (
            <div className="px-5 py-2.5 border-b border-line flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={
                    pageEligibleIds.length > 0 &&
                    pageEligibleIds.every((id) => selected.includes(id))
                  }
                  onChange={() => toggleSelectPage(pageEligibleIds)}
                />
                Select page ({pageEligibleIds.length} eligible)
              </label>
            </div>
          )}
          <ul className="divide-y divide-line">
            {paged.map((order) => (
              <li key={order.id}>
                <div className="flex items-stretch">
                  {eligibleIds.includes(order.id) && (
                    <label className="flex items-center px-3 hover:bg-surface">
                      <input
                        type="checkbox"
                        checked={selected.includes(order.id)}
                        onChange={() => toggleSelect(order.id)}
                        aria-label={`Select ${order.tracking_code}`}
                      />
                    </label>
                  )}
                  <button
                    onClick={() => toggleExpand(order.id)}
                    className="flex-1 flex items-center justify-between px-5 py-4 text-left hover:bg-surface"
                  >
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        {expanded === order.id ? (
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
                      </div>
                      <p className="text-xs text-muted mt-0.5 pl-5">
                        {order.tracking_code} · ৳{order.total_amount} ·{" "}
                        {order.fulfillment_method === "pickup"
                          ? "Pickup"
                          : "Delivery"}{" "}
                        · {new Date(order.created_at).toLocaleDateString()}
                        {order.courier_tracking_code
                          ? ` · ${order.courier_tracking_code}`
                          : ""}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {order.consignment_id && (
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wide border ${
                            COURIER_STATUS_PILL[order.courier_status] ||
                            "bg-primary/10 text-primary border-primary/20"
                          }`}
                        >
                          {courierStatusLabel(order.courier_status)}
                        </span>
                      )}
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wide border ${
                          STATUS_PILL[order.status] ||
                          "bg-primary/10 text-primary border-primary/20"
                        }`}
                      >
                        {order.fulfillment_method === "pickup" &&
                        order.status === "out_for_delivery"
                          ? "ready for pickup"
                          : order.fulfillment_method === "pickup" &&
                              order.status === "delivered"
                            ? "collected"
                            : order.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </button>
                  <div className="flex items-center pr-3 gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(order);
                      }}
                      disabled={deletingId === order.id}
                      className="p-1.5 text-muted hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      aria-label="Delete order"
                    >
                      {deletingId === order.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>

                {expanded === order.id && (
                  <div className="px-5 pb-5">
                    <OrderDetail
                      order={order}
                      loadItems={loadItems}
                      updatingId={updatingId}
                      onUpdateStatus={updateStatus}
                      onCreateParcel={openParcel}
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

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => !deletingId && setConfirmDelete(null)}
        title="Delete Order"
        subtitle={`Are you sure you want to delete order #${confirmDelete?.tracking_code}?`}
      >
        {confirmDelete && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              <p className="font-semibold">Warning: This action cannot be undone.</p>
              <p className="mt-1">
                This will permanently delete the order and all associated items.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deletingId === confirmDelete.id}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteOrder(confirmDelete)}
                disabled={deletingId === confirmDelete.id}
                className="btn btn-danger btn-sm"
              >
                {deletingId === confirmDelete.id ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Delete Order
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(parcelForm)}
        onClose={() => !parcelSaving && setParcelForm(null)}
        title="Create Steadfast parcel"
        subtitle="Review recipient details, then send this order to courier."
      >
        {parcelForm && (
          <form onSubmit={createParcel} className="space-y-3">
            {parcelError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {parcelError}
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Recipient name</label>
                <input
                  className="input"
                  value={parcelForm.recipient_name}
                  onChange={(e) =>
                    setParcelForm((prev) => ({
                      ...prev,
                      recipient_name: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <label className="label">Phone (11 digits)</label>
                <input
                  className="input"
                  value={parcelForm.recipient_phone}
                  onChange={(e) =>
                    setParcelForm((prev) => ({
                      ...prev,
                      recipient_phone: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <label className="label">Alternative phone</label>
                <input
                  className="input"
                  value={parcelForm.alternative_phone}
                  onChange={(e) =>
                    setParcelForm((prev) => ({
                      ...prev,
                      alternative_phone: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={parcelForm.recipient_email}
                  onChange={(e) =>
                    setParcelForm((prev) => ({
                      ...prev,
                      recipient_email: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <textarea
                className="input min-h-24"
                value={parcelForm.recipient_address}
                onChange={(e) =>
                  setParcelForm((prev) => ({
                    ...prev,
                    recipient_address: e.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">COD amount</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={parcelForm.cod_amount}
                  onChange={(e) =>
                    setParcelForm((prev) => ({
                      ...prev,
                      cod_amount: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <label className="label">Delivery type</label>
                <select
                  className="input"
                  value={parcelForm.delivery_type}
                  onChange={(e) =>
                    setParcelForm((prev) => ({
                      ...prev,
                      delivery_type: Number(e.target.value),
                    }))
                  }
                >
                  <option value={0}>Home delivery</option>
                  <option value={1}>Point delivery / hub pickup</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Note</label>
              <input
                className="input"
                value={parcelForm.note}
                onChange={(e) =>
                  setParcelForm((prev) => ({ ...prev, note: e.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setParcelForm(null)}
                disabled={parcelSaving}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={parcelSaving}
                className="btn btn-primary btn-sm"
              >
                {parcelSaving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Truck size={14} />
                )}
                Create parcel
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function OrderDetail({
  order,
  loadItems,
  updatingId,
  onUpdateStatus,
  onCreateParcel,
}) {
  const { error: toastError } = useToast();
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
      const printed = printPOSInvoice({ order, items, site: site || {} });
      if (printed === false) {
        toastError("Please allow pop-ups to print the invoice.");
      }
    } catch (err) {
      toastError("Could not print the invoice.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="border border-line rounded-xl p-4 sm:p-5 bg-surface">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {STATUSES.map((s) => {
          const label =
            order.fulfillment_method === "pickup"
              ? s.key === "out_for_delivery"
                ? "Ready for Pickup"
                : s.key === "delivered"
                  ? "Collected"
                  : s.label
              : s.label;
          return (
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
              {updatingId === order.id && order.status !== s.key ? "..." : null}
              {order.status === s.key ? (
                <Check size={12} className="inline mr-1" />
              ) : null}
              {label}
            </button>
          );
        })}
        {order.fulfillment_method !== "pickup" &&
          order.status !== "cancelled" &&
          !order.consignment_id && (
            <button
              onClick={() => onCreateParcel(order)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-primary bg-primary text-white"
            >
              <Truck size={13} />
              Create Parcel
            </button>
          )}
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
              <li
                key={item.id}
                className="flex justify-between text-sm text-ink"
              >
                <span className="pr-3">
                  {item.product_name}
                  {item.variant_text && (
                    <span className="text-xs text-muted">
                      {" "}
                      ({item.variant_text})
                    </span>
                  )}{" "}
                  × {item.quantity}
                </span>
                <span className="shrink-0">
                  ৳{(item.price * item.quantity).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>

          <div className="border-t border-line pt-3 space-y-1 text-sm text-muted">
            <div className="flex justify-between">
              <span>
                {order.fulfillment_method === "pickup" ? "Pickup" : "Delivery"}
              </span>
              <span>
                {order.fulfillment_method === "pickup" ||
                Number(order.delivery_charge) === 0
                  ? "FREE"
                  : `৳${Number(order.delivery_charge || 0).toFixed(2)}`}
                {order.fulfillment_method === "pickup"
                  ? order.pickup_point_name
                    ? ` (${order.pickup_point_name})`
                    : ""
                  : order.delivery_zone_name
                    ? ` (${order.delivery_zone_name})`
                    : ""}
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
            {order.fulfillment_method === "pickup" ? (
              <>
                <p className="font-medium text-ink mb-1">Pickup Point</p>
                <p>{order.pickup_point_name || "Store pickup"}</p>
                {order.pickup_point_address && (
                  <p className="mt-0.5">{order.pickup_point_address}</p>
                )}
              </>
            ) : (
              <>
                <p className="font-medium text-ink mb-1">Delivery Address</p>
                <p>{order.address}</p>
              </>
            )}
            <p className="mt-0.5">{order.phone}</p>
          </div>

          {order.consignment_id && (
            <div className="border-t border-line mt-3 pt-3 text-sm text-muted">
              <p className="font-medium text-ink mb-1">Steadfast parcel</p>
              <p>Consignment #{order.consignment_id}</p>
              <p className="mt-0.5">
                Status: {courierStatusLabel(order.courier_status)}
              </p>
              {order.courier_tracking_code && (
                <p className="mt-0.5">
                  Tracking:{" "}
                  {courierTrackingUrl(order.courier_tracking_code) ? (
                    <a
                      href={courierTrackingUrl(order.courier_tracking_code)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {order.courier_tracking_code}
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    order.courier_tracking_code
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}