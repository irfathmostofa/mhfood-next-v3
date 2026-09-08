import { Suspense } from "react";
import { getSeoSettings, getCategories, getTheme } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import { getProductsWithRatings } from "@/lib/products";
import ShopClient from "@/components/ShopClient";

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const [seo, theme, categories] = await Promise.all([
    getSeoSettings(),
    getTheme(),
    getCategories(),
  ]);
  const categorySlug = params?.category || "";
  const activeCategory = categorySlug
    ? categories.find((c) => c.slug === categorySlug)
    : null;
  const query = (params?.q || "").trim();
  const title = query
    ? `Search “${query}”`
    : activeCategory
      ? activeCategory.name
      : "Shop";
  const description = activeCategory
    ? `Shop ${activeCategory.name} at ${seo?.site_name || "our store"}.`
    : seo?.home_description ||
      "Browse our full collection of fresh food and groceries.";

  return buildMetadata({
    seo,
    theme,
    title,
    description,
    path: "/shop",
  });
}

export default async function ShopPage({ searchParams }) {
  const params = await searchParams;
  const query = (params?.q || "").trim();
  const category = params?.category || "all";
  const sort = params?.sort || "newest";
  const min = params?.min || "";
  const max = params?.max || "";
  const inStockOnly = params?.instock === "1";

  const categories = await getCategories();

  // The category query param is now a slug. Resolve it to an id server-side.
  const activeCategory =
    category !== "all" ? categories.find((c) => c.slug === category) : null;

  const { products } = await getProductsWithRatings({
    categoryId:
      activeCategory?.id ||
      (category !== "all" ? "00000000-0000-0000-0000-000000000000" : undefined),
    query,
    minPrice: min,
    maxPrice: max,
    inStockOnly,
    sort,
  });

  const sortedProducts =
    sort === "rating"
      ? [...(products || [])].sort(
          (a, b) => Number(b.avg_rating) - Number(a.avg_rating),
        )
      : products || [];

  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-sm text-muted">
          Loading shop...
        </div>
      }
    >
      <ShopClient
        categories={categories}
        products={sortedProducts}
      />
    </Suspense>
  );
}
