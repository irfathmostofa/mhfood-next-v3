import { getSeoSettings, getTheme } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import CustomOrderForm from "@/components/CustomOrderForm";

export const revalidate = 60;

export async function generateMetadata() {
  const [seo, theme] = await Promise.all([getSeoSettings(), getTheme()]);
  return buildMetadata({
    seo,
    theme,
    title: "Custom Order",
    description: `Need something made to order? Send your custom order request to ${seo?.site_name || "our store"}.`,
    path: "/custom-order",
  });
}

export default function CustomOrderPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14">
      <div className="text-center mb-8">
        <p className="text-xs uppercase tracking-[0.16em] text-accent font-semibold mb-3">
          Made for you
        </p>
        <h1 className="font-display text-3xl sm:text-4xl text-ink">
          Custom Order
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted leading-relaxed">
          Tell us what you need. Attach a reference file or share a Google Drive
          link, and we will get back to you with a quote.
        </p>
      </div>
      <CustomOrderForm />
    </div>
  );
}
