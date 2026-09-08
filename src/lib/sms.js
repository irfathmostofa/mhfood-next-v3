import { createAdminClient } from "@/lib/admin";
import { supabase } from "@/lib/supabase";
import { maskSecret } from "@/lib/steadfast";

const SMS_API_URL = "https://bulksmsbd.net/api/smsapi";
const SMS_MANY_URL = "https://bulksmsbd.net/api/smsapimany";

const ERROR_CODES = {
  1002: "Sender ID is not correct or is disabled.",
  1003: "Missing required SMS fields.",
  1005: "BulkSMSBD internal error.",
  1006: "SMS balance validity is not available.",
  1007: "Insufficient SMS balance.",
  1011: "BulkSMSBD user id not found.",
  1012: "Masking SMS must be sent in Bengali.",
  1013: "Sender ID gateway was not found for this API key.",
  1014: "Sender type name not found for this sender ID.",
  1015: "Sender ID has no valid gateway.",
  1016: "Sender type price info is missing.",
  1017: "Sender type price info is missing.",
  1018: "The BulkSMSBD account is disabled.",
  1019: "The sender type price for this account is disabled.",
  1020: "The parent of this BulkSMSBD account was not found.",
  1021: "The parent sender price for this account was not found.",
};

export function normalizeBdNumber(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `88${digits}`;
  if (digits.length === 10 && digits.startsWith("1")) return `880${digits}`;
  return `880${digits}`;
}

export function resolveSmsCredentials(settings) {
  const apiKey = settings?.api_key || process.env.BULKSMSBD_API_KEY || "";
  const senderId = settings?.sender_id || process.env.BULKSMSBD_SENDER_ID || "";
  const enabled = settings
    ? Boolean(settings.is_enabled)
    : Boolean(apiKey && senderId);

  return {
    apiKey,
    senderId,
    enabled,
    configured: Boolean(apiKey && senderId),
  };
}

export function publicSmsSettings(row) {
  const credentials = resolveSmsCredentials(row);
  return {
    id: row?.id || 1,
    provider: row?.provider || "bulksmsbd",
    is_enabled: Boolean(row?.is_enabled),
    sender_id: row?.sender_id || "",
    api_key_masked: maskSecret(row?.api_key),
    has_api_key: Boolean(row?.api_key),
    has_sender_id: Boolean(row?.sender_id),
    env_configured: Boolean(
      process.env.BULKSMSBD_API_KEY && process.env.BULKSMSBD_SENDER_ID,
    ),
    configured: credentials.configured,
    updated_at: row?.updated_at || null,
  };
}

async function readSmsSettingsRow() {
  const { data, error } = await supabase
    .from("sms_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (!error && data) return data;

  try {
    const admin = await createAdminClient();
    const { data: adminData, error: adminError } = await admin
      .from("sms_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (!adminError && adminData) return adminData;
  } catch {
    // Guest checkout has no admin session.
  }

  return data || null;
}

export async function loadSmsCredentials() {
  const settings = await readSmsSettingsRow();
  const credentials = resolveSmsCredentials(settings);
  if (!credentials.configured) {
    const err = new Error(
      "SMS is not configured. Add the BulkSMSBD API key and Sender ID in Settings > SMS.",
    );
    err.status = 400;
    throw err;
  }
  if (!credentials.enabled) {
    const err = new Error("SMS is disabled. Enable it in Settings > SMS.");
    err.status = 400;
    throw err;
  }
  return credentials;
}

function parseSmsResponse(text) {
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  const code = Number(
    data?.response_code ??
      data?.code ??
      (data == null && /^\d+$/.test(String(text).trim()) ? text.trim() : NaN),
  );

  if (code === 202 || data?.success_message) {
    return { ok: true, code: code || 202, raw: text, data };
  }

  const message =
    data?.error_message ||
    ERROR_CODES[code] ||
    (text && !data ? text : null) ||
    "SMS could not be sent.";

  const err = new Error(message);
  err.code = code || null;
  err.payload = data || text;
  throw err;
}

async function postForm(url, fields, credentials) {
  const body = new URLSearchParams({
    api_key: credentials.apiKey,
    senderid: credentials.senderId,
    ...fields,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`SMS error (${res.status}): ${text}`);
  return parseSmsResponse(text);
}

async function sendSMSRequest({ numbers, message }) {
  const unique = [...new Set((numbers || []).filter(Boolean))];
  if (unique.length === 0) throw new Error("No valid phone numbers.");
  if (!message?.trim()) throw new Error("SMS message is required.");
  const credentials = await loadSmsCredentials();
  return postForm(
    SMS_API_URL,
    {
      number: unique.join(","),
      message: message.trim(),
    },
    credentials,
  );
}

export async function sendOrderPlacedSMS({
  phone,
  customerName,
  trackingCode,
  origin,
}) {
  const number = normalizeBdNumber(phone);
  const base = String(origin || process.env.NEXT_PUBLIC_SITE_URL || "").replace(
    /\/$/,
    "",
  );
  const track = base ? `${base}/track/${trackingCode}` : `code ${trackingCode}`;
  const message = `Hi ${customerName}, your order is placed. Tracking: ${trackingCode}. Track: ${track}`;
  return sendSMSRequest({ numbers: [number], message });
}

export async function sendOrderDeliveredSMS({
  phone,
  customerName,
  trackingCode,
}) {
  const number = normalizeBdNumber(phone);
  const message = `Hi ${customerName}, your order (${trackingCode}) has been delivered. Thank you for shopping with us.`;
  return sendSMSRequest({ numbers: [number], message });
}

export async function sendBulkSMS({ phones, message }) {
  const numbers = [...new Set((phones || []).map(normalizeBdNumber))].filter(
    Boolean,
  );
  if (numbers.length === 0) throw new Error("No valid phone numbers.");
  return sendSMSRequest({ numbers, message });
}

export async function sendManySMS(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("No SMS messages to send.");
  }
  const credentials = await loadSmsCredentials();
  return postForm(
    SMS_MANY_URL,
    {
      messages: JSON.stringify(
        messages.map((row) => ({
          to: normalizeBdNumber(row.to || row.phone),
          message: String(row.message || "").trim(),
        })),
      ),
    },
    credentials,
  );
}
