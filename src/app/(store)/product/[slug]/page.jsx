import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/products";
import { getSeoSettings, getSiteSettings } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import { getProductsWithRatings } from "@/lib/products";
import { stripHtml } from "@/lib/richtext";
import ProductView from "@/components/ProductView";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [product, seo] = await Promise.all([
    getProductBySlug(slug),
    getSeoSettings(),
  ]);

  if (!product) return {};

  return buildMetadata({
    seo,
    title: product.name,
    description: stripHtml(product.description).slice(0, 160),
    keywords: `${product.name}, ${product.categories?.name || ""}, ${seo.home_keywords}`,
    image: product.product_images?.[0]?.image_url,
    path: `/product/${slug}`,
  });
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const [siteSettings, { products: relatedProducts }] = await Promise.all([
    getSiteSettings(),
    product.category_id
      ? getProductsWithRatings({
          categoryId: product.category_id,
          excludeId: product.id,
          limit: 4,
        })
      : { products: [] },
  ]);

  return (
    <div className="max-w-[97%] mx-auto px-5 py-8">
      <ProductView
        product={product}
        siteSettings={siteSettings}
        relatedProducts={relatedProducts}
      />
    </div>
  );
}
