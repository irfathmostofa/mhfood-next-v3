import { Suspense } from "react";
import "./globals.css";
import { getTheme, getSeoSettings } from "@/lib/site";
import { themeVariables } from "@/lib/theme";
import { buildMetadata } from "@/lib/seo";
import { CartProvider } from "@/hooks/useCart";
import Analytics from "@/components/Analytics";

export async function generateMetadata() {
  const [seo, theme] = await Promise.all([getSeoSettings(), getTheme()]);
  return buildMetadata({ seo, theme, path: "/" });
}

export default async function RootLayout({ children }) {
  const [theme, seo] = await Promise.all([getTheme(), getSeoSettings()]);

  const logo = theme?.logo_image || "/mhfood.png";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content={theme.accent_color} />
        <meta name="application-name" content={seo.site_name} />
        <link rel="icon" href={logo} />
        <link rel="apple-touch-icon" href={logo} />
        <style dangerouslySetInnerHTML={{ __html: themeVariables(theme) }} />
      </head>
      <body className="overflow-x-hidden">
        <Suspense fallback={null}>
          <Analytics
            gaId={seo?.ga_measurement_id}
            metaPixelId={seo?.facebook_pixel_id}
            tiktokPixelId={seo?.tiktok_pixel_id}
          />
        </Suspense>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
