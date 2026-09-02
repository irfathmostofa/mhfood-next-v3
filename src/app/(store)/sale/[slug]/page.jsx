import { notFound } from "next/navigation";
import {
  getDiscountSessionBySlug,
  getSessionWithProducts,
  isSessionLive,
  sessionStatus,
} from "@/lib/discountSessions";
import { getSeoSettings, getTheme } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import ProductCard from "@/components/ProductCard";
import SaleCountdown from "@/components/SaleCountdown";
import { Zap } from "lucide-react";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [session, seo, theme] = await Promise.all([
    getDiscountSessionBySlug(slug),
    getSeoSettings(),
    getTheme(),
  ]);
  if (!session) return {};
  return buildMetadata({
    seo,
    theme,
    title: session.name,
    description: session.subtitle || `${session.name} — limited-time offers.`,
    path: `/sale/${slug}`,
  });
}

export default async function SalePage({ params }) {
  const { slug } = await params;
  const session = await getDiscountSessionBySlug(slug);
  if (!session) notFound();

  const hydrated = await getSessionWithProducts(session, 48);
  const products = hydrated?.products || [];
  const live = isSessionLive(session);
  const status = sessionStatus(session);

  return (
    <div className="pb-10">
      <div
        className={`px-5 py-10 sm:py-14 ${
          session.style === "blackfriday"
            ? "bg-gradient-to-br from-black via-[#1a1a1a] to-[#3d2b00] text-[#f5d76e]"
            : session.style === "sale"
              ? "bg-gradient-to-br from-primary to-accent text-white"
              : "bg-gradient-to-br from-[#c1121f] via-[#e5383b] to-[#f48c06] text-white"
        }`}
      >
        <div className="max-w-[97%] mx-auto">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] px-3 py-1 rounded-full bg-white/15">
            <Zap size={12} /> {status === "live" ? "Live now" : status}
          </span>
          <h1 className="font-display text-4xl sm:text-5xl mt-4">
            {session.name}
          </h1>
          {session.subtitle && (
            <p className="mt-2 text-sm opacity-80">{session.subtitle}</p>
          )}
          {live && (
            <div className="mt-6">
              <p className="text-[10px] uppercase tracking-wider opacity-70 mb-1">
                Ends in
              </p>
              <SaleCountdown endsAt={session.ends_at} light />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[97%] mx-auto px-4 py-8">
        {!live ? (
          <p className="text-center text-muted py-16">
            This campaign is not live right now.
          </p>
        ) : products.length === 0 ? (
          <p className="text-center text-muted py-16">
            No products in this campaign yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
