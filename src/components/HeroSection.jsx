import { getHeroSlides, getSiteSettings } from "@/lib/site";
import HeroSlider from "./HeroSlider";
import PromoBanner from "./PromoBanner";

export default async function HeroSection() {
  const [slides, settings] = await Promise.all([
    getHeroSlides(),
    getSiteSettings(),
  ]);
  const hasBanner =
    Boolean(settings?.promo_banner_image) &&
    settings?.promo_banner_enabled !== false;

  if (slides.length === 0 && !hasBanner) return null;

  return (
    <section className="max-w-[97%] mx-auto px-3 sm:px-5 lg:px-8 pt-3 sm:pt-5 lg:pt-7">
      <div
        className={`grid grid-cols-1 gap-3 sm:gap-4 ${
          hasBanner ? "lg:grid-cols-[minmax(0,1.7fr)_minmax(240px,1fr)] lg:items-stretch" : ""
        }`}
      >
        <div className="rounded-lg overflow-hidden shadow-sm h-[250px] sm:h-[300px] lg:h-[350px] ring-1 ring-black/5 bg-primary/5">
          {slides.length > 0 ? (
            <HeroSlider slides={slides} />
          ) : (
            <div className="h-[250px] sm:h-[300px] lg:h-[350px] flex items-end bg-primary">
              <div className="px-6 pb-10 sm:px-10 sm:pb-14 text-white max-w-xl">
                <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl leading-tight">
                  Fresh food, delivered daily
                </h2>
                <p className="mt-3 text-sm sm:text-base text-white/85">
                  Shop quality groceries and kitchen staples from {settings?.store_name || "our store"}.
                </p>
              </div>
            </div>
          )}
        </div>
        {hasBanner && (
          <div className="h-[250px] sm:h-[300px] lg:h-[350px]">
            <PromoBanner settings={settings} />
          </div>
        )}
      </div>
    </section>
  );
}
