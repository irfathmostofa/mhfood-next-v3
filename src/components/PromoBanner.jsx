import Link from "next/link";

export default function PromoBanner({ settings }) {
  const image = settings?.promo_banner_image;
  if (!image) return null;

  const content = (
    <div className="relative w-full h-[148px] sm:h-[240px] lg:h-[320px] overflow-hidden rounded-2xl bg-primary/5">
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
