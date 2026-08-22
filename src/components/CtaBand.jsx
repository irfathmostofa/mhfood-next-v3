import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function CtaBand() {
  return (
    <section className="max-w-7xl mx-auto px-5 pb-16 sm:pb-20">
      <div className="relative overflow-hidden rounded-3xl bg-primary text-white px-6 py-12 sm:px-12 sm:py-16 text-center">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-accent/25 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative">
          <h2 className="font-display text-2xl sm:text-4xl max-w-2xl mx-auto leading-tight">
            Hungry? Your order is a click away.
          </h2>
          <p className="text-white/70 text-sm sm:text-base mt-3 max-w-lg mx-auto">
            Order fresh food and groceries online and track them the whole way
            to your door.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-white text-ink px-7 py-3.5 rounded-full text-sm font-semibold hover:bg-accent hover:text-white transition-colors"
            >
              Browse the shop <ArrowRight size={16} />
            </Link>
            <Link
              href="/track"
              className="inline-flex items-center gap-2 border border-white/40 px-7 py-3.5 rounded-full text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              Track an order
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
