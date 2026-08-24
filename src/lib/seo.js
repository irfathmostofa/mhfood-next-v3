import { DEFAULT_SEO, DEFAULT_THEME } from "./site";

export function buildMetadata({
  seo,
  theme,
  title,
  description,
  keywords,
  image,
  path,
}) {
  const s = seo || DEFAULT_SEO;
  const t = theme || DEFAULT_THEME;
  const finalTitle = title
    ? `${title} | ${s.site_name || s.site_title || "Store"}`
    : s.home_title || s.site_name || "Store";
  const finalDescription = description || s.home_description || "";
  const finalKeywords = keywords || s.home_keywords || "";
  const logo = t.logo_image || "/mhfood.png";

  return {
    title: finalTitle,
    description: finalDescription,
    keywords: finalKeywords,
    icons: {
      icon: logo,
      apple: logo,
    },
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
