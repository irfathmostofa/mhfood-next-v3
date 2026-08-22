import Link from "next/link";
import { ShoppingBag, Truck, PackageCheck } from "lucide-react";

const STEPS = [
  {
    icon: ShoppingBag,
    title: "Choose your food",
    text: "Browse our categories and add what you need to your cart.",
  },
  {
    icon: Truck,
    title: "We deliver fast",
    text: "Checkout in seconds — we confirm and pack your order right away.",
  },
  {
    icon: PackageCheck,
    title: "Track & enjoy",
    text: "Follow your order in real time until it reaches your door.",
  },
];

export default function HowItWorks() {
  return (
    <section className="max-w-7xl mx-auto px-5 py-14 sm:py-20">
      <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
        <p className="text-xs uppercase tracking-[0.15em] text-accent font-semibold mb-2">
          How it works
        </p>
        <h2 className="font-display text-2xl sm:text-4xl text-ink">
          Fresh food, in three easy steps
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto">
        {STEPS.map((step, i) => (
          <div key={step.title} className="relative text-center">
            {i < STEPS.length - 1 && (
              <div className="hidden sm:block absolute top-8 left-[calc(50%+3rem)] right-[calc(-50%+3rem)] border-t border-dashed border-line" />
            )}
            <div className="relative inline-flex w-16 h-16 rounded-2xl bg-primary text-white items-center justify-center shadow-lg mb-4">
              <step.icon size={24} />
              <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
            </div>
            <h3 className="text-base font-semibold text-ink mb-1.5">
              {step.title}
            </h3>
            <p className="text-sm text-muted leading-relaxed max-w-[240px] mx-auto">
              {step.text}
            </p>
          </div>
        ))}
      </div>

      <div className="text-center mt-10">
        <Link href="/shop" className="btn btn-accent">
          Start Shopping
        </Link>
      </div>
    </section>
  );
}
