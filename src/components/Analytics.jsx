"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function Analytics({
  gaId = "",
  metaPixelId = "",
  tiktokPixelId = "",
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const GA_ID = gaId || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
  const PIXEL_ID = metaPixelId || process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
  const TTQ_ID = tiktokPixelId || process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || "";

  useEffect(() => {
    if (!GA_ID && !PIXEL_ID && !TTQ_ID) return;

    let idleId;
    let timeoutId;
    const start = () => loadPixels(GA_ID, PIXEL_ID, TTQ_ID);

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(start, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(start, 1800);
    }

    return () => {
      if (idleId && window.cancelIdleCallback) window.cancelIdleCallback(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [GA_ID, PIXEL_ID, TTQ_ID]);

  useEffect(() => {
    if (!GA_ID && !PIXEL_ID && !TTQ_ID) return;
    const url = `${pathname}${searchParams ? `?${searchParams}` : ""}`;

    if (window.gtag) {
      window.gtag("event", "page_view", { page_path: url });
    }
    if (window.fbq) {
      window.fbq("track", "PageView");
    }
    if (window.ttq) {
      window.ttq.track("Pageview");
    }
  }, [pathname, searchParams, GA_ID, PIXEL_ID, TTQ_ID]);

  return null;
}

function loadPixels(GA_ID, PIXEL_ID, TTQ_ID) {
  if (GA_ID && !window.gtag) {
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
