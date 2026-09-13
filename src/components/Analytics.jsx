"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";

function sanitizeGaId(id) {
  const value = String(id || "").trim();
  return /^(G|GT|AW|DC)-[A-Z0-9]+$/i.test(value) ? value : "";
}

function sanitizePixelId(id) {
  return String(id || "").trim();
}

export default function Analytics({
  gaId = "",
  metaPixelId = "",
  tiktokPixelId = "",
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstPageView = useRef(true);

  const GA_ID = sanitizeGaId(
    gaId || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "",
  );
  const PIXEL_ID = sanitizePixelId(
    metaPixelId || process.env.NEXT_PUBLIC_META_PIXEL_ID || "",
  );
  const TTQ_ID = sanitizePixelId(
    tiktokPixelId || process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || "",
  );

  const isAdmin = pathname?.startsWith("/admin");

  useEffect(() => {
    if (isAdmin) return;
    if (!PIXEL_ID && !TTQ_ID) return;
    loadAdPixels(PIXEL_ID, TTQ_ID);
  }, [PIXEL_ID, TTQ_ID, isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    if (!GA_ID && !PIXEL_ID && !TTQ_ID) return;

    const url = `${pathname}${searchParams?.toString() ? `?${searchParams}` : ""}`;

    if (GA_ID) {
      if (firstPageView.current) {
        firstPageView.current = false;
      } else if (window.gtag) {
        window.gtag("config", GA_ID, {
          page_path: url,
          page_location: window.location.href,
          page_title: document.title,
        });
      }
    }

    if (window.fbq) window.fbq("track", "PageView");
    if (window.ttq) window.ttq.track("Pageview");
  }, [pathname, searchParams, GA_ID, PIXEL_ID, TTQ_ID, isAdmin]);

  if (isAdmin || !GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: true });
        `}
      </Script>
    </>
  );
}

function loadAdPixels(PIXEL_ID, TTQ_ID) {
  if (PIXEL_ID && !window.fbq) {
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

  if (TTQ_ID && !window.ttq) {
    window.ttq = window.ttq || [];
    const methods = [
      "page",
      "track",
      "identify",
      "instances",
      "debug",
      "on",
      "off",
      "once",
      "ready",
      "alias",
      "group",
      "enableCookie",
      "disableCookie",
      "holdConsent",
      "revokeConsent",
      "grantConsent",
    ];
    methods.forEach((m) => {
      window.ttq[m] = function () {
        window.ttq.push([m].concat(Array.prototype.slice.call(arguments, 0)));
      };
    });
    window.ttq.load = function (e) {
      const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
      window.ttq._i = window.ttq._i || {};
      window.ttq._i[e] = [];
      window.ttq._i[e]._u = url;
      window.ttq._t = window.ttq._t || {};
      window.ttq._t[e] = +new Date();
      const a = document.createElement("script");
      a.type = "text/javascript";
      a.async = true;
      a.src = url + "?sdkid=" + e + "&lib=ttq";
      const s = document.getElementsByTagName("script")[0];
      s.parentNode.insertBefore(a, s);
    };
    window.ttq.load(TTQ_ID);
  }
}

export function trackEvent(eventName, params) {
  if (typeof window === "undefined") return;
  if (window.gtag) window.gtag("event", eventName, params || {});
  if (window.fbq) window.fbq("track", eventName, params || {});
  if (window.ttq) window.ttq.track(eventName, params || {});
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
