import Link from "next/link";
import { getFaqs, getSeoSettings, getTheme, getSiteSettings } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import { stripHtml } from "@/lib/richtext";
import FaqList from "@/components/FaqList";

export const revalidate = 60;

export async function generateMetadata() {
  const [seo, theme] = await Promise.all([getSeoSettings(), getTheme()]);
  return buildMetadata({
    seo,
    theme,
    title: "FAQ",
    description: `Answers to common questions about shopping, delivery, payments and orders at ${seo?.site_name || "our store"}.`,
    path: "/faq",
  });
}

export default async function FaqPage() {
  const [faqs, seo, settings] = await Promise.all([
    getFaqs(),
    getSeoSettings(),
    getSiteSettings(),
  ]);

  const siteName = seo?.site_name || "our store";
  const jsonLd =
    faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: stripHtml(faq.answer),
            },
          })),
        }
      : null;

  return (
    <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <div className="text-center mb-10 sm:mb-12">
        <p className="text-xs uppercase tracking-[0.16em] text-accent font-semibold mb-3">
          Help Centre
        </p>
        <h1 className="font-display text-3xl sm:text-4xl text-ink">
          Frequently asked questions
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted max-w-xl mx-auto leading-relaxed">
          Quick answers about ordering, delivery and tracking at {siteName}.
          Still stuck? Reach out and we will help.
        </p>
      </div>

      <FaqList faqs={faqs} />

      <div className="mt-12 rounded-2xl border border-line bg-surface px-5 py-8 text-center">
        <p className="font-display text-xl text-ink">Still have a question?</p>
        <p className="mt-2 text-sm text-muted">
          Track an existing order or send us a message — we are happy to help.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/track" className="btn btn-outline w-full sm:w-auto">
            Track order
          </Link>
          {settings?.store_phone ? (
            <a
              href={`tel:${settings.store_phone}`}
              className="btn btn-primary w-full sm:w-auto"
            >
              Call {settings.store_phone}
            </a>
          ) : (
            <Link href="/shop" className="btn btn-primary w-full sm:w-auto">
              Continue shopping
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
