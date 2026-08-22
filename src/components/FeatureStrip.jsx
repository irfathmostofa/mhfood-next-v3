import { Truck, Leaf, PackageCheck, Headset } from "lucide-react";
import { getSiteSettings } from "@/lib/site";

export default async function FeatureStrip() {
  const settings = await getSiteSettings();

  const freeDelivery = settings?.free_delivery_enabled;
  const threshold = Number(settings?.free_delivery_threshold || 0);

  const features = [
    {
      icon: Truck,
      title: freeDelivery ? `Free delivery over ৳${threshold}` : "Fast delivery",
      text: freeDelivery
        ? "On orders above the threshold, right to your door."
        : "Orders are delivered quickly, right to your door.",
    },
    {
      icon: Leaf,
      title: "Fresh every day",
      text: "Stock is sourced fresh and checked before it ships.",
    },
    {
      icon: PackageCheck,
      title: "Real-time tracking",
      text: "Follow your order from the store to your doorstep.",
    },
    {
      icon: Headset,
      title: "Friendly support",
      text: "We are here to help you before, during and after your order.",
    },
  ];

  return (
    <section className="bg-surface border-b border-line">
      <div className="max-w-7xl mx-auto px-5 py-8 sm:py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <f.icon size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{f.title}</p>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  {f.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
