import { getHomeSections, getSeoSettings, getCategories, getCategoryCounts } from "@/lib/site";
import { getProductsWithRatings, getBestsellers } from "@/lib/products";
import { buildMetadata } from "@/lib/seo";
import HeroSection from "@/components/HeroSection";
import FeatureStrip from "@/components/FeatureStrip";
import BestSellers from "@/components/BestSellers";
import CategoriesGrid from "@/components/CategoriesGrid";
import ProductSection from "@/components/ProductSection";
import HowItWorks from "@/components/HowItWorks";
import CtaBand from "@/components/CtaBand";

export async function generateMetadata() {
  const seo = await getSeoSettings();
  return buildMetadata({ seo, path: "/" });
}

export default async function HomePage() {
  const [sections] = await Promise.all([getHomeSections()]);

  const enabled = sections.filter((s) => s.enabled);

  const bestsellersSection = enabled.find((s) => s.key === "bestsellers");
  const categoriesSection = enabled.find((s) => s.key === "categories");
  const featuredSection = enabled.find((s) => s.key === "featured");
  const latestSection = enabled.find((s) => s.key === "latest");

  const [featured, latest, bestsellers, [allCategories, categoryCounts]] =
    await Promise.all([
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
    ]);

  const parentCategories = allCategories
    .filter((c) => !c.parent_id && categoryCounts[c.id] > 0)
    .slice(0, categoriesSection?.items_per_page || 12);

  const renderSection = (section) => {
    switch (section.key) {
      case "hero":
        return <HeroSection key={section.key} />;
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
      default:
        return null;
    }
  };

  return (
    <div className="pb-4">
      {enabled.map(renderSection)}

      {/* Always-on trust / engagement sections */}
      <FeatureStrip />
      <HowItWorks />
      <CtaBand />
    </div>
  );
}
