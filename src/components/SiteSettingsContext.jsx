"use client";

import { createContext, useContext } from "react";

const SiteSettingsContext = createContext(null);

export function SiteSettingsProvider({ value, children }) {
  return (
    <SiteSettingsContext.Provider value={value || null}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
