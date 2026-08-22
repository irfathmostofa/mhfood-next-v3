import { DEFAULT_SEO } from "./site";

export function buildMetadata({
  seo,
  title,
  description,
  keywords,
  image,
  path,
}) {
  const s = seo || DEFAULT_SEO;
  const finalTitle = title
    ? `${title} | ${s.site_name || s.site_title || "Store"}`
    : s.home_title || s.site_name || "Store";
  const finalDescription = description || s.home_description || "";
  const finalKeywords = keywords || s.home_keywords || "";

  return {
    title: finalTitle,
    description: finalDescription,
    keywords: finalKeywords,
    openGraph: {
      title: finalTitle,
      description: finalDescription,
      url: path,
      siteName: s.site_name || s.site_title || "Store",
      images: image
        ? [{ url: image }]
        : s.og_image
          ? [{ url: s.og_image }]
          : undefined,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: finalTitle,
      description: finalDescription,
      images: image ? [image] : s.og_image ? [s.og_image] : undefined,
    },
  };
}
