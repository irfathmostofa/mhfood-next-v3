import { Suspense } from "react";
import "./globals.css";
import { getTheme, getSeoSettings } from "@/lib/site";
import { themeVariables } from "@/lib/theme";
import { buildMetadata } from "@/lib/seo";
import { CartProvider } from "@/hooks/useCart";
import Analytics from "@/components/Analytics";

export async function generateMetadata() {
  const seo = await getSeoSettings();
  return buildMetadata({ seo, path: "/" });
}

export default async function RootLayout({ children }) {
  const [theme, seo] = await Promise.all([getTheme(), getSeoSettings()]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content={theme.accent_color} />
        <meta name="application-name" content={seo.site_name} />
        <style dangerouslySetInnerHTML={{ __html: themeVariables(theme) }} />
      </head>
      <body className="overflow-x-hidden">
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
