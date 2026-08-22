"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

// Injects GA4 (gtag.js) and Meta Pixel (fbq) snippets once.
export default function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!GA_ID && !PIXEL_ID) return;

    // ---- Google Analytics 4 ----
    if (GA_ID) {
      if (!window.gtag) {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () {
          window.dataLayer.push(arguments);
        };
        window.gtag("js", new Date());
        const s = document.createElement("script");
        s.async = true;
        s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
        document.head.appendChild(s);
        window.gtag("config", GA_ID, { send_page_view: false });
      }
    }

    // ---- Meta Pixel ----
    if (PIXEL_ID) {
      if (!window.fbq) {
        window.fbq = function () {
          window.fbq.callMethod
            ? window.fbq.callMethod.apply(window.fbq, arguments)
            : window.fbq.queue.push(arguments);
        };
        if (!window._fbq) window._fbq = window.fbq;
        window.fbq.push = window.fbq;
        window.fbq.loaded = true;
        window.fbq.version = "2.0";
        window.fbq.queue = [];
        window.fbq("init", PIXEL_ID);
        window.fbq("track", "PageView");
        const s = document.createElement("script");
        s.async = true;
        s.src = "https://connect.facebook.net/en_US/fbevents.js";
        document.head.appendChild(s);
      }
    }
  }, []);

  // Page view tracking on route change.
  useEffect(() => {
    if (!GA_ID && !PIXEL_ID) return;
    const url = `${pathname}${searchParams ? `?${searchParams}` : ""}`;

    if (window.gtag) {
      window.gtag("event", "page_view", { page_path: url });
    }
    if (window.fbq) {
      window.fbq("track", "PageView");
    }
  }, [pathname, searchParams]);

  return null;
}

// Shared event helpers used across the app. Safe no-ops when tracking is off.
export function trackEvent(eventName, params) {
  if (typeof window === "undefined") return;
  if (window.gtag) window.gtag("event", eventName, params || {});
  if (window.fbq) window.fbq("track", eventName, params || {});
}

export function trackViewContent(params) {
  trackEvent("ViewContent", params);
}

export function trackAddToCart(params) {
  trackEvent("AddToCart", params);
}

export function trackInitiateCheckout(params) {
  trackEvent("InitiateCheckout", params);
}

export function trackPurchase(params) {
  trackEvent("Purchase", params);
}
