// ---- Server-side email delivery via the EmailJS REST API ----
// Used from API routes / server actions so keys never reach the browser.

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
const TEMPLATE_CONFIRM = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_CONFIRM;
const TEMPLATE_DELIVERED = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_DELIVERED;
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

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

// EmailJS rejects any template param that is not a string (numbers,
// booleans and null all cause a 400 response), so every value we hand
// to a template is coerced to a string here.
function stringifyParams(params) {
  const out = {};
  for (const [key, value] of Object.entries(params || {})) {
    out[key] = value == null ? "" : String(value);
  }
  return out;
}

async function sendEmail({ templateId, toEmail, params }) {
  if (!SERVICE_ID || !PUBLIC_KEY || !templateId) {
    throw new Error("EmailJS is not configured.");
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
      template_params: stringifyParams({
        from_name: "MHFood",
        to_email: toEmail,
        ...params,
      }),
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`EmailJS error (${res.status}): ${text}`);
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
}) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const trackingLink = `${origin}/track/${trackingCode}`;

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
        footer_text:
          "Open the admin panel to confirm and process this order.",
      },
    }),
  ]);

  return results;
}

export async function sendOrderDeliveredEmail({
  toEmail,
  customerName,
  trackingCode,
  delivery,
  orderId,
  items,
}) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const reviewLink = `${origin}/review/${orderId}`;

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
