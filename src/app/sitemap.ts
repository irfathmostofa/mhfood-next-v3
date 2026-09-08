import { getCategories } from "@/lib/site";
import { supabase } from "@/lib/supabase";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";

export default async function sitemap() {
  const categories = await getCategories();

  const { data: products } = await supabase
    .from("products")
    .select("slug, updated_at")
    .eq("is_active", true);

  const staticRoutes = ["", "/shop"].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.8,
  }));

  const categoryRoutes = (categories || []).map((c) => ({
    url: `${baseUrl}/shop?category=${encodeURIComponent(c.slug)}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const productRoutes = (products || []).map((p) => ({
    url: `${baseUrl}/product/${p.slug}`,
    lastModified: p.updated_at || new Date(),
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
