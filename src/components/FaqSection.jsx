import Link from "next/link";
import { containsBangla, headingFontClass } from "@/lib/slugify";
import FaqList from "@/components/FaqList";

export default function FaqSection({
  title = "Frequently asked questions",
  subtitle = "Quick answers about ordering, delivery and tracking.",
  faqs = [],
  limit = 6,
}) {
  const items = (faqs || []).slice(0, Math.max(1, Number(limit) || 6));
  if (items.length === 0) return null;

  return (
    <section className="max-w-3xl mx-auto px-5 py-14 sm:py-20">
      <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
        <p className="text-xs uppercase tracking-[0.16em] text-accent font-semibold mb-3">
          Help Centre
        </p>
        <h2
          lang={containsBangla(title) ? "bn" : "en"}
          className={`${headingFontClass(title)} text-2xl sm:text-4xl text-ink`}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm sm:text-base text-muted mt-2">{subtitle}</p>
        )}
      </div>

      <FaqList faqs={items} compact />

      <div className="text-center mt-8">
        <Link href="/faq" className="btn btn-outline">
          View all FAQs
        </Link>
      </div>
    </section>
  );
}
