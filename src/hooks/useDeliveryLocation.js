"use client";

import { useEffect, useState } from "react";
import { getLocationByKey } from "@/lib/bangladeshLocations";

const STORAGE_KEY = "mhfood_delivery_location_key";

export function useDeliveryLocation(extras = []) {
  const [areaKey, setAreaKey] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setAreaKey(saved);
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  function select(loc) {
    const key = loc?.key || "";
    setAreaKey(key);
    try {
      if (key) localStorage.setItem(STORAGE_KEY, key);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  return {
    areaKey,
    location: getLocationByKey(areaKey, extras),
    select,
    ready,
  };
}
