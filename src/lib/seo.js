import { DEFAULT_SEO, DEFAULT_THEME } from "./defaults";

const FALLBACK_ORIGIN = "http://localhost:3000";

export function getSiteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || FALLBACK_ORIGIN
  );
}

export function buildMetadata({
  seo,
  theme,
  title,
  description,
  keywords,
  image,
  path,
  noIndex = false,
}) {
  const s = seo || DEFAULT_SEO;
  const t = theme || DEFAULT_THEME;
  const origin = getSiteOrigin();
  const siteName = s.site_name || s.site_title || "Store";
  const finalTitle = title
    ? `${title} | ${siteName}`
    : s.home_title || siteName;
  const finalDescription = description || s.home_description || "";
  const finalKeywords = keywords || s.home_keywords || "";
  const logo = t.logo_image || "/mhfood.png";
  const normalizedPath = !path || path === "/" ? "" : path;
  const canonical = `${origin}${normalizedPath}`;
  const ogImage = image || s.og_image || logo;
  const ogImages = ogImage ? [{ url: ogImage, alt: finalTitle }] : undefined;

  return {
    metadataBase: new URL(origin),
    title: finalTitle,
    description: finalDescription,
    keywords: finalKeywords,
    applicationName: siteName,
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    alternates: {
      canonical,
    },
    icons: {
      icon: logo,
      apple: logo,
    },
    openGraph: {
      title: finalTitle,
      description: finalDescription,
      url: canonical,
      siteName,
      images: ogImages,
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: finalTitle,
      description: finalDescription,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export function productJsonLd(product, origin) {
  if (!product) return null;
  const siteOrigin = origin || getSiteOrigin();
  const image = product.product_images?.[0]?.image_url;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: stripPlain(product.description),
    image: image ? [image] : undefined,
    sku: product.sku || product.id,
    url: `${siteOrigin}/product/${product.slug}`,
    brand: {
      "@type": "Brand",
      name: product.store_name || "Store",
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "BDT",
      price: Number(product.price) || 0,
      availability:
        Number(product.stock) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: `${siteOrigin}/product/${product.slug}`,
    },
    aggregateRating:
      Number(product.review_count) > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: Number(product.avg_rating) || 0,
            reviewCount: Number(product.review_count) || 0,
          }
        : undefined,
  };
}

function stripPlain(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}
