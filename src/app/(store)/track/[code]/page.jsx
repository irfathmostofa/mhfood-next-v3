import { Suspense } from "react";
import { getSeoSettings } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import TrackClient from "@/components/TrackClient";

export async function generateMetadata() {
  const seo = await getSeoSettings();
  return buildMetadata({ seo, path: "/track" });
}

export default function TrackCodePage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-muted">Loading...</div>}>
      <TrackClient />
    </Suspense>
  );
}
