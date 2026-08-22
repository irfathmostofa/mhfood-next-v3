import Link from "next/link";
import { getSiteSettings } from "@/lib/site";

// Single static banner shown on the right column of the homepage hero
// (3 of 12 grid columns). Configured from Admin > Settings > Promo Banner.
export default async function PromoBanner() {
  const settings = await getSiteSettings();
  const image = settings?.promo_banner_image;
  if (!image) return null;

  const content = (
    <div className="relative w-full h-full aspect-[21/9] lg:aspect-auto overflow-hidden rounded-2xl bg-primary/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={settings?.store_name || "Promo banner"}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
    </div>
  );

  if (settings?.promo_banner_link) {
    return (
      <Link href={settings.promo_banner_link} className="block h-full">
        {content}
      </Link>
    );
  }
  return content;
}
