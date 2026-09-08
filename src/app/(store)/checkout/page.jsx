import { getSeoSettings, getTheme } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import CheckoutClient from "@/components/CheckoutClient";

export async function generateMetadata() {
  const [seo, theme] = await Promise.all([getSeoSettings(), getTheme()]);
  return buildMetadata({
    seo,
    theme,
    title: "Checkout",
    description: "Complete your order quickly and securely.",
    path: "/checkout",
    noIndex: true,
  });
}

export default function CheckoutPage() {
  return <CheckoutClient />;
}
