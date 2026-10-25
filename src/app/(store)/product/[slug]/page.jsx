import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProductBySlug,
  getProductReviews,
  getProductsWithRatings,
} from "@/lib/products";
import { getSeoSettings, getTheme, getCategories } from "@/lib/site";
import { buildMetadata, productJsonLd, getSiteOrigin } from "@/lib/seo";
import { stripHtml, toHtml } from "@/lib/richtext";
import ProductView from "@/components/ProductView";
import ProductCard from "@/components/ProductCard";

export const revalidate = 30;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [product, seo, theme] = await Promise.all([
    getProductBySlug(slug),
    getSeoSettings(),
    getTheme(),
  ]);

  if (!product) return {};

  return buildMetadata({
    seo,
    theme,
    title: product.name,
    description: stripHtml(product.description).slice(0, 160),
    keywords: `${product.name}, ${product.categories?.name || ""}, ${seo.home_keywords}`,
    image: product.product_images?.[0]?.image_url,
    path: `/product/${slug}`,
  });
}

async function ProductRelatedSection({ product }) {
  const { products } = await getProductsWithRatings({
    categoryId: product.category_id,
    excludeId: product.id,
    limit: 4,
  });

  if (!products || products.length === 0) return null;

  return (
    <section className="mt-16 pt-8 border-t border-line">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl text-ink">Related Products</h2>
        <Link
          href={`/shop?category=${product.categories?.slug || product.category_id}`}
          className="text-sm text-accent hover:underline font-medium"
        >
          View All →
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3  sm:gap-6">
        {products.map((relatedProduct) => (
          <ProductCard key={relatedProduct.id} product={relatedProduct} />
        ))}
      </div>
    </section>
  );
}

function RelatedFallback() {
  return (
    <section className="mt-16 pt-8 border-t border-line">
      <div className="w-48 h-7 bg-primary/5 rounded-lg mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square bg-primary/5 rounded-2xl animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const [product, seo, categories] = await Promise.all([
    getProductBySlug(slug),
    getSeoSettings(),
    getCategories(),
  ]);

  if (!product) notFound();

  const structured = productJsonLd(
    { ...product, store_name: seo?.site_name },
    getSiteOrigin(),
  );

  const { description, ...viewProduct } = product;
  const reviews = await getProductReviews(product.id);

  return (
    <div className="max-w-[97%] mx-auto px-3 sm:px-5 lg:px-8 py-3 sm:py-4">
      {structured && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }}
        />
      )}
      <ProductView
        product={viewProduct}
        categories={categories}
        descriptionHtml={description ? toHtml(description) : ""}
        reviews={reviews}
      />
      <Suspense fallback={<RelatedFallback />}>
        <ProductRelatedSection product={product} />
      </Suspense>
    </div>
  );
}
