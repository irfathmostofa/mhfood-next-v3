const DEFAULT_BASE_URL = "https://portal.packzy.com/api/v1";

export const COURIER_STATUS_LABELS = {
  pending: "Pending",
  in_review: "In Review",
  hold: "On Hold",
  delivered: "Delivered",
  partial_delivered: "Partial Delivered",
  cancelled: "Cancelled",
  delivered_approval_pending: "Delivered (Approval Pending)",
  partial_delivered_approval_pending: "Partial (Approval Pending)",
  cancelled_approval_pending: "Cancelled (Approval Pending)",
  unknown_approval_pending: "Unknown (Approval Pending)",
  unknown: "Unknown",
};

export const COURIER_STATUS_PILL = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  in_review: "bg-amber-50 text-amber-700 border-amber-200",
  hold: "bg-orange-50 text-orange-700 border-orange-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partial_delivered: "bg-sky-50 text-sky-700 border-sky-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  delivered_approval_pending: "bg-indigo-50 text-indigo-700 border-indigo-200",
  partial_delivered_approval_pending:
    "bg-indigo-50 text-indigo-700 border-indigo-200",
  cancelled_approval_pending: "bg-indigo-50 text-indigo-700 border-indigo-200",
  unknown_approval_pending: "bg-slate-50 text-slate-600 border-slate-200",
  unknown: "bg-slate-50 text-slate-600 border-slate-200",
};

export function courierStatusLabel(status) {
  if (!status) return "Not sent";
  return COURIER_STATUS_LABELS[status] || String(status).replace(/_/g, " ");
}

export function courierTrackingUrl(code) {
  if (!code) return null;
  return `https://steadfast.com.bd/t/${encodeURIComponent(code)}`;
}

export function normalizeSteadfastPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("880")) digits = `0${digits.slice(3)}`;
  if (digits.length === 10 && digits.startsWith("1")) digits = `0${digits}`;
  return digits.slice(0, 11);
}

export function maskSecret(value) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 4) return "••••";
  return `••••${text.slice(-4)}`;
}

export function resolveSteadfastCredentials(settings) {
  const apiKey = settings?.api_key || process.env.STEADFAST_API_KEY || "";
  const secretKey =
    settings?.secret_key || process.env.STEADFAST_SECRET_KEY || "";
  const baseUrl =
    process.env.STEADFAST_BASE_URL || DEFAULT_BASE_URL;
  const enabled = settings
    ? Boolean(settings.is_enabled)
    : Boolean(apiKey && secretKey);

  return {
    apiKey,
    secretKey,
    baseUrl: String(baseUrl).replace(/\/$/, ""),
    enabled,
    defaultDeliveryType: Number(settings?.default_delivery_type || 0) === 1 ? 1 : 0,
    configured: Boolean(apiKey && secretKey),
  };
}

async function steadfastRequest(path, { method = "GET", body, credentials }) {
  const res = await fetch(`${credentials.baseUrl}${path}`, {
    method,
    headers: {
      "Api-Key": credentials.apiKey,
      "Secret-Key": credentials.secretKey,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const message =
      data?.message ||
      data?.error ||
      (typeof data?.raw === "string" ? data.raw : null) ||
      `Steadfast request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data;
}

export async function createSteadfastOrder(payload, credentials) {
  return steadfastRequest("/create_order", {
    method: "POST",
    body: payload,
    credentials,
  });
}

export async function createSteadfastBulkOrders(orders, credentials) {
  return steadfastRequest("/create_order/bulk-order", {
    method: "POST",
    body: { data: JSON.stringify(orders) },
    credentials,
  });
}

export async function getSteadfastStatusByCid(id, credentials) {
  return steadfastRequest(`/status_by_cid/${id}`, { credentials });
}

export async function getSteadfastStatusByInvoice(invoice, credentials) {
  return steadfastRequest(
    `/status_by_invoice/${encodeURIComponent(invoice)}`,
    { credentials },
  );
}

export async function getSteadfastBalance(credentials) {
  return steadfastRequest("/get_balance", { credentials });
}

export async function createSteadfastReturn(payload, credentials) {
  return steadfastRequest("/create_return_request", {
    method: "POST",
    body: payload,
    credentials,
  });
}

export async function getSteadfastReturn(id, credentials) {
  return steadfastRequest(`/get_return_request/${id}`, { credentials });
}

export async function getSteadfastReturns(credentials) {
  return steadfastRequest("/get_return_requests", { credentials });
}

export async function getSteadfastPayments(credentials) {
  return steadfastRequest("/payments", { credentials });
}

export async function getSteadfastPayment(id, credentials) {
  return steadfastRequest(`/payments/${id}`, { credentials });
}

export function buildParcelPayload({
  order,
  items = [],
  overrides = {},
  defaultDeliveryType = 0,
}) {
  const name = String(
    overrides.recipient_name ?? order.customer_name ?? "",
  ).trim().slice(0, 100);
  const phone = normalizeSteadfastPhone(
    overrides.recipient_phone ?? order.phone,
  );
  const alternative = normalizeSteadfastPhone(overrides.alternative_phone);
  const email = String(overrides.recipient_email ?? order.email ?? "").trim();
  const address = String(
    overrides.recipient_address ?? order.address ?? "",
  ).trim().slice(0, 250);
  const note = String(overrides.note ?? order.notes ?? "").trim();
  const cod = Number(overrides.cod_amount ?? order.total_amount ?? 0);
  const deliveryType =
    Number(overrides.delivery_type ?? defaultDeliveryType) === 1 ? 1 : 0;

  const itemDescription = (items || [])
    .map((item) => {
      const variant = item.variant_text ? ` (${item.variant_text})` : "";
      return `${item.product_name}${variant} x ${item.quantity}`;
    })
    .join(", ")
    .slice(0, 500);

  const totalLot = (items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );

  return {
    invoice: String(overrides.invoice || order.tracking_code || order.id),
    recipient_name: name,
    recipient_phone: phone,
    alternative_phone: alternative || undefined,
    recipient_email: email || undefined,
    recipient_address: address,
    cod_amount: Number.isFinite(cod) ? Math.max(0, cod) : 0,
    note: note || undefined,
    item_description: itemDescription || undefined,
    total_lot: totalLot || undefined,
    delivery_type: deliveryType,
  };
}

export function validateParcelPayload(payload) {
  if (!payload.invoice) return "Order invoice / tracking code is missing.";
  if (!payload.recipient_name) return "Recipient name is required.";
  if (!/^\d{11}$/.test(payload.recipient_phone)) {
    return "Recipient phone must be an 11-digit number.";
  }
  if (
    payload.alternative_phone &&
    !/^\d{11}$/.test(payload.alternative_phone)
  ) {
    return "Alternative phone must be an 11-digit number.";
  }
  if (!payload.recipient_address) return "Recipient address is required.";
  if (payload.cod_amount < 0) return "COD amount cannot be less than 0.";
  return null;
}
