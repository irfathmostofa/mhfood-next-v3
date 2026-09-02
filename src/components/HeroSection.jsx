import { getHeroSlides, getSiteSettings } from "@/lib/site";
import HeroSlider from "./HeroSlider";
import PromoBanner from "./PromoBanner";

export default async function HeroSection() {
  const [slides, settings] = await Promise.all([
    getHeroSlides(),
    getSiteSettings(),
  ]);
  const hasBanner = Boolean(settings?.promo_banner_image);

  return (
    <section className="max-w-[97%] mx-auto px-2 sm:px-4 lg:px-8 pt-4 sm:pt-6">
      <div
        className={`grid grid-cols-12 gap-4 sm:gap-6 ${
          hasBanner ? "lg:items-stretch" : ""
        }`}
      >
        <div
          className={`col-span-12 rounded-2xl overflow-hidden ${
            hasBanner ? "lg:col-span-8" : ""
          }`}
        >
          <HeroSlider slides={slides} />
        </div>
        {hasBanner && (
          <div className="col-span-12 lg:col-span-4 min-h-0">
            <PromoBanner settings={settings} />
          </div>
        )}
      </div>
    </section>
  );
}
