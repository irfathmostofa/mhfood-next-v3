"use client";

import { useEffect, useState } from "react";

function parts(endsAt) {
  const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const s = Math.floor(diff / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    done: diff <= 0,
  };
}

export default function SaleCountdown({ endsAt, light = false }) {
  const [t, setT] = useState(null); // null on both server & first client render

  useEffect(() => {
    setT(parts(endsAt)); // real value computed client-side, after mount
    const id = setInterval(() => setT(parts(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!t) {
    // same markup shape server renders — avoids layout shift too
    return (
      <div className="flex items-center gap-2">
        {/* skeleton/placeholder cells, or just render zeros */}
      </div>
    );
  }

  if (t.done) {
    return (
      <span className={light ? "text-white/70 text-sm" : "text-muted text-sm"}>
        Ended
      </span>
    );
  }

  const cell = (value, label) => (
    <div className="flex flex-col items-center min-w-[42px]">
      <span
        className={`font-display text-lg sm:text-xl leading-none tabular-nums ${
          light ? "text-white" : "text-ink"
        }`}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span
        className={`text-[9px] uppercase tracking-wider mt-1 ${
          light ? "text-white/60" : "text-muted"
        }`}
      >
        {label}
      </span>
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      {t.days > 0 && cell(t.days, "Days")}
      {cell(t.hours, "Hrs")}
      {cell(t.minutes, "Min")}
      {cell(t.seconds, "Sec")}
    </div>
  );
}
