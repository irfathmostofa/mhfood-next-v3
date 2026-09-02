import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import BackToTop from "@/components/BackToTop";
import FloatingContactButtons from "@/components/FloatingContactButtons";
import FloatingCart from "@/components/FloatingCart";
import { getTheme, getSiteSettings, getCategories } from "@/lib/site";
import { getLiveDiscountSessions } from "@/lib/discountSessions";

export default async function StoreLayout({ children }) {
  const [theme, siteSettings, categories, liveSessions] = await Promise.all([
    getTheme(),
    getSiteSettings(),
    getCategories(),
    getLiveDiscountSessions(),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        theme={theme}
        categories={categories}
        liveSessions={liveSessions}
      />
      <main className="flex-1">{children}</main>
      <Footer theme={theme} />
      <FloatingContactButtons settings={siteSettings} />
      <BackToTop settings={siteSettings} />
      <CartDrawer />
      <FloatingCart />
    </div>
  );
}
