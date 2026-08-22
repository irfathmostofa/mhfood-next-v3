import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductCard from "./ProductCard";

export default function ProductSection({
  title,
  subtitle,
  products,
  viewAllHref,
}) {
  if (!products || products.length === 0) return null;

  return (
    <section className="max-w-8xl mx-auto px-5 py-10">
      <div className="flex items-end justify-between mb-6 px-1.5">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl text-ink">
            {title || "Products"}
          </h2>
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-ink hover:text-accent transition-colors"
          >
            View all <ArrowRight size={16} />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {viewAllHref && (
        <div className="mt-6 sm:hidden flex justify-center">
          <Link href={viewAllHref} className="btn btn-ghost">
            View all <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </section>
  );
}
