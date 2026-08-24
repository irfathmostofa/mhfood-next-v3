import { getSeoSettings, getTheme } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import ReviewClient from "@/components/ReviewClient";

export async function generateMetadata() {
  const [seo, theme] = await Promise.all([getSeoSettings(), getTheme()]);
  return buildMetadata({ seo, theme, path: "/review" });
}

export default function ReviewPage() {
  return <ReviewClient />;
}
