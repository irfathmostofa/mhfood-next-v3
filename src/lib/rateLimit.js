const buckets = new Map();

export function clientIp(req) {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  let entry = buckets.get(key);
  if (!entry || now - entry.start >= windowMs) {
    entry = { start: now, count: 0 };
    buckets.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > limit) {
    const retryAfter = Math.max(
      1,
      Math.ceil((entry.start + windowMs - now) / 1000),
    );
    return { ok: false, retryAfter };
  }
  return { ok: true };
}

export function tooManyRequests(retryAfter = 60) {
  return new Response(
    JSON.stringify({ error: "Too many requests. Try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    },
  );
}
