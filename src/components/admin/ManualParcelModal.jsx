"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Plus,
  Trash2,
  User,
  UserPlus,
  Package,
  Loader2,
  Truck,
  Scale,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Modal from "./Modal";
import { useToast } from "@/components/Toast";
import {
  computeCodCharge,
  computeWeightPricing,
  formatWeight,
} from "@/lib/weightPricing";

function money(n) {
  return `৳${Number(n || 0).toFixed(2)}`;
}

const EMPTY_CUSTOMER = { name: "", phone: "", email: "", address: "" };

export default function ManualParcelModal({ open, settings, onClose, onCreated }) {
  const { success, error: toastError, warning } = useToast();

  const [loadingData, setLoadingData] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [zones, setZones] = useState([]);

  const [mode, setMode] = useState("existing");
  const [customerId, setCustomerId] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [alternativePhone, setAlternativePhone] = useState("");

  const [items, setItems] = useState([]);
  const [productSearch, setProductSearch] = useState("");

  const [zoneId, setZoneId] = useState("");
  const [deliveryType, setDeliveryType] = useState(0);
  const [overrideWeight, setOverrideWeight] = useState("");
  const [codAmount, setCodAmount] = useState("");
  const [invoice, setInvoice] = useState("");
  const [note, setNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const keyRef = useRef(0);
  const nextKey = () => {
    keyRef.current += 1;
    return `item-${keyRef.current}`;
  };

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingData(true);
    setError("");
    setMode("existing");
    setCustomerId(null);
    setCustomerSearch("");
    setCustomer(EMPTY_CUSTOMER);
    setAlternativePhone("");
    setItems([]);
    setProductSearch("");
    setOverrideWeight("");
    setCodAmount("");
    setInvoice("");
    setNote("");
    setDeliveryType(Number(settings?.default_delivery_type || 0) === 1 ? 1 : 0);

    async function load() {
      try {
        const custRes = await fetch("/api/admin/logistics/customers");
        const custData = await custRes.json();
        if (!active) return;
        if (custRes.ok) setCustomers(custData.customers || []);

        const [prodRes, zoneRes] = await Promise.all([
          supabase
            .from("products")
            .select("id, name, price, weight, is_active")
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("delivery_zones")
            .select("*")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
        ]);
        if (!active) return;
        setProducts(prodRes.data || []);
        const zoneRows = zoneRes.data || [];
        setZones(zoneRows);
        setZoneId(zoneRows[0]?.id || "");
      } catch (err) {
        if (active) setError(err.message || "Could not load parcel data.");
      } finally {
        if (active) setLoadingData(false);
      }
    }

    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    const list = q
      ? customers.filter(
          (c) =>
            (c.name || "").toLowerCase().includes(q) ||
            (c.phone || "").includes(q),
        )
      : customers;
    return list.slice(0, 30);
  }, [customers, customerSearch]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => (p.name || "").toLowerCase().includes(q))
      .slice(0, 20);
  }, [products, productSearch]);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0),
    [items],
  );
  const itemsWeight = useMemo(
    () =>
      items.reduce(
        (sum, i) => sum + Number(i.weight || 0) * Number(i.quantity || 0),
        0,
      ),
    [items],
  );
  const totalWeight = useMemo(() => {
    const raw = overrideWeight !== "" ? Number(overrideWeight) : itemsWeight;
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }, [overrideWeight, itemsWeight]);

  const zone = useMemo(
    () => zones.find((z) => z.id === zoneId) || null,
    [zones, zoneId],
  );

  const pricing = useMemo(
    () =>
      computeWeightPricing({
        weightKg: totalWeight,
        baseCharge: zone?.charge,
        baseWeightKg: zone?.base_weight_kg ?? 1,
        extraKgCharge: zone?.extra_kg_charge ?? 0,
      }),
    [totalWeight, zone],
  );

  const weightCharge = pricing.weightCharge;
  const payable = subtotal + weightCharge;
  const codPercent = Math.max(0, Number(settings?.cod_percent ?? 1) || 0);
  const effectiveCod =
    codAmount !== "" && Number.isFinite(Number(codAmount))
      ? Math.max(0, Number(codAmount))
      : payable;
  const codCharge = computeCodCharge(effectiveCod, codPercent);

  function selectCustomer(c) {
    setMode("existing");
    setCustomerId(c.id || c.phone);
    setCustomer({
      name: c.name || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
    });
    setCustomerSearch(c.name || c.phone || "");
    setCustomerOpen(false);
  }

  function startNewCustomer() {
    setMode("new");
    setCustomerId(null);
    setCustomer(EMPTY_CUSTOMER);
    setCustomerSearch("");
    setCustomerOpen(false);
  }

  function addProduct(product) {
    setProductSearch("");
    setItems((prev) => {
      const idx = prev.findIndex(
        (i) => i.product_id && i.product_id === product.id,
      );
      if (idx >= 0) {
        return prev.map((i, n) =>
          n === idx ? { ...i, quantity: Number(i.quantity || 0) + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          key: nextKey(),
          product_id: product.id,
          product_name: product.name || "",
          price: Number(product.price || 0),
          weight: Number(product.weight || 0),
          quantity: 1,
        },
      ];
    });
  }

  function addCustomItem() {
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        product_id: null,
        product_name: "",
        price: 0,
        weight: 0,
        quantity: 1,
      },
    ]);
  }

  function updateItem(key, patch) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function removeItem(key) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (!customer.name.trim()) {
      setError("Customer name is required.");
      return;
    }
    if (!customer.phone.trim()) {
      setError("Customer phone is required.");
      return;
    }
    if (!customer.address.trim()) {
      setError("Delivery address is required.");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one product to the parcel.");
      return;
    }
    if (items.some((i) => !String(i.product_name || "").trim())) {
      setError("Every product line needs a name.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/logistics/parcels/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice: invoice.trim() || undefined,
          customer_id: customerId,
          recipient_name: customer.name.trim(),
          recipient_phone: customer.phone.trim(),
          alternative_phone: alternativePhone.trim() || undefined,
          recipient_email: customer.email.trim() || undefined,
          recipient_address: customer.address.trim(),
          zone_id: zoneId || undefined,
          delivery_type: deliveryType,
          cod_amount: codAmount === "" ? undefined : Number(codAmount),
          total_weight: overrideWeight === "" ? undefined : Number(overrideWeight),
          note: note.trim() || undefined,
          items: items.map((i) => ({
            product_id: i.product_id || undefined,
            product_name: i.product_name,
            quantity: Number(i.quantity) || 1,
            price: Number(i.price) || 0,
            weight: Number(i.weight) || 0,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.warning) {
        warning(data.warning);
      } else {
        success(`Parcel created for ${data.order?.tracking_code}.`);
      }
      onCreated?.(data);
      onClose();
    } catch (err) {
      setError(err.message || "Could not create manual order.");
      toastError(err.message || "Could not create manual order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Create parcel"
      subtitle="Pick an old customer or add a new one, add products, and the order is created as Manual."
      size="lg"
    >
      <form onSubmit={submit} className="space-y-5">
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {loadingData && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" /> Loading customers,
            products and delivery zones...
          </p>
        )}

        {/* ---------- Customer ---------- */}
        <section className="border border-line rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink">Customer</h3>
            <button
              type="button"
              onClick={startNewCustomer}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                mode === "new"
                  ? "bg-primary text-white border-primary"
                  : "bg-surface text-ink border-line"
              }`}
            >
              <UserPlus size={13} /> New customer
            </button>
          </div>

          {mode === "existing" && (
            <div className="relative mb-3">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                className="input pl-9"
                placeholder="Search old customer by name or phone"
                value={customerSearch}
                onFocus={() => setCustomerOpen(true)}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setCustomerOpen(true);
                }}
              />
              {customerOpen && filteredCustomers.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-surface border border-line rounded-xl shadow-lg divide-y divide-line">
                  {filteredCustomers.map((c) => (
                    <li key={c.phone}>
                      <button
                        type="button"
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2 hover:bg-surface"
                      >
                        <p className="text-sm text-ink">
                          {c.name || "Unnamed"}{" "}
                          {c.saved && (
                            <span className="text-[10px] uppercase text-primary">
                              saved
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted">
                          {c.phone}
                          {c.address ? ` · ${c.address.slice(0, 40)}` : ""}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {customerOpen && filteredCustomers.length === 0 && (
                <div className="absolute z-20 mt-1 w-full bg-surface border border-line rounded-xl shadow-lg px-3 py-2 text-xs text-muted">
                  No saved customer.{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={startNewCustomer}
                  >
                    Add a new one
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === "new" && (
            <p className="flex items-center gap-1.5 text-xs text-muted mb-3">
              <User size={12} /> Entering a new customer. It will be saved to the
              customer list.
            </p>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={customer.name}
                onChange={(e) =>
                  setCustomer((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="label">Phone (11 digits)</label>
              <input
                className="input"
                value={customer.phone}
                onChange={(e) =>
                  setCustomer((prev) => ({ ...prev, phone: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="label">Alternative phone</label>
              <input
                className="input"
                value={alternativePhone}
                onChange={(e) => setAlternativePhone(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={customer.email}
                onChange={(e) =>
                  setCustomer((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <textarea
                className="input min-h-20"
                value={customer.address}
                onChange={(e) =>
                  setCustomer((prev) => ({ ...prev, address: e.target.value }))
                }
                required
              />
            </div>
          </div>
        </section>

        {/* ---------- Products ---------- */}
        <section className="border border-line rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink">Products</h3>
            <button
              type="button"
              onClick={addCustomItem}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-line bg-surface text-ink"
            >
              <Plus size={13} /> Custom line
            </button>
          </div>

          <div className="relative mb-3">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              className="input pl-9"
              placeholder="Search product to add"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            {filteredProducts.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-surface border border-line rounded-xl shadow-lg divide-y divide-line">
                {filteredProducts.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => addProduct(p)}
                      className="w-full flex items-center justify-between gap-3 text-left px-3 py-2 hover:bg-surface"
                    >
                      <span className="text-sm text-ink">{p.name}</span>
                      <span className="text-xs text-muted shrink-0">
                        {money(p.price)} · {formatWeight(p.weight)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {productSearch && filteredProducts.length === 0 && (
              <div className="absolute z-20 mt-1 w-full bg-surface border border-line rounded-xl shadow-lg px-3 py-2 text-xs text-muted">
                No product matched. Use “Custom line” to add it manually.
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Package size={12} /> No products added yet.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="grid grid-cols-12 gap-2 items-end border border-line rounded-xl p-2.5"
                >
                  <div className="col-span-12 sm:col-span-4">
                    <label className="label text-[11px]">Product</label>
                    <input
                      className="input input-sm"
                      value={item.product_name}
                      onChange={(e) =>
                        updateItem(item.key, { product_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="label text-[11px]">Qty</label>
                    <input
                      className="input input-sm"
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.key, { quantity: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="label text-[11px]">Price</label>
                    <input
                      className="input input-sm"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(e) =>
                        updateItem(item.key, { price: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="label text-[11px]">Weight kg</label>
                    <input
                      className="input input-sm"
                      type="number"
                      min="0"
                      step="0.001"
                      value={item.weight}
                      onChange={(e) =>
                        updateItem(item.key, { weight: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-10 sm:col-span-1 text-sm text-ink text-right">
                    {money(Number(item.price || 0) * Number(item.quantity || 0))}
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      className="p-1.5 text-muted hover:text-red-600"
                      aria-label="Remove product"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---------- Delivery & weight pricing ---------- */}
        <section className="border border-line rounded-xl p-4">
          <h3 className="text-sm font-semibold text-ink mb-3">
            Delivery &amp; weight charge
          </h3>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Delivery zone</label>
              <select
                className="input"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
              >
                <option value="">— No zone (no delivery charge) —</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} — {money(z.charge)} / first{" "}
                    {Number(z.base_weight_kg ?? 1)}kg
                    {Number(z.extra_kg_charge || 0) > 0
                      ? `, +${money(z.extra_kg_charge)}/kg`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Delivery type</label>
              <select
                className="input"
                value={deliveryType}
                onChange={(e) => setDeliveryType(Number(e.target.value))}
              >
                <option value={0}>Home delivery</option>
                <option value={1}>Point delivery / hub pickup</option>
              </select>
            </div>
            <div>
              <label className="label">Total weight (kg)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.001"
                value={overrideWeight}
                onChange={(e) => setOverrideWeight(e.target.value)}
                placeholder={String(itemsWeight)}
              />
              <p className="text-[11px] text-muted mt-1">
                Products weigh {formatWeight(itemsWeight)}. Leave blank to use it.
              </p>
            </div>
            <div>
              <label className="label">Invoice / tracking code</label>
              <input
                className="input"
                value={invoice}
                onChange={(e) => setInvoice(e.target.value)}
                placeholder="Auto-generate"
              />
            </div>
            <div>
              <label className="label">Note</label>
              <input
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* ---------- Summary ---------- */}
        <section className="border border-line rounded-xl p-4 bg-surface">
          <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-1.5">
            <Scale size={14} /> Pricing summary
          </h3>
          <div className="space-y-1.5 text-sm">
            <Row label="Items subtotal" value={money(subtotal)} />
            <Row
              label={`Delivery (${formatWeight(totalWeight)})`}
              value={money(weightCharge)}
              hint={
                zone
                  ? `Base ${money(pricing.baseCharge)} + ${pricing.extraKg} extra kg × ${money(
                      pricing.extraKgCharge,
                    )}`
                  : "Select a delivery zone to apply weight charge"
              }
            />
            <Row label="Customer pays (COD)" value={money(effectiveCod)} strong />
            <div className="flex items-center justify-between gap-3 pt-1">
              <label className="text-xs text-muted">
                Override COD amount (optional)
              </label>
              <input
                className="input input-sm w-32 text-right"
                type="number"
                min="0"
                step="0.01"
                value={codAmount}
                onChange={(e) => setCodAmount(e.target.value)}
                placeholder={String(payable)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-muted border-t border-line pt-2 mt-2">
              <span>
                COD fee {codPercent}% (paid by admin, not charged to customer)
              </span>
              <span className="text-red-600">−{money(codCharge)}</span>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn btn-ghost btn-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || loadingData}
            className="btn btn-primary btn-sm"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Truck size={14} />
            )}
            Create parcel &amp; order
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Row({ label, value, hint, strong }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <span className={strong ? "font-semibold text-ink" : "text-muted"}>
          {label}
        </span>
        {hint && <p className="text-[11px] text-muted mt-0.5">{hint}</p>}
      </div>
      <span className={strong ? "font-semibold text-ink" : "text-ink"}>
        {value}
      </span>
    </div>
  );
}
