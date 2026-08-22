import { getSeoSettings } from "@/lib/site";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";

export default async function robots() {
  const seo = await getSeoSettings();
  const siteName = seo?.site_name || "Store";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/track/", "/checkout"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
    metadata: {
      title: `${siteName} robots`,
      description: "Robots rules for the store",
    },
  };
}
