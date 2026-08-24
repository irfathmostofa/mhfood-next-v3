import { getHeroSlides } from "@/lib/site";
import HeroSlider from "./HeroSlider";
import PromoBanner from "./PromoBanner";

// Homepage hero: a 12-column grid — 9 columns for the slider and 3
// columns for a single promo banner on the right.
export default async function HeroSection() {
  const slides = await getHeroSlides();

  return (
    <section className="max-w-[97%] mx-auto px-2 sm:px-4 lg:px-8 pt-4 sm:pt-6">
      <div className="grid grid-cols-12 gap-4 sm:gap-6">
        <div className="col-span-12 lg:col-span-8 rounded-2xl overflow-hidden">
          <HeroSlider slides={slides} />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <PromoBanner />
        </div>
      </div>
    </section>
  );
}
