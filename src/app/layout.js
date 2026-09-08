import { Suspense } from "react";
import "./globals.css";
import { getTheme, getSeoSettings } from "@/lib/site";
import { themeVariables } from "@/lib/theme";
import { buildMetadata } from "@/lib/seo";
import { CartProvider } from "@/hooks/useCart";
import Analytics from "@/components/Analytics";
import JsonLd from "@/components/JsonLd";

export async function generateMetadata() {
  const [seo, theme] = await Promise.all([getSeoSettings(), getTheme()]);
  return buildMetadata({ seo, theme, path: "/" });
}

export default async function RootLayout({ children }) {
  const [theme, seo] = await Promise.all([getTheme(), getSeoSettings()]);

  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <meta
          name="theme-color"
          content={theme?.accent_color || "#C77B4C"}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap" 
          rel="stylesheet" 
        />
        <style dangerouslySetInnerHTML={{ __html: themeVariables(theme) }} />
        <JsonLd seo={seo} theme={theme} />
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