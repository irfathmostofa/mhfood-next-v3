export const PIXEL_CURRENCY = "BDT";

const META_KEYS = new Set([
  "content_ids",
  "contents",
  "content_type",
  "content_name",
  "content_category",
  "value",
  "currency",
  "num_items",
  "order_id",
  "status",
  "search_string",
]);

export function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function productPixelPayload(product, { quantity = 1, value } = {}) {
  const id = String(product?.id ?? "");
  const qty = Math.max(1, Number(quantity) || 1);
  const unit = roundMoney(value != null ? value : product?.price);
  const name = product?.name || "";
  return {
    content_type: "product",
    content_ids: id ? [id] : [],
    content_name: name,
    contents: id ? [{ id, quantity: qty, item_price: unit }] : [],
    value: roundMoney(unit * qty),
    currency: PIXEL_CURRENCY,
    num_items: qty,
    items: [
      {
        item_id: id,
        item_name: name,
        quantity: qty,
        price: unit,
      },
    ],
  };
}

export function cartPixelPayload(items, totalValue, extra = {}) {
  const list = Array.isArray(items) ? items : [];
  const content_ids = list.map((i) => String(i.product_id)).filter(Boolean);
  const contents = list.map((i) => ({
    id: String(i.product_id),
    quantity: Number(i.quantity) || 1,
    item_price: roundMoney(i.price),
  }));
  const num_items = list.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
  return {
    content_type: "product",
    content_ids,
    contents,
    content_name: list.map((i) => i.product_name).filter(Boolean).join(", "),
    value: roundMoney(totalValue),
    currency: PIXEL_CURRENCY,
    num_items,
    items: list.map((i) => ({
      item_id: String(i.product_id),
      item_name: i.product_name || "",
      quantity: Number(i.quantity) || 1,
      price: roundMoney(i.price),
    })),
    ...extra,
  };
}

export function metaEventParams(params) {
  const out = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (!META_KEYS.has(key) || value == null || value === "") continue;
    out[key] = key === "value" ? roundMoney(value) : value;
  }
  if (out.value != null && !out.currency) out.currency = PIXEL_CURRENCY;
  return out;
}

export function gaEventName(eventName) {
  const map = {
    ViewContent: "view_item",
    AddToCart: "add_to_cart",
    InitiateCheckout: "begin_checkout",
    Purchase: "purchase",
    PageView: "page_view",
  };
  return map[eventName] || eventName;
}

export function gaEventParams(eventName, params) {
  const p = params || {};
  const out = {
    currency: p.currency || PIXEL_CURRENCY,
  };
  if (p.value != null) out.value = roundMoney(p.value);
  const transactionId = p.transaction_id || p.order_id;
  if (transactionId) out.transaction_id = String(transactionId);
  if (Array.isArray(p.items) && p.items.length) {
    out.items = p.items;
  } else if (Array.isArray(p.contents) && p.contents.length) {
    out.items = p.contents.map((c) => ({
      item_id: String(c.id),
      item_name: p.content_name || "",
      quantity: Number(c.quantity) || 1,
      price: roundMoney(c.item_price),
    }));
  }
  if (eventName === "ViewContent" || eventName === "AddToCart") {
    if (p.content_name) out.item_name = p.content_name;
    if (Array.isArray(p.content_ids) && p.content_ids[0]) {
      out.item_id = String(p.content_ids[0]);
    }
  }
  return out;
}

export function tiktokEventParams(params) {
  const p = params || {};
  const contents = Array.isArray(p.contents)
    ? p.contents.map((c) => ({
        content_id: String(c.id),
        content_type: "product",
        quantity: Number(c.quantity) || 1,
        price: roundMoney(c.item_price),
      }))
    : undefined;
  const out = {
    content_type: "product",
    value: p.value != null ? roundMoney(p.value) : undefined,
    currency: p.currency || PIXEL_CURRENCY,
  };
  if (Array.isArray(p.content_ids) && p.content_ids[0]) {
    out.content_id = String(p.content_ids[0]);
  }
  if (contents) out.contents = contents;
  if (p.content_name) out.content_name = p.content_name;
  if (p.num_items != null) out.quantity = p.num_items;
  if (p.order_id || p.transaction_id) {
    out.order_id = String(p.order_id || p.transaction_id);
  }
  return out;
}

export function normalizeEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : "";
}

export function normalizePhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("01")) digits = `88${digits}`;
  if (digits.length === 10 && digits.startsWith("1")) digits = `880${digits}`;
  return digits;
}

export function splitPersonName(name) {
  const parts = String(name || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { fn: "", ln: "" };
  if (parts.length === 1) return { fn: parts[0], ln: "" };
  return { fn: parts[0], ln: parts.slice(1).join(" ") };
}

export function buildMetaUserData({ email, phone, name } = {}) {
  const data = {};
  const em = normalizeEmail(email);
  const ph = normalizePhone(phone);
  const { fn, ln } = splitPersonName(name);
  if (em) data.em = em;
  if (ph) data.ph = ph;
  if (fn) data.fn = fn;
  if (ln) data.ln = ln;
  return data;
}

export function setMetaAdvancedMatching(user) {
  if (typeof window === "undefined") return;
  const pixelId = window.__metaPixelId;
  if (!pixelId || typeof window.fbq !== "function") return;
  const userData = buildMetaUserData(user);
  if (!Object.keys(userData).length) return;
  window.fbq("init", pixelId, userData);
}
