import { unstable_cache } from "next/cache";
import { supabase } from "./supabase";
import {
  decorateProductsWithSale,
  decorateProductWithSale,
} from "./discountSessions";

const PRODUCTS_TTL = 30;

const PRODUCT_CARD_SELECT =
  "id, name, slug, price, regular_price, stock, unit, category_id, brand_id, is_featured, created_at, product_images(id, image_url, sort_order), categories(name, slug), brands(name, slug)";

const PRODUCT_DETAIL_SELECT =
  "id, name, slug, description, short_description, price, regular_price, stock, unit, category_id, brand_id, categories(name, slug, parent_id), brands(name, slug), product_images(id, image_url, sort_order)";

function sortImages(images) {
  return [...(images || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
  );
}

function mapCardProduct(p) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    regular_price: p.regular_price,
    stock: p.stock,
    unit: p.unit,
    category_id: p.category_id,
    brand_id: p.brand_id,
    is_featured: p.is_featured,
    created_at: p.created_at,
    product_images: sortImages(p.product_images),
    categories: p.categories,
    brands: p.brands,
    avg_rating: 0,
    review_count: 0,
  };
}

async function fetchProductsWithRatings({
  categoryId,
  brandId,
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
    .select(PRODUCT_CARD_SELECT)
    .eq("is_active", true);

  if (categoryId && categoryId !== "all") q = q.eq("category_id", categoryId);
  if (brandId && brandId !== "all") q = q.eq("brand_id", brandId);
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
    .select("product_id, avg_rating, review_count")
    .in("product_id", idList);

  const ratingMap = Object.fromEntries(
    (ratings || []).map((r) => [r.product_id, r]),
  );

  const products = prods.map((p) => {
    const mapped = mapCardProduct(p);
    const rating = ratingMap[p.id];
    return {
      ...mapped,
      avg_rating: rating?.avg_rating || 0,
      review_count: rating?.review_count || 0,
    };
  });
  const withSale = await decorateProductsWithSale(products);
  return { products: withSale, error };
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
    .select(PRODUCT_DETAIL_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !product) return null;

  const productId = product.id;
  const [{ data: rating }, { data: countRow }, { data: variantRows }] =
    await Promise.all([
      supabase
        .from("product_ratings")
        .select("avg_rating, review_count")
        .eq("product_id", productId)
        .maybeSingle(),
      supabase
        .from("product_order_counts")
        .select("total_sold")
        .eq("product_id", productId)
        .maybeSingle(),
      supabase
        .from("product_variants")
        .select("id, name, value, price_adjustment, stock, sort_order")
        .eq("product_id", productId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

  const variants = variantRows || [];

  const decorated = await decorateProductWithSale({
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    short_description: product.short_description,
    price: product.price,
    regular_price: product.regular_price,
    stock: product.stock,
    unit: product.unit,
    category_id: product.category_id,
    brand_id: product.brand_id,
    categories: product.categories,
    brands: product.brands,
    product_images: sortImages(product.product_images),
    avg_rating: rating?.avg_rating || 0,
    review_count: rating?.review_count || 0,
    total_sold: countRow?.total_sold || 0,
    variants,
  });
  return decorated;
}

export const getProductBySlug = unstable_cache(
  fetchProductBySlug,
  ["product-by-slug"],
  { revalidate: PRODUCTS_TTL },
);

async function fetchProductReviews(productId, limit = 24) {
  if (!productId) return [];
  const { data } = await supabase
    .from("reviews")
    .select("id, customer_name, rating, comment, created_at")
    .eq("product_id", productId)
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

export const getProductReviews = unstable_cache(
  fetchProductReviews,
  ["product-reviews"],
  { revalidate: PRODUCTS_TTL },
);
