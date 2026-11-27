"use client";

import { useEffect, useState } from "react";

const DARK = "#111827";
const LIGHT = "#ffffff";

// Converts ANY css colour (hex, rgb, oklch, color-mix...) to sRGB via canvas.
function toRgba(css) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a };
  } catch {
    return null;
  }
}

const lin = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/**
 * Reads the element's REAL rendered background colour (so it follows the
 * admin-chosen base colour automatically) and returns the text colour with
 * the better WCAG contrast: white or near-black.
 *
 *   const ref = useRef(null);
 *   const { fg, bg } = useReadableText(ref);
 *   <section ref={ref} className="bg-primary" style={{ color: fg }}>
 *
 * Falls back to white until measured, or if the background is transparent.
 */
export function useReadableText(ref) {
  const [colors, setColors] = useState({ fg: LIGHT, bg: null });

  useEffect(() => {
    function measure() {
      const el = ref.current;
      if (!el) return;
      const rgba = toRgba(getComputedStyle(el).backgroundColor);
      if (!rgba || rgba.a < 250) return; // transparent: can't judge
      const L =
        0.2126 * lin(rgba.r) + 0.7152 * lin(rgba.g) + 0.0722 * lin(rgba.b);
      const whiteContrast = 1.05 / (L + 0.05);
      const darkContrast = (L + 0.05) / 0.06;
      setColors({
        fg: whiteContrast >= darkContrast ? LIGHT : DARK,
        bg: `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`,
      });
    }

    measure();
    // Re-measure if the theme changes at runtime.
    const obs = new MutationObserver(measure);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class", "data-theme"],
    });
    return () => obs.disconnect();
  }, [ref]);

  return colors;
}
