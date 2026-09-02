export function slugifySession(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function computeSalePrice(basePrice, discountType, discountValue) {
  const base = Number(basePrice) || 0;
  const value = Number(discountValue) || 0;
  if (base <= 0 || value <= 0) return roundMoney(base);
  if (discountType === "fixed") {
    return roundMoney(Math.max(0, base - value));
  }
  const pct = Math.min(100, value);
  return roundMoney(base * (1 - pct / 100));
}

export function salePercent(basePrice, salePrice) {
  const base = Number(basePrice) || 0;
  const sale = Number(salePrice) || 0;
  if (base <= 0 || sale >= base) return 0;
  return Math.round(((base - sale) / base) * 100);
}

export function isSessionLive(session, now = new Date()) {
  if (!session?.is_active) return false;
  const start = new Date(session.starts_at);
  const end = new Date(session.ends_at);
  return now >= start && now <= end;
}

export function sessionStatus(session, now = new Date()) {
  if (!session) return "inactive";
  const start = new Date(session.starts_at);
  const end = new Date(session.ends_at);
  if (now > end) return "ended";
  if (!session.is_active) return "inactive";
  if (now < start) return "upcoming";
  return "live";
}

export function applySaleToProduct(product, item) {
  if (!product || !item) return product;
  const selling = Number(product.price) || 0;
  const listed = Number(product.regular_price) || 0;
  const salePrice = computeSalePrice(
    selling,
    item.discount_type,
    item.discount_value,
  );
  const compareAt = Math.max(listed, selling);
  return {
    ...product,
    price: salePrice,
    regular_price: compareAt > salePrice ? compareAt : listed,
    sale_price: salePrice,
    original_price: selling,
    sale_discount_type: item.discount_type,
    sale_discount_value: Number(item.discount_value) || 0,
    sale_session_id: item.session_id,
    sale_session_name: item.session_name || "",
    sale_session_slug: item.session_slug || "",
  };
}

export function buildSaleMap(sessions = []) {
  const map = {};
  for (const session of sessions) {
    const items = session.discount_session_products || session.items || [];
    for (const item of items) {
      if (map[item.product_id]) continue;
      map[item.product_id] = {
        ...item,
        session_id: session.id,
        session_name: session.name,
        session_slug: session.slug,
      };
    }
  }
  return map;
}

export function withSalePrices(products, saleMap) {
  if (!saleMap || Object.keys(saleMap).length === 0) return products || [];
  return (products || []).map((p) => {
    const item = saleMap[p.id];
    return item ? applySaleToProduct(p, item) : p;
  });
}
