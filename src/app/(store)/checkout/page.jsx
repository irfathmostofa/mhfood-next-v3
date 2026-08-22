import { getSeoSettings } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import CheckoutClient from "@/components/CheckoutClient";

export async function generateMetadata() {
  const seo = await getSeoSettings();
  return buildMetadata({ seo, path: "/checkout" });
}

export default function CheckoutPage() {
  return <CheckoutClient />;
}
