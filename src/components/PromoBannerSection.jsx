import Link from "next/link";

// Full-width promotional banner rendered as a homepage section, shown after
// the product sections. Configured from Admin > Settings > Home Sections
// (image + link live in the section's `settings` jsonb column).
export default function PromoBannerSection({ title, settings }) {
  const image = settings?.image;
  if (!image) return null;

  const content = (
    <div className="relative w-full aspect-[21/9] max-h-[420px] overflow-hidden rounded-2xl bg-primary/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={title || "Promo banner"}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
    </div>
  );

  const link = settings?.link;

  return (
    <section className="max-w-[94%] mx-auto px-2 py-10">
      {link ? (
        <Link href={link} className="block">
          {content}
        </Link>
      ) : (
        content
      )}
    </section>
  );
}
