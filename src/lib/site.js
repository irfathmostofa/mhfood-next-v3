import { unstable_cache } from "next/cache";
import { supabase } from "./supabase";

const CONFIG_TTL = 60;

export const DEFAULT_THEME = {
  primary_color: "#1F2A24",
  accent_color: "#C77B4C",
  background_color: "#FBF8F3",
  surface_color: "#FFFFFF",
  text_color: "#1F2A24",
  muted_color: "#8A8578",
  border_color: "#E7E0D3",
  show_announcement_bar: false,
  show_header_categories: true,
  announcement_text: "",
  font_family: "fraunces",
  logo_text: "MHFood",
  logo_image: "",
  store_name: "MHFood",
};

export const DEFAULT_SEO = {
  site_name: "MHFood",
  site_tagline: "Order online, tracked the whole way.",
  home_title: "MHFood — Shop online",
  home_description:
    "Shop a curated collection of products across every category — ordered in a click and tracked the whole way.",
  home_keywords: "shop, online store, ecommerce",
  og_image: "",
  ga_measurement_id: "",
  facebook_pixel_id: "",
  tiktok_pixel_id: "",
};

async function fetchTheme() {
  try {
    const { data } = await supabase
      .from("theme_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return data || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export const getTheme = unstable_cache(fetchTheme, ["site-theme"], {
  revalidate: CONFIG_TTL,
});

async function fetchSeoSettings() {
  try {
    const { data } = await supabase
      .from("seo_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return data || DEFAULT_SEO;
  } catch {
    return DEFAULT_SEO;
  }
}

export const getSeoSettings = unstable_cache(fetchSeoSettings, ["site-seo"], {
  revalidate: CONFIG_TTL,
});

async function fetchSiteSettings() {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

export const getSiteSettings = unstable_cache(
  fetchSiteSettings,
  ["site-settings"],
  {
    revalidate: CONFIG_TTL,
  },
);

export const DEFAULT_SECTIONS = [
  {
    key: "hero",
    title: "Featured",
    subtitle: "Showcase your hero banner",
    enabled: true,
    sort_order: 1,
    items_per_page: 1,
  },
  {
    key: "bestsellers",
    title: "Best Selling Products",
    subtitle: "Our customers' favorites",
    enabled: true,
    sort_order: 2,
    items_per_page: 12,
  },
  {
    key: "categories",
    title: "Shop by Category",
    subtitle: "Browse our collections",
    enabled: true,
    sort_order: 3,
    items_per_page: 12,
  },
  {
    key: "featured",
    title: "Featured Products",
    subtitle: "Handpicked for you",
    enabled: true,
    sort_order: 4,
    items_per_page: 8,
  },
  {
    key: "latest",
    title: "New Arrivals",
    subtitle: "Fresh in store",
    enabled: true,
    sort_order: 5,
    items_per_page: 8,
  },
  {
    key: "promo",
    title: "Promotional Banner",
    subtitle: "Full-width banner after your products",
    enabled: true,
    sort_order: 6,
    items_per_page: 1,
  },
  {
    key: "flash_sale",
    title: "Flash Sale",
    subtitle: "Limited-time campaign offers",
    enabled: true,
    sort_order: 2,
    items_per_page: 10,
  },
  {
    key: "feature_strip",
    title: "Trust Features",
    subtitle: "Delivery, freshness, tracking and support",
    enabled: true,
    sort_order: 7,
    items_per_page: 4,
  },
  {
    key: "how_it_works",
    title: "How it works",
    subtitle: "Fresh food, in three easy steps",
    enabled: true,
    sort_order: 8,
    items_per_page: 3,
  },
  {
    key: "cta",
    title: "Hungry? Your order is a click away.",
    subtitle:
      "Order fresh food and groceries online and track them the whole way to your door.",
    enabled: true,
    sort_order: 9,
    items_per_page: 1,
  },
];

async function fetchHomeSections() {
  try {
    const { data } = await supabase
      .from("home_sections")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data && data.length > 0) {
      const keys = new Set(data.map((s) => s.key));
      const missing = DEFAULT_SECTIONS.filter((s) => !keys.has(s.key));
      return [...data, ...missing].sort(
        (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
      );
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_SECTIONS;
}

export const getHomeSections = unstable_cache(
  fetchHomeSections,
  ["site-sections"],
  {
    revalidate: CONFIG_TTL,
  },
);

async function fetchCategories() {
  try {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    return (data || []).filter((c) => c.is_active !== false);
  } catch {
    return [];
  }
}

export const getCategories = unstable_cache(
  fetchCategories,
  ["site-categories"],
  {
    revalidate: CONFIG_TTL,
  },
);

async function fetchDeliveryZones() {
  try {
    const { data } = await supabase
      .from("delivery_zones")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    return data || [];
  } catch {
    return [];
  }
}

export const getDeliveryZones = unstable_cache(
  fetchDeliveryZones,
  ["site-zones"],
  {
    revalidate: CONFIG_TTL,
  },
);

async function fetchPickupPoints() {
  try {
    const { data } = await supabase
      .from("pickup_points")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    return data || [];
  } catch {
    return [];
  }
}

export const getPickupPoints = unstable_cache(
  fetchPickupPoints,
  ["site-pickup-points"],
  {
    revalidate: CONFIG_TTL,
  },
);

async function fetchDiscountRules() {
  try {
    const { data } = await supabase
      .from("discount_rules")
      .select("*")
      .eq("is_active", true);
    return data || [];
  } catch {
    return [];
  }
}

export const getDiscountRules = unstable_cache(
  fetchDiscountRules,
  ["site-discounts"],
  {
    revalidate: CONFIG_TTL,
  },
);

async function fetchHeroSlides() {
  try {
    const { data } = await supabase
      .from("hero_slides")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    return data || [];
  } catch {
    return [];
  }
}

export const getHeroSlides = unstable_cache(
  fetchHeroSlides,
  ["site-hero-slides"],
  {
    revalidate: CONFIG_TTL,
  },
);

async function fetchCategoryCounts() {
  try {
    const { data } = await supabase
      .from("products")
      .select("category_id")
      .eq("is_active", true);
    const countMap = {};
    (data || []).forEach((p) => {
      if (!p.category_id) return;
      countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
    });
    return countMap;
  } catch {
    return {};
  }
}

export const getCategoryCounts = unstable_cache(
  fetchCategoryCounts,
  ["site-category-counts"],
  {
    revalidate: CONFIG_TTL,
  },
);
