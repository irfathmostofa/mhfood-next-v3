import { getSiteOrigin } from "@/lib/seo";

export default function JsonLd({ seo, theme }) {
  const origin = getSiteOrigin();
  const siteName = seo?.site_name || theme?.store_name || "Store";
  const description = seo?.home_description || seo?.site_tagline || "";
  const logo = theme?.logo_image || `${origin}/mhfood.png`;

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: siteName,
        url: origin,
        logo,
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: siteName,
        url: origin,
        description,
        publisher: { "@id": `${origin}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${origin}/shop?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
