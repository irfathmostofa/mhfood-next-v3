// ---- Server-side SMS via BulkSMSBD ----
// Called from API routes only so the API key never reaches the browser.

const API_KEY = process.env.BULKSMSBD_API_KEY;
const SENDER_ID = process.env.BULKSMSBD_SENDER_ID;

// BulkSMSBD expects Bangladeshi numbers like 8801XXXXXXXXX (no +, no spaces)
export function normalizeBdNumber(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `88${digits}`;
  return `880${digits}`;
}

async function sendSMSRequest({ numbers, message }) {
  if (!API_KEY || !SENDER_ID) {
    throw new Error("SMS service is not configured.");
  }

  const params = new URLSearchParams({
    api_key: API_KEY,
    senderid: SENDER_ID,
    number: numbers.join(","),
    message,
  });

  const res = await fetch(`https://bulksmsbd.net/api/smsapi?${params}`, {
    method: "POST",
  });

  const result = await res.text();
  if (!res.ok) throw new Error(`SMS error (${res.status}): ${result}`);
  return result;
}

export async function sendOrderPlacedSMS({ phone, customerName, trackingCode }) {
  const number = normalizeBdNumber(phone);
  const message = `Hi ${customerName}, your order has been placed! Tracking code: ${trackingCode}. Track it anytime on our website.`;
  return sendSMSRequest({ numbers: [number], message });
}

export async function sendOrderDeliveredSMS({
  phone,
  customerName,
  trackingCode,
}) {
  const number = normalizeBdNumber(phone);
  const message = `Hi ${customerName}, your order (${trackingCode}) has been delivered! We'd love your feedback — check your email for the review link.`;
  return sendSMSRequest({ numbers: [number], message });
}

export async function sendBulkSMS({ phones, message }) {
  const numbers = [...new Set((phones || []).map(normalizeBdNumber))].filter(
    Boolean,
  );
  if (numbers.length === 0) throw new Error("No valid phone numbers.");
  return sendSMSRequest({ numbers, message });
}
