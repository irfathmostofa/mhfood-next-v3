import { getSeoSettings } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import ReviewClient from "@/components/ReviewClient";

export async function generateMetadata() {
  const seo = await getSeoSettings();
  return buildMetadata({ seo, path: "/review" });
}

export default function ReviewPage() {
  return <ReviewClient />;
}
