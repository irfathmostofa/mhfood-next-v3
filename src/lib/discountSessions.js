import { unstable_cache } from "next/cache";
import { supabase } from "./supabase";
import {
  applySaleToProduct,
  buildSaleMap,
  withSalePrices,
} from "./salePricing";

export {
  slugifySession,
  roundMoney,
  computeSalePrice,
  salePercent,
  isSessionLive,
  sessionStatus,
  applySaleToProduct,
  buildSaleMap,
  withSalePrices,
} from "./salePricing";

const SALE_TTL = 15;

async function fetchLiveDiscountSessions() {
  const now = new Date().toISOString();
  try {
    const { data, error } = await supabase
      .from("discount_sessions")
      .select(
        "id, name, slug, subtitle, style, starts_at, ends_at, is_active, discount_session_products(id, product_id, discount_type, discount_value, sort_order)",
      )
      .eq("is_active", true)
      .lte("starts_at", now)
      .gte("ends_at", now)
      .order("created_at", { ascending: false });
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export const getLiveDiscountSessions = unstable_cache(
  fetchLiveDiscountSessions,
  ["live-discount-sessions"],
  { revalidate: SALE_TTL },
);

export async function getSaleMap() {
  const sessions = await getLiveDiscountSessions();
  return buildSaleMap(sessions);
}

export async function decorateProductsWithSale(products) {
  if (!products || products.length === 0) return products || [];
  const map = await getSaleMap();
  return withSalePrices(products, map);
}

export async function decorateProductWithSale(product) {
  if (!product) return product;
  const [decorated] = await decorateProductsWithSale([product]);
  return decorated;
}

async function fetchDiscountSessionBySlug(slug) {
  if (!slug) return null;
  try {
    const { data, error } = await supabase
      .from("discount_sessions")
      .select(
        "id, name, slug, subtitle, style, starts_at, ends_at, is_active, discount_session_products(id, product_id, discount_type, discount_value, sort_order)",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export const getDiscountSessionBySlug = unstable_cache(
  fetchDiscountSessionBySlug,
  ["discount-session-by-slug"],
  { revalidate: SALE_TTL },
);

export async function getLiveSaleUnitPrices(productIds, now = new Date()) {
  if (!productIds || productIds.length === 0) return {};
  const iso = now.toISOString();
  const { data: sessions } = await supabase
    .from("discount_sessions")
    .select(
      "id, name, slug, starts_at, ends_at, is_active, discount_session_products(product_id, discount_type, discount_value)",
    )
    .eq("is_active", true)
    .lte("starts_at", iso)
    .gte("ends_at", iso)
    .order("created_at", { ascending: false });

  const map = buildSaleMap(sessions || []);
  const out = {};
  for (const id of productIds) {
    if (map[id]) out[id] = map[id];
  }
  return out;
}

async function loadProductsByIds(ids) {
  if (!ids.length) return {};
  const { data: prods } = await supabase
    .from("products")
    .select(
      "*, product_images(id, image_url, sort_order), categories(name, slug)",
    )
    .eq("is_active", true)
    .in("id", ids);

  const { data: ratings } = await supabase
    .from("product_ratings")
    .select("*")
    .in("product_id", ids);

  const ratingMap = Object.fromEntries(
    (ratings || []).map((r) => [r.product_id, r]),
  );

  return Object.fromEntries(
    (prods || []).map((p) => [
      p.id,
      {
        ...p,
        product_images: [...(p.product_images || [])].sort(
          (a, b) => a.sort_order - b.sort_order,
        ),
        avg_rating: ratingMap[p.id]?.avg_rating || 0,
        review_count: ratingMap[p.id]?.review_count || 0,
      },
    ]),
  );
}

function attachSessionProducts(session, productMap, limit) {
  const items = [...(session.discount_session_products || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
  );
  const products = items
    .map((item) => {
      const product = productMap[item.product_id];
      if (!product) return null;
      return applySaleToProduct(product, {
        ...item,
        session_id: session.id,
        session_name: session.name,
        session_slug: session.slug,
      });
    })
    .filter(Boolean)
    .slice(0, limit);
  return { ...session, products };
}

export async function getLiveSessionsWithProducts(limitPerSession = 12) {
  const sessions = await getLiveDiscountSessions();
  if (!sessions.length) return [];

  const ids = [
    ...new Set(
      sessions.flatMap((s) =>
        (s.discount_session_products || []).map((i) => i.product_id),
      ),
    ),
  ];
  const productMap = await loadProductsByIds(ids);
  return sessions.map((session) =>
    attachSessionProducts(session, productMap, limitPerSession),
  );
}

export async function getSessionWithProducts(session, limit = 48) {
  if (!session) return null;
  const ids = (session.discount_session_products || []).map(
    (i) => i.product_id,
  );
  const productMap = await loadProductsByIds(ids);
  return attachSessionProducts(session, productMap, limit);
}
