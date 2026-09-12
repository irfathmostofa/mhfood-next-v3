"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Save,
  Loader2,
  Truck,
  Wallet,
  Package,
  RotateCcw,
  CreditCard,
  ExternalLink,
  Settings2,
  Plus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Pagination from "./Pagination";
import Modal from "./Modal";
import { useToast } from "@/components/Toast";
import {
  courierStatusLabel,
  courierTrackingUrl,
  COURIER_STATUS_PILL,
} from "@/lib/steadfast";

const TABS = [
  { id: "parcels", label: "Parcels", icon: Package },
  { id: "returns", label: "Returns", icon: RotateCcw },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "settings", label: "Settings", icon: Settings2 },
];

const PARCEL_FILTERS = [
  { key: "all", label: "All parcels" },
  { key: "in_review", label: "In review" },
  { key: "pending", label: "Pending" },
  { key: "hold", label: "On hold" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

function money(n) {
  return `৳${Number(n || 0).toFixed(2)}`;
}

function asList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.payments)) return data.payments;
  if (Array.isArray(data?.return_requests)) return data.return_requests;
  return [];
}

const EMPTY_MANUAL = {
  invoice: "",
  recipient_name: "",
  recipient_phone: "",
  alternative_phone: "",
  recipient_email: "",
  recipient_address: "",
  cod_amount: "0",
  note: "",
  item_description: "",
  total_lot: "1",
  delivery_type: 0,
};

export default function AdminLogistics() {
  const [tab, setTab] = useState("parcels");
  const [settings, setSettings] = useState(null);
  const [balance, setBalance] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const { success, error: toastError } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoading(true);
    setError("");
    await Promise.all([loadSettings(), loadOrders(), loadBalance()]);
    setLoading(false);
  }

  async function loadSettings() {
    try {
      const res = await fetch("/api/admin/logistics/settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data.settings);
    } catch (err) {
      toastError(err.message || "Could not load logistics settings.");
    }
  }

  async function loadOrders() {
    const { data, error: queryError } = await supabase
      .from("orders")
      .select("*")
      .not("consignment_id", "is", null)
      .order("parcel_created_at", { ascending: false });
    if (queryError) {
      setError(queryError.message);
      setOrders([]);
      return;
    }
    setOrders(data || []);
  }

  async function loadBalance() {
    try {
      const res = await fetch("/api/admin/logistics/balance");
      const data = await res.json();
      if (res.ok) setBalance(data.current_balance);
    } catch {
      setBalance(null);
    }
  }

  function openManual() {
    setManualError("");
    setManualForm({
      ...EMPTY_MANUAL,
      delivery_type: Number(settings?.default_delivery_type || 0),
    });
    setManualOpen(true);
  }

  async function createManualOrder(e) {
    e.preventDefault();
    setManualSaving(true);
    setManualError("");
    try {
      const res = await fetch("/api/admin/logistics/parcels/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setManualOpen(false);
      setManualForm(EMPTY_MANUAL);
      success("Manual order created and sent to Steadfast.");
      setTab("parcels");
      await Promise.all([loadOrders(), loadBalance()]);
    } catch (err) {
      setManualError(err.message || "Could not create manual order.");
    } finally {
      setManualSaving(false);
    }
  }

  async function syncStatuses() {
    setSyncing(true);
    setError("");
    try {
      const res = await fetch("/api/admin/logistics/parcels/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success(`Synced ${data.updated || 0} parcel(s).`);
      await Promise.all([loadOrders(), loadBalance()]);
    } catch (err) {
      toastError(err.message || "Could not sync statuses.");
    } finally {
      setSyncing(false);
    }
  }

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      if (filter !== "all" && order.courier_status !== filter) return false;
      if (!search) return true;
      const hay = `${order.customer_name} ${order.tracking_code} ${order.phone} ${order.courier_tracking_code || ""} ${order.consignment_id || ""}`.toLowerCase();
      return hay.includes(search.toLowerCase());
    });
  }, [orders, filter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const counts = useMemo(() => {
    const map = { all: orders.length };
    for (const order of orders) {
      map[order.courier_status] = (map[order.courier_status] || 0) + 1;
    }
    return map;
  }, [orders]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display text-ink">Logistics</h1>
          <p className="text-sm text-muted mt-1">
            Steadfast courier parcels, returns, payments, and API keys.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-surface text-sm">
            <Wallet size={15} className="text-muted" />
            <span className="text-muted">Balance</span>
            <span className="font-medium text-ink">
              {balance === null ? "—" : money(balance)}
            </span>
          </div>
          <button onClick={openManual} className="btn btn-primary btn-sm">
            <Plus size={14} />
            Create order
          </button>
          <button
            onClick={syncStatuses}
            disabled={syncing}
            className="btn btn-ghost btn-sm"
          >
            {syncing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Sync statuses
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border ${
              tab === item.id
                ? "bg-primary text-white border-primary"
                : "bg-surface text-ink border-line"
            }`}
          >
            <item.icon size={13} />
            {item.label}
          </button>
        ))}
      </div>

      {tab === "parcels" && (
        <ParcelsPanel
          loading={loading}
          filtered={filtered}
          paged={paged}
          filter={filter}
          setFilter={(value) => {
            setFilter(value);
            setPage(1);
          }}
          search={search}
          setSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          counts={counts}
          currentPage={currentPage}
          pageSize={pageSize}
          setPage={setPage}
          setPageSize={setPageSize}
        />
      )}
      {tab === "returns" && <ReturnsPanel />}
      {tab === "payments" && <PaymentsPanel />}
      {tab === "settings" && (
        <SettingsPanel
          settings={settings}
          onSaved={(next) => {
            setSettings(next);
            success("Logistics settings saved.");
            loadBalance();
          }}
          onError={(msg) => {
            setError(msg);
            if (msg) toastError(msg);
          }}
        />
      )}

      <Modal
        open={manualOpen}
        onClose={() => !manualSaving && setManualOpen(false)}
        title="Create manual order"
        subtitle="Creates a store order and sends the parcel to Steadfast."
      >
        <form onSubmit={createManualOrder} className="space-y-3">
          {manualError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {manualError}
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Invoice / tracking code</label>
              <input
                className="input"
                value={manualForm.invoice}
                onChange={(e) =>
                  setManualForm((prev) => ({ ...prev, invoice: e.target.value }))
                }
                placeholder="Leave blank to auto-generate"
              />
            </div>
            <div>
              <label className="label">Recipient name</label>
              <input
                className="input"
                value={manualForm.recipient_name}
                onChange={(e) =>
                  setManualForm((prev) => ({
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
                value={manualForm.recipient_phone}
                onChange={(e) =>
                  setManualForm((prev) => ({
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
                value={manualForm.alternative_phone}
                onChange={(e) =>
                  setManualForm((prev) => ({
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
                value={manualForm.recipient_email}
                onChange={(e) =>
                  setManualForm((prev) => ({
                    ...prev,
                    recipient_email: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="label">COD amount</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={manualForm.cod_amount}
                onChange={(e) =>
                  setManualForm((prev) => ({
                    ...prev,
                    cod_amount: e.target.value,
                  }))
                }
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <textarea
              className="input min-h-24"
              value={manualForm.recipient_address}
              onChange={(e) =>
                setManualForm((prev) => ({
                  ...prev,
                  recipient_address: e.target.value,
                }))
              }
              required
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Item description</label>
              <input
                className="input"
                value={manualForm.item_description}
                onChange={(e) =>
                  setManualForm((prev) => ({
                    ...prev,
                    item_description: e.target.value,
                  }))
                }
                placeholder="e.g. Mixed fruits 2kg"
              />
            </div>
            <div>
              <label className="label">Total lot</label>
              <input
                className="input"
                type="number"
                min="1"
                value={manualForm.total_lot}
                onChange={(e) =>
                  setManualForm((prev) => ({
                    ...prev,
                    total_lot: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="label">Delivery type</label>
              <select
                className="input"
                value={manualForm.delivery_type}
                onChange={(e) =>
                  setManualForm((prev) => ({
                    ...prev,
                    delivery_type: Number(e.target.value),
                  }))
                }
              >
                <option value={0}>Home delivery</option>
                <option value={1}>Point delivery / hub pickup</option>
              </select>
            </div>
            <div>
              <label className="label">Note</label>
              <input
                className="input"
                value={manualForm.note}
                onChange={(e) =>
                  setManualForm((prev) => ({ ...prev, note: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setManualOpen(false)}
              disabled={manualSaving}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={manualSaving}
              className="btn btn-primary btn-sm"
            >
              {manualSaving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Truck size={14} />
              )}
              Create order
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ParcelsPanel({
  loading,
  filtered,
  paged,
  filter,
  setFilter,
  search,
  setSearch,
  counts,
  currentPage,
  pageSize,
  setPage,
  setPageSize,
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {PARCEL_FILTERS.map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              filter === item.key
                ? "bg-primary text-white border-primary"
                : "bg-surface text-ink border-line"
            }`}
          >
            {item.label} ({counts[item.key] || 0})
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name / invoice / tracking"
          className="input input-sm ml-auto"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted py-10 text-center">Loading parcels...</p>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <Truck size={28} className="mx-auto text-muted mb-3" />
          <p className="text-sm text-ink font-medium">No courier parcels yet</p>
          <p className="text-xs text-muted mt-1">
            Create a parcel from Orders, or use Create order on this page.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Order</th>
                  <th className="text-left font-medium px-4 py-3">Customer</th>
                  <th className="text-left font-medium px-4 py-3">COD</th>
                  <th className="text-left font-medium px-4 py-3">Courier</th>
                  <th className="text-left font-medium px-4 py-3">Tracking</th>
                  <th className="text-left font-medium px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paged.map((order) => {
                  const url = courierTrackingUrl(order.courier_tracking_code);
                  return (
                    <tr key={order.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">
                          {order.tracking_code}
                        </p>
                        <p className="text-xs text-muted">
                          CID {order.consignment_id}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-ink">{order.customer_name}</p>
                        <p className="text-xs text-muted">{order.phone}</p>
                      </td>
                      <td className="px-4 py-3">{money(order.total_amount)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wide border ${
                            COURIER_STATUS_PILL[order.courier_status] ||
                            "bg-primary/10 text-primary border-primary/20"
                          }`}
                        >
                          {courierStatusLabel(order.courier_status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            {order.courier_tracking_code}
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {order.parcel_created_at
                          ? new Date(order.parcel_created_at).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

function SettingsPanel({ settings, onSaved, onError }) {
  const [form, setForm] = useState({
    is_enabled: false,
    default_delivery_type: 0,
    api_key: "",
    secret_key: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      is_enabled: Boolean(settings.is_enabled),
      default_delivery_type: Number(settings.default_delivery_type || 0),
      api_key: "",
      secret_key: "",
    });
  }, [settings]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      const res = await fetch("/api/admin/logistics/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm((prev) => ({ ...prev, api_key: "", secret_key: "" }));
      onSaved(data.settings);
    } catch (err) {
      onError(err.message || "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card p-5 sm:p-6 max-w-xl space-y-4">
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-ink">
            Enable Steadfast
          </span>
          <span className="block text-xs text-muted mt-0.5">
            Turn on courier parcel creation from the order list.
          </span>
        </span>
        <input
          type="checkbox"
          checked={form.is_enabled}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, is_enabled: e.target.checked }))
          }
        />
      </label>

      <div>
        <label className="label">Default delivery type</label>
        <select
          className="input"
          value={form.default_delivery_type}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              default_delivery_type: Number(e.target.value),
            }))
          }
        >
          <option value={0}>Home delivery</option>
          <option value={1}>Point delivery / Steadfast hub pickup</option>
        </select>
      </div>

      <div>
        <label className="label">API key</label>
        <input
          className="input"
          value={form.api_key}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, api_key: e.target.value }))
          }
          placeholder={
            settings?.api_key_masked || "Paste Steadfast API key"
          }
        />
      </div>

      <div>
        <label className="label">Secret key</label>
        <input
          className="input"
          type="password"
          value={form.secret_key}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, secret_key: e.target.value }))
          }
          placeholder={
            settings?.secret_key_masked || "Paste Steadfast secret key"
          }
        />
      </div>

      <p className="text-xs text-muted">
        Keys are stored in Supabase and used only by admin API routes. Leave a
        field blank to keep the current key.
        {settings?.env_configured
          ? " Environment keys are also available as fallback."
          : ""}
      </p>

      <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
        {saving ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Save size={14} />
        )}
        Save settings
      </button>
    </form>
  );
}

function ReturnsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    consignment_id: "",
    invoice: "",
    tracking_code: "",
    reason: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/logistics/returns");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(asList(data.data));
    } catch (err) {
      setError(err.message || "Could not load returns.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function createReturn(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/logistics/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({
        consignment_id: "",
        invoice: "",
        tracking_code: "",
        reason: "",
      });
      await load();
    } catch (err) {
      setError(err.message || "Could not create return request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <form onSubmit={createReturn} className="card p-5 space-y-3 h-fit">
        <h2 className="text-sm font-semibold text-ink">New return request</h2>
        <input
          className="input"
          placeholder="Consignment id"
          value={form.consignment_id}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, consignment_id: e.target.value }))
          }
        />
        <input
          className="input"
          placeholder="Invoice / store tracking code"
          value={form.invoice}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, invoice: e.target.value }))
          }
        />
        <input
          className="input"
          placeholder="Courier tracking code"
          value={form.tracking_code}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, tracking_code: e.target.value }))
          }
        />
        <textarea
          className="input min-h-24"
          placeholder="Reason (optional)"
          value={form.reason}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, reason: e.target.value }))
          }
        />
        <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Create return
        </button>
      </form>

      <div className="card overflow-hidden">
        {error && (
          <p className="text-sm text-red-700 px-5 pt-4">{error}</p>
        )}
        {loading ? (
          <p className="text-sm text-muted py-10 text-center">
            Loading returns...
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted py-10 text-center">
            No return requests found.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row, idx) => (
              <li key={row.id || idx} className="px-5 py-4 text-sm">
                <p className="font-medium text-ink">
                  {row.consignment_id || row.invoice || "Return"}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {row.status || "pending"}
                  {row.reason ? ` · ${row.reason}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PaymentsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/logistics/payments");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(asList(data.data));
    } catch (err) {
      setError(err.message || "Could not load payments.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function openPayment(row) {
    const id = row.id || row.payment_id;
    if (!id) return;
    setSelected(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/logistics/payments/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetail(data.data);
    } catch (err) {
      setError(err.message || "Could not load payment.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  const consignments = asList(detail?.consignments || detail?.data || detail);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card overflow-hidden">
        {error && (
          <p className="text-sm text-red-700 px-5 pt-4">{error}</p>
        )}
        {loading ? (
          <p className="text-sm text-muted py-10 text-center">
            Loading payments...
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted py-10 text-center">
            No courier payments found.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row, idx) => {
              const id = row.id || row.payment_id || idx;
              return (
                <li key={id}>
                  <button
                    onClick={() => openPayment(row)}
                    className={`w-full text-left px-5 py-4 hover:bg-surface ${
                      selected === (row.id || row.payment_id)
                        ? "bg-surface"
                        : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-ink">
                      Payment #{row.id || row.payment_id || idx + 1}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {row.amount != null ? money(row.amount) : ""}
                      {row.status ? ` · ${row.status}` : ""}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card p-5">
        {!selected ? (
          <p className="text-sm text-muted">Select a payment to view consignments.</p>
        ) : detailLoading ? (
          <p className="text-sm text-muted">Loading payment details...</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {consignments.length === 0 ? (
              <li className="text-muted">No consignment details returned.</li>
            ) : (
              consignments.map((item, idx) => (
                <li key={item.consignment_id || idx} className="border-b border-line pb-2">
                  <p className="font-medium text-ink">
                    {item.invoice || item.tracking_code || item.consignment_id}
                  </p>
                  <p className="text-xs text-muted">
                    {item.status || ""}{" "}
                    {item.cod_amount != null ? `· ${money(item.cod_amount)}` : ""}
                  </p>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
