import { Suspense } from "react";
import { getSeoSettings, getTheme } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import TrackClient from "@/components/TrackClient";

export async function generateMetadata() {
  const [seo, theme] = await Promise.all([getSeoSettings(), getTheme()]);
  return buildMetadata({
    seo,
    theme,
    title: "Track Order",
    description: "Track your order status from the store to your door.",
    path: "/track",
    noIndex: true,
  });
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-sm text-muted">Loading...</div>
      }
    >
      <TrackClient />
    </Suspense>
  );
}
