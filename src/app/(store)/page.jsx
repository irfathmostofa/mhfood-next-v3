import {
  getHomeSections,
  getSeoSettings,
  getCategories,
  getCategoryCounts,
  getTheme,
} from "@/lib/site";
import { getProductsWithRatings, getBestsellers } from "@/lib/products";
import { getLiveSessionsWithProducts } from "@/lib/discountSessions";
import { buildMetadata } from "@/lib/seo";
import HeroSection from "@/components/HeroSection";
import FeatureStrip from "@/components/FeatureStrip";
import BestSellers from "@/components/BestSellers";
import CategoriesGrid from "@/components/CategoriesGrid";
import ProductSection from "@/components/ProductSection";
import HowItWorks from "@/components/HowItWorks";
import CtaBand from "@/components/CtaBand";
import PromoBannerSection from "@/components/PromoBannerSection";
import FlashSaleSection from "@/components/FlashSaleSection";

export async function generateMetadata() {
  const [seo, theme] = await Promise.all([getSeoSettings(), getTheme()]);
  return buildMetadata({ seo, theme, path: "/" });
}

export default async function HomePage() {
  const [sections, seo] = await Promise.all([
    getHomeSections(),
    getSeoSettings(),
  ]);

  const enabled = sections.filter((s) => s.enabled);

  const bestsellersSection = enabled.find((s) => s.key === "bestsellers");
  const categoriesSection = enabled.find((s) => s.key === "categories");
  const featuredSection = enabled.find((s) => s.key === "featured");
  const latestSection = enabled.find((s) => s.key === "latest");
  const flashSaleSection = enabled.find((s) => s.key === "flash_sale");

  const [
    featured,
    latest,
    bestsellers,
    [allCategories, categoryCounts],
    saleSessions,
  ] = await Promise.all([
    featuredSection
      ? getProductsWithRatings({
          featuredOnly: true,
          limit: featuredSection.items_per_page || 8,
        })
      : { products: [] },
    latestSection
      ? getProductsWithRatings({
          limit: latestSection.items_per_page || 8,
        })
      : { products: [] },
    bestsellersSection
      ? getBestsellers(bestsellersSection.items_per_page || 12)
      : [],
    categoriesSection
      ? Promise.all([getCategories(), getCategoryCounts()])
      : [[], {}],
    flashSaleSection
      ? getLiveSessionsWithProducts(flashSaleSection.items_per_page || 10)
      : [],
  ]);

  const parentCategories = allCategories
    .filter((c) => !c.parent_id && categoryCounts[c.id] > 0)
    .slice(0, categoriesSection?.items_per_page || 12);

  const renderSection = (section) => {
    switch (section.key) {
      case "hero":
        return <HeroSection key={section.key} />;
      case "flash_sale":
        return <FlashSaleSection key={section.key} sessions={saleSessions} />;
      case "bestsellers":
        return (
          <BestSellers
            key={section.key}
            title={section.title}
            subtitle={section.subtitle}
            products={bestsellers}
          />
        );
      case "categories":
        return (
          <CategoriesGrid
            key={section.key}
            title={section.title}
            subtitle={section.subtitle}
            categories={parentCategories}
            countMap={categoryCounts}
          />
        );
      case "featured":
        return (
          <ProductSection
            key={section.key}
            title={section.title}
            subtitle={section.subtitle}
            products={featured.products}
            viewAllHref="/shop"
          />
        );
      case "latest":
        return (
          <ProductSection
            key={section.key}
            title={section.title}
            subtitle={section.subtitle}
            products={latest.products}
            viewAllHref="/shop"
          />
        );
      case "promo":
        return (
          <PromoBannerSection
            key={section.key}
            title={section.title}
            settings={section.settings}
          />
        );
      case "feature_strip":
        return (
          <FeatureStrip
            key={section.key}
            title={section.title}
            subtitle={section.subtitle}
          />
        );
      case "how_it_works":
        return (
          <HowItWorks
            key={section.key}
            title={section.title}
            subtitle={section.subtitle}
          />
        );
      case "cta":
        return (
          <CtaBand
            key={section.key}
            title={section.title}
            subtitle={section.subtitle}
          />
        );
      default:
        return null;
    }
  };

  const pageTitle =
    seo?.home_title || seo?.site_name || "Shop online";

  return (
    <div className="pb-4">
      <h1 className="sr-only">{pageTitle}</h1>
      {enabled.map(renderSection)}
    </div>
  );
}
