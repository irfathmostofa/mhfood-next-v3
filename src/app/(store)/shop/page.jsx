import { Suspense } from "react";
import { getSeoSettings, getCategories, getTheme } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import { getProductsWithRatings } from "@/lib/products";
import ShopClient from "@/components/ShopClient";

export async function generateMetadata() {
  const [seo, theme] = await Promise.all([getSeoSettings(), getTheme()]);
  return buildMetadata({ seo, theme, path: "/shop" });
}

export default async function ShopPage({ searchParams }) {
  const params = await searchParams;
  const query = (params?.q || "").trim();
  const category = params?.category || "all";
  const sort = params?.sort || "newest";
  const min = params?.min || "";
  const max = params?.max || "";
  const inStockOnly = params?.instock === "1";

  const [categories, { products }] = await Promise.all([
    getCategories(),
    getProductsWithRatings({
      categoryId: category !== "all" ? category : undefined,
      query,
      minPrice: min,
      maxPrice: max,
      inStockOnly,
      sort,
    }),
  ]);

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
      <ShopClient categories={categories} products={sortedProducts} />
    </Suspense>
  );
}
