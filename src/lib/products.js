import { unstable_cache } from "next/cache";
import { supabase } from "./supabase";

const PRODUCTS_TTL = 30;

async function fetchProductsWithRatings({
  categoryId,
  ids,
  query,
  minPrice,
  maxPrice,
  inStockOnly,
  sort,
  limit,
  featuredOnly,
  excludeId,
}) {
  let q = supabase
    .from("products")
    .select("*, product_images(id, image_url, sort_order), categories(name)")
    .eq("is_active", true);

  if (categoryId && categoryId !== "all") q = q.eq("category_id", categoryId);
  if (featuredOnly) q = q.eq("is_featured", true);
  if (ids && ids.length > 0) q = q.in("id", ids);
  if (excludeId) q = q.neq("id", excludeId);
  if (query && query.trim()) q = q.ilike("name", `%${query.trim()}%`);
  if (minPrice) q = q.gte("price", Number(minPrice));
  if (maxPrice) q = q.lte("price", Number(maxPrice));
  if (inStockOnly) q = q.gt("stock", 0);

  if (sort === "price_asc") q = q.order("price", { ascending: true });
  else if (sort === "price_desc") q = q.order("price", { ascending: false });
  else q = q.order("created_at", { ascending: false });

  if (limit) q = q.limit(limit);

  const { data: prods, error } = await q;
  if (error || !prods || prods.length === 0) return { products: [], error };

  const idList = prods.map((p) => p.id);
  const { data: ratings } = await supabase
    .from("product_ratings")
    .select("*")
    .in("product_id", idList);

  const ratingMap = Object.fromEntries(
    (ratings || []).map((r) => [r.product_id, r]),
  );

  const products = prods.map((p) => ({
    ...p,
    product_images: [...(p.product_images || [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
    avg_rating: ratingMap[p.id]?.avg_rating || 0,
    review_count: ratingMap[p.id]?.review_count || 0,
  }));

  return { products, error };
}

export const getProductsWithRatings = unstable_cache(
  fetchProductsWithRatings,
  ["products-with-ratings"],
  { revalidate: PRODUCTS_TTL },
);

async function fetchBestsellers(limit = 12) {
  const { data: counts } = await supabase
    .from("product_order_counts")
    .select("product_id, total_sold")
    .order("total_sold", { ascending: false })
    .limit(limit);

  if (!counts || counts.length === 0) return [];

  const soldIds = counts.map((c) => c.product_id);
  const soldMap = Object.fromEntries(
    counts.map((c) => [c.product_id, Number(c.total_sold) || 0]),
  );

  const { products } = await getProductsWithRatings({ ids: soldIds });
  return products.sort((a, b) => (soldMap[b.id] || 0) - (soldMap[a.id] || 0));
}

export const getBestsellers = unstable_cache(
  fetchBestsellers,
  ["bestsellers"],
  {
    revalidate: PRODUCTS_TTL,
  },
);

async function fetchProductBySlug(slug) {
  const { data: product, error } = await supabase
    .from("products")
    .select("*, categories(name), product_images(id, image_url, sort_order)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !product) return null;

  const productId = product.id;

  const [
    { data: rating },
    { data: reviewRows },
    { data: countRow },
    { data: variantRows },
  ] = await Promise.all([
    supabase
      .from("product_ratings")
      .select("*")
      .eq("product_id", productId)
      .maybeSingle(),
    supabase
      .from("reviews")
      .select("*")
      .eq("product_id", productId)
      .eq("approved", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_order_counts")
      .select("*")
      .eq("product_id", productId)
      .maybeSingle(),
    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  return {
    ...product,
    product_images: [...(product.product_images || [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
    avg_rating: rating?.avg_rating || 0,
    review_count: rating?.review_count || 0,
    total_sold: countRow?.total_sold || 0,
    variants: variantRows || [],
    reviews: reviewRows || [],
  };
}

export const getProductBySlug = unstable_cache(
  fetchProductBySlug,
  ["product-by-slug"],
  { revalidate: PRODUCTS_TTL },
);

async function fetchProductMeta(slug) {
  const { data: product, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, description, category_id, categories(name), product_images(id, image_url, sort_order)",
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !product) return null;

  return {
    ...product,
    product_images: [...(product.product_images || [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  };
}

export const getProductMeta = unstable_cache(
  fetchProductMeta,
  ["product-meta"],
  {
    revalidate: PRODUCTS_TTL,
  },
);
