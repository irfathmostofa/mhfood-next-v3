import { Suspense } from "react";
import { getSeoSettings, getTheme } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import TrackClient from "@/components/TrackClient";

export async function generateMetadata() {
  const [seo, theme] = await Promise.all([getSeoSettings(), getTheme()]);
  return buildMetadata({ seo, theme, path: "/track" });
}

export default function TrackCodePage() {
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
