// ---- Server-side email delivery via the EmailJS REST API ----
// Used from API routes / server actions so keys never reach the browser.

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
const PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY; // server-only, never NEXT_PUBLIC_
const TEMPLATE_CONFIRM = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_CONFIRM;
const TEMPLATE_DELIVERED = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_DELIVERED;
// Optional dedicated template; falls back to the order-confirm template.
const TEMPLATE_CUSTOM =
  process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_CUSTOM || TEMPLATE_CONFIRM;
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Admin";

function formatItems(items) {
  return (items || [])
    .map(
      (i) =>
        `${i.product_name}${i.variant_text ? ` (${i.variant_text})` : ""} x${
          i.quantity
        } - ৳${i.price}`,
    )
    .join("\n");
}

function stringifyParams(params) {
  const out = {};
  for (const [key, value] of Object.entries(params || {})) {
    out[key] = value == null ? "" : String(value);
  }
  return out;
}

async function sendEmail({ templateId, toEmail, params }) {
  if (!SERVICE_ID || !PUBLIC_KEY || !templateId) {
    throw new Error(
      "EmailJS is not configured. Check NEXT_PUBLIC_EMAILJS_SERVICE_ID, " +
        "NEXT_PUBLIC_EMAILJS_PUBLIC_KEY, and the template id env vars.",
    );
  }
  if (!toEmail) {
    throw new Error("A recipient email is required.");
  }

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: SERVICE_ID,
      template_id: templateId,
      user_id: PUBLIC_KEY,
      // Required once "strict mode" / private key auth is on in EmailJS.
      // Also needed for server-side (non-browser) calls in some account
      // configurations. Safe to omit if EMAILJS_PRIVATE_KEY isn't set.
      ...(PRIVATE_KEY ? { accessToken: PRIVATE_KEY } : {}),
      template_params: stringifyParams({
        from_name: SITE_NAME,
        to_email: toEmail,
        ...params,
      }),
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(
        `EmailJS blocked this request (403): ${text}. This almost always means ` +
          `"Allow EmailJS API for non-browser applications" is disabled — enable it ` +
          `in the EmailJS dashboard under Account -> Security.`,
      );
    }
    throw new Error(`EmailJS error (${res.status}): ${text}`);
  }

  return text;
}

export async function sendOrderPlacedEmails({
  toEmail,
  customerName,
  phone,
  address,
  trackingCode,
  items,
  delivery,
  totalAmount,
  origin,
}) {
  const baseOrigin =
    origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const trackingLink = `${baseOrigin}/track/${trackingCode}`;

  const base = {
    customer_name: customerName,
    phone,
    address,
    tracking_code: trackingCode,
    tracking_link: trackingLink,
    order_items: formatItems(items),
    delivery,
    total_amount: totalAmount,
  };

  const results = await Promise.allSettled([
    sendEmail({
      templateId: TEMPLATE_CONFIRM,
      toEmail,
      params: {
        ...base,
        heading: `Thank you for your order, ${customerName}!`,
        intro_text: "We've received your order and it's now being processed.",
        button_text: "Track Your Order",
        footer_text:
          "If you have any questions about your order, just reply to this email.",
      },
    }),
    sendEmail({
      templateId: TEMPLATE_CONFIRM,
      toEmail: ADMIN_EMAIL,
      params: {
        ...base,
        heading: "New Order Received",
        intro_text: "A new order just came in. Details below:",
        button_text: "View Order",
        footer_text: "Open the admin panel to confirm and process this order.",
      },
    }),
  ]);

  // Surface individual failures instead of only relying on the caller's
  // top-level .catch() (which only sees a rejected outer promise, never
  // reached here since Promise.allSettled always resolves).
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const label = i === 0 ? "customer confirmation" : "admin notification";
      console.error(
        `Order placed email (${label}) failed:`,
        result.reason?.message || result.reason,
      );
    }
  });

  return results;
}

export async function sendOrderDeliveredEmail({
  toEmail,
  customerName,
  trackingCode,
  delivery,
  orderId,
  items,
  origin,
}) {
  const baseOrigin =
    origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const reviewLink = `${baseOrigin}/review/${orderId}`;

  return sendEmail({
    templateId: TEMPLATE_DELIVERED,
    toEmail,
    params: {
      customer_name: customerName,
      tracking_code: trackingCode,
      delivery,
      review_link: reviewLink,
      order_items: formatItems(items),
    },
  });
}

export async function sendCustomOrderAdminEmail({
  code,
  customerName,
  phone,
  email,
  message,
  fileName,
  fileSize,
  driveUrl,
  origin,
}) {
  const baseOrigin =
    origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const adminLink = `${baseOrigin}/admin/custom-orders`;

  const attachmentLines = [
    fileName
      ? `File: ${fileName}${fileSize ? ` (${Math.round(fileSize / 1024)} KB)` : ""} — open it in the admin panel`
      : "",
    driveUrl ? `Google Drive: ${driveUrl}` : "",
  ].filter(Boolean);
  const attachments = attachmentLines.length
    ? attachmentLines.join("\n")
    : "No attachment";

  return sendEmail({
    templateId: TEMPLATE_CUSTOM,
    toEmail: ADMIN_EMAIL,
    params: {
      // Fields the existing confirm template already understands
      heading: "New Custom Order Request",
      intro_text: `${customerName} sent a custom order request (${code}).`,
      customer_name: customerName,
      phone,
      address: email || "No email provided",
      tracking_code: code,
      tracking_link: adminLink,
      order_items: `${message}\n\n${attachments}`,
      delivery: attachments,
      total_amount: "Quote pending",
      button_text: "Open in Admin",
      footer_text: "Open Admin > Custom Orders to review and reply.",
      // Extra fields for a dedicated template (optional)
      customer_email: email || "",
      message,
      file_name: fileName || "",
      drive_url: driveUrl || "",
    },
  });
}
