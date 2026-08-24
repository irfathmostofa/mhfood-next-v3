import { getSeoSettings, getTheme } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import CheckoutClient from "@/components/CheckoutClient";

export async function generateMetadata() {
  const [seo, theme] = await Promise.all([getSeoSettings(), getTheme()]);
  return buildMetadata({ seo, theme, path: "/checkout" });
}

export default function CheckoutPage() {
  return <CheckoutClient />;
}
