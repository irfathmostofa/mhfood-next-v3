import Link from "next/link";

export default function PromoBanner({ settings }) {
  const image = settings?.promo_banner_image;
  if (!image) return null;

  const content = (
    <div className="relative w-full h-full min-h-[180px] sm:min-h-[220px] lg:min-h-full overflow-hidden rounded-2xl sm:rounded-3xl bg-primary/5 shadow-sm ring-1 ring-black/5 group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={settings?.store_name || "Promo banner"}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
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
