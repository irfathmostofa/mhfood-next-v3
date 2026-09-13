"use client";

import { useEffect, useState } from "react";
import {
  Trash2,
  Save,
  Loader2,
  ArrowUp,
  ArrowDown,
  Palette,
  Search,
  Phone,
  Layout,
  Tag,
  Truck,
  Percent,
  MapPin,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_THEME, THEME_PRESETS, matchThemePreset } from "@/lib/theme";
import { DEFAULT_SEO } from "@/lib/defaults";
import ImageUploader from "./ImageUploader";
import Pagination from "./Pagination";
import AdminHero from "./AdminHero";
import { useToast } from "@/components/Toast";

const TABS = [
  {
    id: "appearance",
    label: "Appearance",
    short: "Theme",
    icon: Palette,
    hint: "Logo, colors, store name",
  },
  {
    id: "seo",
    label: "SEO",
    short: "SEO",
    icon: Search,
    hint: "Titles, keywords, pixels",
  },
  {
    id: "contact",
    label: "Contact",
    short: "Contact",
    icon: Phone,
    hint: "Phone, address, free delivery",
  },
  {
    id: "sections",
    label: "Home Sections",
    short: "Home",
    icon: Layout,
    hint: "Slider, banner, homepage blocks",
  },
  {
    id: "coupons",
    label: "Coupons",
    short: "Coupons",
    icon: Tag,
    hint: "Discount codes",
  },
  {
    id: "zones",
    label: "Delivery Zones",
    short: "Zones",
    icon: Truck,
    hint: "Areas and delivery fees",
  },
  {
    id: "pickup",
    label: "Pickup Points",
    short: "Pickup",
    icon: MapPin,
    hint: "Store collection locations",
  },
  {
    id: "rules",
    label: "Discount Rules",
    short: "Rules",
    icon: Percent,
    hint: "Automatic cart discounts",
  },
  {
    id: "sms",
    label: "SMS",
    short: "SMS",
    icon: MessageSquare,
    hint: "BulkSMSBD API key and sender ID",
  },
];

export default function AdminSettings() {
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("appearance");

  const [theme, setTheme] = useState(null);
  const [seo, setSeo] = useState(null);
  const [site, setSite] = useState(null);
  const [sections, setSections] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [zones, setZones] = useState([]);
  const [pickupPoints, setPickupPoints] = useState([]);
  const [rules, setRules] = useState([]);

  function switchTab(id) {
    setActiveTab(id);
    try {
      localStorage.setItem("adminSettingsTab", id);
    } catch {
      // ignore storage errors (private mode etc.)
    }
  }

  useEffect(() => {
    loadAll();
    try {
      const saved = localStorage.getItem("adminSettingsTab");
      if (saved === "banner") {
        setActiveTab("sections");
      } else if (saved && TABS.some((t) => t.id === saved)) {
        setActiveTab(saved);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  async function loadAll() {
    const [
      { data: themeData },
      { data: seoData },
      { data: siteData },
      { data: sectionsData },
      { data: couponsData },
      { data: zonesData },
      { data: pickupData },
      { data: rulesData },
    ] = await Promise.all([
      supabase.from("theme_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("seo_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("home_sections")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("delivery_zones")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase
        .from("pickup_points")
        .select("*")
        .order("sort_order", { ascending: true })
        .then((res) => (res.error ? { data: [] } : res)),
      supabase
        .from("discount_rules")
        .select("*")
        .order("sort_order", { ascending: true }),
    ]);

    setTheme({ ...DEFAULT_THEME, ...(themeData || {}) });
    setSeo({ ...DEFAULT_SEO, ...(seoData || {}) });
    setSite(siteData || {});
    let nextSections = sectionsData || [];
    const existingKeys = new Set(nextSections.map((s) => s.key));
    const toInsert = MISSING_HOME_SECTIONS.filter(
      (s) => !existingKeys.has(s.key),
    );
    if (toInsert.length > 0) {
      const { data: inserted } = await supabase
        .from("home_sections")
        .insert(toInsert)
        .select();
      if (inserted?.length) {
        nextSections = [...nextSections, ...inserted].sort(
          (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
        );
      }
    }
    setSections(nextSections);
    setCoupons(couponsData || []);
    setZones(zonesData || []);
    setPickupPoints(pickupData || []);
    setRules(rulesData || []);
    setLoading(false);
  }

  function showFlash(msg) {
    if (/^error:/i.test(String(msg || ""))) {
      toastError(String(msg).replace(/^error:\s*/i, ""));
      return;
    }
    success(msg);
  }

  async function saveAll(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const seoPayload = {
        ...seo,
        ga_measurement_id: String(seo.ga_measurement_id || "").trim(),
        facebook_pixel_id: String(seo.facebook_pixel_id || "").trim(),
        tiktok_pixel_id: String(seo.tiktok_pixel_id || "").trim(),
      };
      const updates = await Promise.all([
        supabase.from("theme_settings").update(theme).eq("id", 1),
        supabase.from("seo_settings").update(seoPayload).eq("id", 1),
        supabase.from("site_settings").update(site).eq("id", 1),
      ]);
      const failed = updates.find((res) => res.error);
      if (failed?.error) throw failed.error;
      showFlash("Settings saved.");
    } catch (err) {
      setError(err.message);
      toastError(err.message);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <p className="text-sm text-muted py-10 text-center">
        Loading settings...
      </p>
    );
  }

  const activeMeta = TABS.find((t) => t.id === activeTab);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display text-ink">Settings</h1>
        <p className="text-sm text-muted mt-1">
          Storefront, checkout, and marketing options.
        </p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}

      <div className="flex flex-col lg:flex-row lg:items-start gap-5 lg:gap-8">
        <nav className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-1 gap-2 lg:w-56 xl:w-64 shrink-0 lg:sticky lg:top-8">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchTab(tab.id)}
                className={`flex flex-col lg:flex-row items-center lg:items-start gap-1.5 lg:gap-3 rounded-xl border px-2.5 py-3 lg:px-3.5 lg:py-3 text-center lg:text-left transition-colors ${
                  isActive
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-surface text-ink border-line hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <tab.icon
                  size={16}
                  className={`shrink-0 ${isActive ? "text-white" : "text-accent"}`}
                />
                <span className="min-w-0">
                  <span className="block text-[11px] sm:text-xs lg:hidden font-medium leading-tight">
                    {tab.short}
                  </span>
                  <span className="hidden lg:block text-sm font-medium leading-tight">
                    {tab.label}
                  </span>
                  <span
                    className={`hidden lg:block text-[11px] mt-0.5 leading-snug ${
                      isActive ? "text-white/70" : "text-muted"
                    }`}
                  >
                    {tab.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0 max-w-3xl">
          {activeMeta && (
            <div className="lg:hidden mb-4">
              <h2 className="text-base font-semibold text-ink">
                {activeMeta.label}
              </h2>
              <p className="text-xs text-muted mt-0.5">{activeMeta.hint}</p>
            </div>
          )}
          {activeTab === "appearance" && (
            <form onSubmit={saveAll} className="space-y-6">
              <ThemeForm theme={theme} setTheme={setTheme} />
              <div className="flex justify-stretch sm:justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary disabled:opacity-60 w-full sm:w-auto"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Save Appearance
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === "seo" && (
            <form onSubmit={saveAll} className="space-y-6">
              <SeoForm seo={seo} setSeo={setSeo} />
              <div className="flex justify-stretch sm:justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary disabled:opacity-60 w-full sm:w-auto"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Save SEO
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === "contact" && (
            <form onSubmit={saveAll} className="space-y-6">
              <ContactForm site={site} setSite={setSite} />
              <div className="flex justify-stretch sm:justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary disabled:opacity-60 w-full sm:w-auto"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Save Contact Settings
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === "sections" && (
            <SectionsManager
              sections={sections}
              setSections={setSections}
              site={site}
              setSite={setSite}
              showFlash={showFlash}
            />
          )}

          {activeTab === "coupons" && (
            <CouponsManager
              coupons={coupons}
              setCoupons={setCoupons}
              showFlash={showFlash}
            />
          )}

          {activeTab === "zones" && (
            <ZonesManager
              zones={zones}
              setZones={setZones}
              showFlash={showFlash}
            />
          )}

          {activeTab === "pickup" && (
            <PickupPointsManager
              points={pickupPoints}
              setPoints={setPickupPoints}
              showFlash={showFlash}
            />
          )}

          {activeTab === "rules" && (
            <RulesManager
              rules={rules}
              setRules={setRules}
              showFlash={showFlash}
            />
          )}

          {activeTab === "sms" && <SmsSettingsManager showFlash={showFlash} />}
        </div>
      </div>
    </div>
  );
}

// ---------- Theme ----------
function ThemeForm({ theme, setTheme }) {
  function set(key, value) {
    setTheme((prev) => ({ ...prev, [key]: value }));
  }

  const colors = [
    ["primary_color", "Primary color"],
    ["accent_color", "Accent color"],
    ["background_color", "Background color"],
    ["surface_color", "Surface color"],
    ["text_color", "Text color"],
    ["muted_color", "Muted text color"],
    ["border_color", "Border color"],
  ];

  const activePreset = matchThemePreset(theme);

  function applyPreset(preset) {
    setTheme((prev) => ({
      ...prev,
      primary_color: preset.primary_color,
      accent_color: preset.accent_color,
      background_color: preset.background_color,
      surface_color: preset.surface_color,
      text_color: preset.text_color,
      muted_color: preset.muted_color,
      border_color: preset.border_color,
    }));
  }

  return (
    <Section title="Appearance">
      <div className="border-b border-line pb-4 mb-2">
        <ImageUploader
          value={theme.logo_image || ""}
          onChange={(v) => set("logo_image", v)}
          folder="logo"
          aspect="square"
          label="Logo"
          hint="Shown in the header, footer, favicon and SEO. Recommended 512x512px transparent PNG or WebP."
        />
      </div>

      <div>
        <label className="label">Theme presets</label>
        <p className="text-xs text-muted mb-3">
          Pick a starter palette, then customize any color below.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {THEME_PRESETS.map((preset) => {
            const selected = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`text-left rounded-xl border p-2.5 transition-colors ${
                  selected
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : "border-line hover:border-primary/40 bg-surface"
                }`}
              >
                <span className="flex h-8 overflow-hidden rounded-lg mb-2">
                  <span
                    className="flex-1"
                    style={{ backgroundColor: preset.primary_color }}
                  />
                  <span
                    className="w-8"
                    style={{ backgroundColor: preset.accent_color }}
                  />
                  <span
                    className="w-8"
                    style={{ backgroundColor: preset.background_color }}
                  />
                </span>
                <span className="block text-xs font-medium text-ink">
                  {preset.name}
                </span>
                <span className="block text-[10px] text-muted leading-snug mt-0.5">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-3 mt-2">
          {activePreset === null ? (
            <p className="text-xs text-muted">Custom palette</p>
          ) : (
            <p className="text-xs text-muted">
              Using {THEME_PRESETS.find((p) => p.id === activePreset)?.name} theme
            </p>
          )}
          <button
            type="button"
            onClick={() => applyPreset(THEME_PRESETS[0])}
            className="text-xs text-accent hover:underline"
          >
            Reset to default
          </button>
        </div>
      </div>

      <div>
        <label className="label">Live preview</label>
        <div
          className="rounded-xl border overflow-hidden"
          style={{
            backgroundColor: theme.background_color || DEFAULT_THEME.background_color,
            borderColor: theme.border_color || DEFAULT_THEME.border_color,
          }}
        >
          <div
            className="px-4 py-2.5 flex items-center justify-between"
            style={{
              backgroundColor: theme.surface_color || DEFAULT_THEME.surface_color,
              borderBottom: `1px solid ${theme.border_color || DEFAULT_THEME.border_color}`,
            }}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: theme.text_color || DEFAULT_THEME.text_color }}
            >
              {theme.store_name || "Your Store"}
            </span>
            <span
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full text-white"
              style={{ backgroundColor: theme.accent_color || DEFAULT_THEME.accent_color }}
            >
              Sale
            </span>
          </div>
          <div className="p-4">
            <p
              className="text-xs mb-3"
              style={{ color: theme.muted_color || DEFAULT_THEME.muted_color }}
            >
              Shop fresh food and groceries online.
            </p>
            <div className="flex gap-2">
              <span
                className="inline-flex text-xs font-medium text-white px-3 py-1.5 rounded-full"
                style={{ backgroundColor: theme.primary_color || DEFAULT_THEME.primary_color }}
              >
                Shop now
              </span>
              <span
                className="inline-flex text-xs font-medium px-3 py-1.5 rounded-full"
                style={{
                  color: theme.primary_color || DEFAULT_THEME.primary_color,
                  border: `1px solid ${theme.border_color || DEFAULT_THEME.border_color}`,
                }}
              >
                Track order
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {colors.map(([key, label]) => (
          <div key={key}>
            <label className="label">{label}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme[key] || "#000000"}
                onChange={(e) => set(key, e.target.value)}
                className="w-9 h-9 rounded-lg border border-line cursor-pointer"
              />
              <input
                value={theme[key] || ""}
                onChange={(e) => set(key, e.target.value)}
                className="input input-sm flex-1"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Store Name</label>
          <input
            value={theme.store_name || ""}
            onChange={(e) => set("store_name", e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Logo Text</label>
          <input
            value={theme.logo_text || ""}
            onChange={(e) => set("logo_text", e.target.value)}
            className="input"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={!!theme.show_announcement_bar}
            onChange={(e) => set("show_announcement_bar", e.target.checked)}
          />
          Show announcement bar
        </label>
         <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={theme.show_header_categories !== false}
            onChange={(e) => set("show_header_categories", e.target.checked)}
          />
          Show header category list
        </label>
      </div>
      <div>
        <label className="label">Announcement Text</label>
        <input
          value={theme.announcement_text || ""}
          onChange={(e) => set("announcement_text", e.target.value)}
          placeholder="e.g. Free delivery on orders over ৳1000"
          className="input"
        />
      </div>
    </Section>
  );
}

// ---------- SEO ----------
function SeoForm({ seo, setSeo }) {
  function set(key, value) {
    setSeo((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Section title="SEO">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Site Name</label>
          <input
            value={seo.site_name || ""}
            onChange={(e) => set("site_name", e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Tagline</label>
          <input
            value={seo.site_tagline || ""}
            onChange={(e) => set("site_tagline", e.target.value)}
            className="input"
          />
        </div>
      </div>
      <div>
        <label className="label">Home Title</label>
        <input
          value={seo.home_title || ""}
          onChange={(e) => set("home_title", e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label className="label">Home Description</label>
        <textarea
          rows={2}
          value={seo.home_description || ""}
          onChange={(e) => set("home_description", e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label className="label">Home Keywords</label>
        <input
          value={seo.home_keywords || ""}
          onChange={(e) => set("home_keywords", e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label className="label">OG Image</label>
        <ImageUploader
          value={seo.og_image || ""}
          onChange={(v) => set("og_image", v)}
          folder="seo"
          aspect="wide"
          hint="Shared image for social shares. Recommended 1200x630px."
        />
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="text-sm font-semibold text-ink mb-1">
          Analytics &amp; Tracking
        </h3>
        <p className="text-xs text-muted mb-4">
          Paste your tracking IDs. Scripts load automatically on every
          storefront page.
        </p>
        <div className="space-y-4">
          <div>
            <label className="label">Google Analytics 4 (Measurement ID)</label>
            <input
              value={seo.ga_measurement_id || ""}
              onChange={(e) => set("ga_measurement_id", e.target.value)}
              placeholder="G-XXXXXXXXXX"
              className="input"
            />
          </div>
          <div>
            <label className="label">Meta (Facebook) Pixel ID</label>
            <input
              value={seo.facebook_pixel_id || ""}
              onChange={(e) => set("facebook_pixel_id", e.target.value)}
              placeholder="1234567890123456"
              className="input"
            />
          </div>
          <div>
            <label className="label">TikTok Pixel ID</label>
            <input
              value={seo.tiktok_pixel_id || ""}
              onChange={(e) => set("tiktok_pixel_id", e.target.value)}
              placeholder="CXXXXXXXXXXXXXXXXXXXXXXX"
              className="input"
            />
          </div>
        </div>
      </div>
    </Section>
  );
}

// ---------- Contact / site ----------
function ContactForm({ site, setSite }) {
  function set(key, value) {
    setSite((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Section title="Contact & Delivery">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-2">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={!!site.whatsapp_enabled}
            onChange={(e) => set("whatsapp_enabled", e.target.checked)}
          />
          Enable WhatsApp button
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={!!site.messenger_enabled}
            onChange={(e) => set("messenger_enabled", e.target.checked)}
          />
          Enable Messenger button
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">WhatsApp Number</label>
          <input
            value={site.whatsapp_number || ""}
            onChange={(e) => set("whatsapp_number", e.target.value)}
            placeholder="8801XXXXXXXXX"
            className="input"
          />
        </div>
        <div>
          <label className="label">Messenger Link</label>
          <input
            value={site.messenger_link || ""}
            onChange={(e) => set("messenger_link", e.target.value)}
            placeholder="https://m.me/..."
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Store Phone</label>
          <input
            value={site.store_phone || ""}
            onChange={(e) => set("store_phone", e.target.value)}
            placeholder="8801XXXXXXXXX"
            className="input"
          />
        </div>
        <div>
          <label className="label">Store Email</label>
          <input
            type="email"
            value={site.store_email || ""}
            onChange={(e) => set("store_email", e.target.value)}
            placeholder="hello@yourstore.com"
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label">Store Address</label>
        <input
          value={site.store_address || ""}
          onChange={(e) => set("store_address", e.target.value)}
          placeholder="Shop number, road, city"
          className="input"
        />
      </div>

      <div>
        <label className="label">Store Description</label>
        <textarea
          rows={2}
          value={site.store_description || ""}
          onChange={(e) => set("store_description", e.target.value)}
          placeholder="Short description shown in the footer"
          className="input"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Facebook URL</label>
          <input
            value={site.facebook_url || ""}
            onChange={(e) => set("facebook_url", e.target.value)}
            placeholder="https://facebook.com/yourstore"
            className="input"
          />
        </div>
        <div>
          <label className="label">Instagram URL</label>
          <input
            value={site.instagram_url || ""}
            onChange={(e) => set("instagram_url", e.target.value)}
            placeholder="https://instagram.com/yourstore"
            className="input"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={!!site.free_delivery_enabled}
            onChange={(e) => set("free_delivery_enabled", e.target.checked)}
          />
          Enable free delivery
        </label>
      </div>
      <div>
        <label className="label">Free Delivery Threshold (৳)</label>
        <input
          type="number"
          min="0"
          value={site.free_delivery_threshold || 0}
          onChange={(e) => set("free_delivery_threshold", e.target.value)}
          className="input"
        />
      </div>
    </Section>
  );
}

// ---------- Home sections ----------
const SECTION_KEYS = {
  hero: "Hero Slider",
  flash_sale: "Discount Session / Flash Sale",
  bestsellers: "Best Selling Products",
  categories: "Shop by Category",
  featured: "Featured Products",
  latest: "New Arrivals",
  promo: "Promotional Banner",
  feature_strip: "Trust Features",
  how_it_works: "How It Works",
  cta: "Call to Action",
};

const STATIC_SECTION_KEYS = [
  "hero",
  "promo",
  "feature_strip",
  "how_it_works",
  "cta",
];

const MISSING_HOME_SECTIONS = [
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

function SectionsManager({ sections, setSections, site, setSite, showFlash }) {
  async function toggle(key, enabled) {
    const updated = sections.map((s) =>
      s.key === key ? { ...s, enabled } : s,
    );
    setSections(updated);
    await supabase.from("home_sections").update({ enabled }).eq("key", key);
  }

  async function saveSection(section) {
    const updated = sections.map((s) => (s.id === section.id ? section : s));
    setSections(updated);
    await supabase
      .from("home_sections")
      .update({
        title: section.title,
        subtitle: section.subtitle,
        items_per_page: section.items_per_page,
      })
      .eq("id", section.id);
  }

  async function saveSectionSettings(section, settings) {
    const updated = { ...section, settings };
    setSections(sections.map((s) => (s.id === section.id ? updated : s)));
    await supabase
      .from("home_sections")
      .update({ settings })
      .eq("id", section.id);
  }

  async function move(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setSections(next);
    await Promise.all(
      next.map((s, i) =>
        supabase
          .from("home_sections")
          .update({ sort_order: i + 1 })
          .eq("id", s.id),
      ),
    );
  }

  return (
    <Section title="Home Page Sections">
      <p className="text-xs text-muted -mt-2">
        Toggle, reorder, and edit homepage blocks. The hero slider and side
        promotional banner live in the Hero Slider section.
      </p>
      <div className="space-y-3">
        {sections.map((section, index) => (
          <div key={section.id} className="border border-line rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  checked={section.enabled}
                  onChange={(e) => toggle(section.key, e.target.checked)}
                />
                {SECTION_KEYS[section.key] || section.key}
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="p-1.5 text-muted hover:text-ink disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === sections.length - 1}
                  className="p-1.5 text-muted hover:text-ink disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
              </div>
            </div>

            {!STATIC_SECTION_KEYS.includes(section.key) && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Title</label>
                    <input
                      value={section.title || ""}
                      onChange={(e) =>
                        saveSection({ ...section, title: e.target.value })
                      }
                      className="input input-sm"
                    />
                  </div>
                  <div>
                    <label className="label">Items</label>
                    <input
                      type="number"
                      min="1"
                      value={section.items_per_page || 8}
                      onChange={(e) =>
                        saveSection({
                          ...section,
                          items_per_page: Number(e.target.value) || 8,
                        })
                      }
                      className="input input-sm"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="label">Subtitle</label>
                  <input
                    value={section.subtitle || ""}
                    onChange={(e) =>
                      saveSection({ ...section, subtitle: e.target.value })
                    }
                    className="input input-sm"
                  />
                </div>
              </>
            )}

            {section.key === "hero" && (
              <div className="mt-4 space-y-5 border-t border-line pt-4">
                <AdminHero embedded />
                <HeroSideBannerEditor
                  site={site}
                  setSite={setSite}
                  showFlash={showFlash}
                />
              </div>
            )}

            {(section.key === "feature_strip" ||
              section.key === "how_it_works" ||
              section.key === "cta") && (
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="label">Title</label>
                  <input
                    value={section.title || ""}
                    onChange={(e) =>
                      saveSection({ ...section, title: e.target.value })
                    }
                    className="input input-sm"
                  />
                </div>
                <div>
                  <label className="label">Subtitle</label>
                  <input
                    value={section.subtitle || ""}
                    onChange={(e) =>
                      saveSection({ ...section, subtitle: e.target.value })
                    }
                    className="input input-sm"
                  />
                </div>
              </div>
            )}

            {section.key === "promo" && (
              <div className="mt-4 space-y-3 border-t border-line pt-4">
                <ImageUploader
                  value={section.settings?.image || ""}
                  onChange={(v) =>
                    saveSectionSettings(section, {
                      ...(section.settings || {}),
                      image: v,
                    })
                  }
                  folder="promo-banner"
                  aspect="wide"
                  label="Full-width Banner Image"
                  hint="Shown as its own homepage section. Recommended 1600x680px."
                />
                <div>
                  <label className="label">Banner Link URL</label>
                  <input
                    value={section.settings?.link || ""}
                    onChange={(e) =>
                      saveSectionSettings(section, {
                        ...(section.settings || {}),
                        link: e.target.value,
                      })
                    }
                    placeholder="/shop?category=..."
                    className="input input-sm"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function HeroSideBannerEditor({ site, setSite, showFlash }) {
  const [saving, setSaving] = useState(false);

  async function persist(patch) {
    const next = { ...site, ...patch };
    setSite(next);
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .update({
        promo_banner_image: next.promo_banner_image || null,
        promo_banner_link: next.promo_banner_link || null,
        promo_banner_enabled: next.promo_banner_enabled !== false,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) showFlash(`Error: ${error.message}`);
  }

  return (
    <div className="border-t border-line pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
        Side Promotional Banner
      </p>
      <p className="text-xs text-muted mb-3">
        Portrait banner on the right of the hero slider. Recommended 600x700px.
        {saving ? " Saving..." : ""}
      </p>
      <label className="flex items-center gap-2 text-sm text-ink mb-3">
        <input
          type="checkbox"
          checked={site?.promo_banner_enabled !== false}
          onChange={(e) => persist({ promo_banner_enabled: e.target.checked })}
        />
        Show on homepage
      </label>
      <ImageUploader
        value={site?.promo_banner_image || ""}
        onChange={(v) => persist({ promo_banner_image: v })}
        folder="promo-banner"
        aspect="square"
        label="Banner Image"
        hint="Shown next to the hero slider on the homepage."
      />
      <div className="mt-3">
        <label className="label">Banner Link URL</label>
        <input
          value={site?.promo_banner_link || ""}
          onChange={(e) =>
            setSite((prev) => ({ ...prev, promo_banner_link: e.target.value }))
          }
          onBlur={(e) => persist({ promo_banner_link: e.target.value })}
          placeholder="/shop?category=..."
          className="input input-sm"
        />
      </div>
    </div>
  );
}

// ---------- Coupons ----------
const EMPTY_COUPON = {
  id: null,
  code: "",
  discount_type: "percentage",
  discount_value: 10,
  min_subtotal: 0,
  max_discount: "",
  starts_at: "",
  ends_at: "",
  usage_limit: 0,
  is_active: true,
};

function CouponsManager({ coupons, setCoupons, showFlash }) {
  const [form, setForm] = useState(EMPTY_COUPON);
  const [saving, setSaving] = useState(false);
  const { paged, pagination } = usePagedList(coupons);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value) || 0,
      min_subtotal: Number(form.min_subtotal) || 0,
      max_discount:
        form.max_discount === "" || form.max_discount === null
          ? null
          : Number(form.max_discount),
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      usage_limit: Number(form.usage_limit) || 0,
      is_active: form.is_active,
    };

    const { error } = form.id
      ? await supabase.from("coupons").update(payload).eq("id", form.id)
      : await supabase.from("coupons").insert(payload);

    if (error) {
      showFlash(`Error: ${error.message}`);
    } else {
      showFlash(form.id ? "Coupon updated." : "Coupon created.");
      setForm(EMPTY_COUPON);
      const { data } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      setCoupons(data || []);
    }
    setSaving(false);
  }

  async function deleteCoupon(coupon) {
    if (!confirm(`Delete coupon ${coupon.code}?`)) return;
    await supabase.from("coupons").delete().eq("id", coupon.id);
    setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
    showFlash("Coupon deleted.");
  }

  function toggleActive(coupon) {
    supabase
      .from("coupons")
      .update({ is_active: !coupon.is_active })
      .eq("id", coupon.id)
      .then(() => {
        setCoupons((prev) =>
          prev.map((c) =>
            c.id === coupon.id ? { ...c, is_active: !c.is_active } : c,
          ),
        );
      });
  }

  return (
    <Section title="Coupons">
      <form
        onSubmit={save}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-dashed border-line rounded-xl p-4 mb-4"
      >
        <div>
          <label className="label">Code</label>
          <input
            value={form.code}
            onChange={(e) =>
              setForm({ ...form, code: e.target.value.toUpperCase() })
            }
            placeholder="SAVE10"
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">Type</label>
          <select
            value={form.discount_type}
            onChange={(e) =>
              setForm({ ...form, discount_type: e.target.value })
            }
            className="input"
          >
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed (৳)</option>
          </select>
        </div>
        <div>
          <label className="label">Value</label>
          <input
            type="number"
            value={form.discount_value}
            onChange={(e) =>
              setForm({ ...form, discount_value: e.target.value })
            }
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">Min Subtotal (৳)</label>
          <input
            type="number"
            value={form.min_subtotal}
            onChange={(e) => setForm({ ...form, min_subtotal: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Max Discount (৳, optional)</label>
          <input
            type="number"
            value={form.max_discount}
            onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Usage Limit (0 = unlimited)</label>
          <input
            type="number"
            value={form.usage_limit}
            onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Start (optional)</label>
          <input
            type="datetime-local"
            value={form.starts_at}
            onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">End (optional)</label>
          <input
            type="datetime-local"
            value={form.ends_at}
            onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
            className="input"
          />
        </div>

        <div className="sm:col-span-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) =>
                setForm({ ...form, is_active: e.target.checked })
              }
            />
            Active
          </label>
          <div className="flex gap-2">
            {form.id && (
              <button
                type="button"
                onClick={() => setForm(EMPTY_COUPON)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary btn-sm disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {form.id ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </form>

      <ul className="divide-y divide-line">
        {paged.map((coupon) => (
          <li
            key={coupon.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2.5"
          >
            <div>
              <p className="text-sm font-medium text-ink">{coupon.code}</p>
              <p className="text-xs text-muted">
                {coupon.discount_type === "percentage"
                  ? `${coupon.discount_value}% off`
                  : `৳${coupon.discount_value} off`}
                {Number(coupon.min_subtotal) > 0
                  ? ` · min ৳${coupon.min_subtotal}`
                  : ""}
                {coupon.usage_limit > 0
                  ? ` · used ${coupon.used_count}/${coupon.usage_limit}`
                  : ` · used ${coupon.used_count}x`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleActive(coupon)}
                className={`px-2.5 py-1 rounded-full text-[11px] border ${
                  coupon.is_active
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-muted border-line"
                }`}
              >
                {coupon.is_active ? "Active" : "Inactive"}
              </button>
              <button
                onClick={() =>
                  setForm({
                    ...coupon,
                    starts_at: coupon.starts_at || "",
                    ends_at: coupon.ends_at || "",
                    max_discount: coupon.max_discount ?? "",
                  })
                }
                className="text-xs text-muted hover:text-ink"
              >
                Edit
              </button>
              <button
                onClick={() => deleteCoupon(coupon)}
                aria-label="Delete coupon"
                className="text-muted hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {pagination}
    </Section>
  );
}

// ---------- Delivery zones ----------
function ZonesManager({ zones, setZones, showFlash }) {
  const [form, setForm] = useState({
    id: null,
    name: "",
    charge: 0,
    is_active: true,
  });
  const { paged, pagination } = usePagedList(zones);

  async function save(e) {
    e.preventDefault();
    const payload = {
      name: form.name,
      charge: Number(form.charge) || 0,
      is_active: form.is_active,
    };
    const { error } = form.id
      ? await supabase.from("delivery_zones").update(payload).eq("id", form.id)
      : await supabase.from("delivery_zones").insert(payload);
    if (error) {
      showFlash(`Error: ${error.message}`);
    } else {
      showFlash(form.id ? "Zone updated." : "Zone added.");
      setForm({ id: null, name: "", charge: 0, is_active: true });
      const { data } = await supabase
        .from("delivery_zones")
        .select("*")
        .order("sort_order", { ascending: true });
      setZones(data || []);
    }
  }

  async function deleteZone(zone) {
    if (!confirm(`Delete delivery zone "${zone.name}"?`)) return;
    await supabase.from("delivery_zones").delete().eq("id", zone.id);
    setZones((prev) => prev.filter((z) => z.id !== zone.id));
    showFlash("Zone deleted.");
  }

  return (
    <Section title="Delivery Zones">
      <form onSubmit={save} className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Zone name (e.g. Dhaka City)"
          className="input"
          required
        />
        <input
          type="number"
          value={form.charge}
          onChange={(e) => setForm({ ...form, charge: e.target.value })}
          placeholder="Charge (৳)"
          className="input sm:w-32"
          required
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="btn btn-primary shrink-0 flex-1 sm:flex-none"
          >
            {form.id ? "Update" : "Add"}
          </button>
          {form.id && (
            <button
              type="button"
              onClick={() =>
                setForm({ id: null, name: "", charge: 0, is_active: true })
              }
              className="btn btn-ghost shrink-0"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <ul className="divide-y divide-line">
        {paged.map((zone) => (
          <li
            key={zone.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2.5"
          >
            <div>
              <p className="text-sm text-ink">{zone.name}</p>
              <p className="text-xs text-muted">৳{zone.charge}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setForm({ ...zone })}
                className="text-xs text-muted hover:text-ink"
              >
                Edit
              </button>
              <button
                onClick={() => deleteZone(zone)}
                aria-label="Delete zone"
                className="text-muted hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {pagination}
    </Section>
  );
}

const EMPTY_PICKUP = {
  id: null,
  name: "",
  address: "",
  phone: "",
  hours: "",
  is_active: true,
};

function PickupPointsManager({ points, setPoints, showFlash }) {
  const [form, setForm] = useState(EMPTY_PICKUP);
  const { paged, pagination } = usePagedList(points);

  async function save(e) {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      phone: form.phone.trim() || null,
      hours: form.hours.trim() || null,
      is_active: form.is_active,
    };
    const { error } = form.id
      ? await supabase.from("pickup_points").update(payload).eq("id", form.id)
      : await supabase.from("pickup_points").insert(payload);
    if (error) {
      showFlash(`Error: ${error.message}`);
    } else {
      showFlash(form.id ? "Pickup point updated." : "Pickup point added.");
      setForm(EMPTY_PICKUP);
      const { data } = await supabase
        .from("pickup_points")
        .select("*")
        .order("sort_order", { ascending: true });
      setPoints(data || []);
    }
  }

  async function deletePoint(point) {
    if (!confirm(`Delete pickup point "${point.name}"?`)) return;
    await supabase.from("pickup_points").delete().eq("id", point.id);
    setPoints((prev) => prev.filter((p) => p.id !== point.id));
    showFlash("Pickup point deleted.");
  }

  function toggleActive(point) {
    supabase
      .from("pickup_points")
      .update({ is_active: !point.is_active })
      .eq("id", point.id)
      .then(() => {
        setPoints((prev) =>
          prev.map((p) =>
            p.id === point.id ? { ...p, is_active: !p.is_active } : p,
          ),
        );
      });
  }

  return (
    <Section title="Pickup Points">
      <p className="text-xs text-muted -mt-2">
        Customers can collect orders from these locations instead of home
        delivery. Pickup is free.
      </p>
      <form
        onSubmit={save}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-dashed border-line rounded-xl p-4 mb-4"
      >
        <div className="sm:col-span-2">
          <label className="label">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. কাঁকন বালার চুড়ি Dhanmondi"
            className="input"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Full street address"
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">Phone (optional)</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="8801XXXXXXXXX"
            className="input"
          />
        </div>
        <div>
          <label className="label">Hours (optional)</label>
          <input
            value={form.hours}
            onChange={(e) => setForm({ ...form, hours: e.target.value })}
            placeholder="e.g. 10am – 8pm"
            className="input"
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <button type="submit" className="btn btn-primary shrink-0">
            {form.id ? "Update" : "Add"}
          </button>
          {form.id && (
            <button
              type="button"
              onClick={() => setForm(EMPTY_PICKUP)}
              className="btn btn-ghost shrink-0"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {points.length === 0 && (
        <p className="text-sm text-muted py-4 text-center">
          No pickup points yet. Add one so customers can collect orders in
          store.
        </p>
      )}
      <ul className="divide-y divide-line">
        {paged.map((point) => (
          <li
            key={point.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2.5"
          >
            <div className="min-w-0 pr-3">
              <p className="text-sm text-ink">{point.name}</p>
              <p className="text-xs text-muted truncate">{point.address}</p>
              {(point.phone || point.hours) && (
                <p className="text-xs text-muted">
                  {[point.phone, point.hours].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => toggleActive(point)}
                className={`px-2.5 py-1 rounded-full text-[11px] border ${
                  point.is_active
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-muted border-line"
                }`}
              >
                {point.is_active ? "Active" : "Inactive"}
              </button>
              <button
                onClick={() =>
                  setForm({
                    ...point,
                    phone: point.phone || "",
                    hours: point.hours || "",
                  })
                }
                className="text-xs text-muted hover:text-ink"
              >
                Edit
              </button>
              <button
                onClick={() => deletePoint(point)}
                aria-label="Delete pickup point"
                className="text-muted hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {pagination}
    </Section>
  );
}

// ---------- Discount rules ----------
function RulesManager({ rules, setRules, showFlash }) {
  const [form, setForm] = useState({
    id: null,
    label: "",
    min_amount: 0,
    max_amount: "",
    discount_type: "fixed",
    discount_value: 0,
    is_active: true,
  });
  const { paged, pagination } = usePagedList(rules);

  async function save(e) {
    e.preventDefault();
    const payload = {
      label: form.label,
      min_amount: Number(form.min_amount) || 0,
      max_amount: form.max_amount === "" ? null : Number(form.max_amount),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value) || 0,
      is_active: form.is_active,
    };
    const { error } = form.id
      ? await supabase.from("discount_rules").update(payload).eq("id", form.id)
      : await supabase.from("discount_rules").insert(payload);
    if (error) {
      showFlash(`Error: ${error.message}`);
    } else {
      showFlash(form.id ? "Rule updated." : "Rule added.");
      setForm({
        id: null,
        label: "",
        min_amount: 0,
        max_amount: "",
        discount_type: "fixed",
        discount_value: 0,
        is_active: true,
      });
      const { data } = await supabase
        .from("discount_rules")
        .select("*")
        .order("sort_order", { ascending: true });
      setRules(data || []);
    }
  }

  async function deleteRule(rule) {
    if (!confirm(`Delete rule "${rule.label}"?`)) return;
    await supabase.from("discount_rules").delete().eq("id", rule.id);
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
    showFlash("Rule deleted.");
  }

  return (
    <Section title="Automatic Discount Rules">
      <p className="text-xs text-muted mb-4">
        Automatically applied when a cart subtotal falls within the range. The
        best single rule wins.
      </p>
      <form
        onSubmit={save}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-dashed border-line rounded-xl p-4 mb-4"
      >
        <div className="sm:col-span-2">
          <label className="label">Label</label>
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="e.g. Ramadan Special"
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">Min Subtotal (৳)</label>
          <input
            type="number"
            value={form.min_amount}
            onChange={(e) => setForm({ ...form, min_amount: e.target.value })}
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">Max Subtotal (৳, optional)</label>
          <input
            type="number"
            value={form.max_amount}
            onChange={(e) => setForm({ ...form, max_amount: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Type</label>
          <select
            value={form.discount_type}
            onChange={(e) =>
              setForm({ ...form, discount_type: e.target.value })
            }
            className="input"
          >
            <option value="fixed">Fixed (৳)</option>
            <option value="percentage">Percentage</option>
          </select>
        </div>
        <div>
          <label className="label">Value</label>
          <input
            type="number"
            value={form.discount_value}
            onChange={(e) =>
              setForm({ ...form, discount_value: e.target.value })
            }
            className="input"
            required
          />
        </div>
        <div className="sm:col-span-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) =>
                setForm({ ...form, is_active: e.target.checked })
              }
            />
            Active
          </label>
          <div className="flex gap-2">
            {form.id && (
              <button
                type="button"
                onClick={() =>
                  setForm({
                    id: null,
                    label: "",
                    min_amount: 0,
                    max_amount: "",
                    discount_type: "fixed",
                    discount_value: 0,
                    is_active: true,
                  })
                }
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn-primary btn-sm">
              <Save size={14} /> {form.id ? "Update" : "Add"}
            </button>
          </div>
        </div>
      </form>

      <ul className="divide-y divide-line">
        {paged.map((rule) => (
          <li
            key={rule.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2.5"
          >
            <div>
              <p className="text-sm text-ink">{rule.label}</p>
              <p className="text-xs text-muted">
                {rule.discount_type === "percentage"
                  ? `${rule.discount_value}%`
                  : `৳${rule.discount_value}`}
                {rule.max_amount != null
                  ? ` · from ৳${rule.min_amount} to ৳${rule.max_amount}`
                  : ` · from ৳${rule.min_amount}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setForm({ ...rule, max_amount: rule.max_amount ?? "" })
                }
                className="text-xs text-muted hover:text-ink"
              >
                Edit
              </button>
              <button
                onClick={() => deleteRule(rule)}
                aria-label="Delete rule"
                className="text-muted hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {pagination}
    </Section>
  );
}

function SmsSettingsManager({ showFlash }) {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({
    is_enabled: false,
    sender_id: "",
    api_key: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/sms/settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data.settings);
      setForm({
        is_enabled: Boolean(data.settings?.is_enabled),
        sender_id: data.settings?.sender_id || "",
        api_key: "",
      });
    } catch (err) {
      setError(
        err.message ||
          "Could not load SMS settings. Run 014_sms_settings.sql first.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/sms/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data.settings);
      setForm((prev) => ({
        ...prev,
        is_enabled: Boolean(data.settings?.is_enabled),
        sender_id: data.settings?.sender_id || prev.sender_id,
        api_key: "",
      }));
      showFlash("SMS settings saved.");
    } catch (err) {
      const msg = err.message || "Could not save SMS settings.";
      setError(msg);
      showFlash(`Error: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading SMS settings...</p>;
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Section title="BulkSMSBD">
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-ink">
              Enable SMS
            </span>
            <span className="block text-xs text-muted mt-0.5">
              Send order confirmation and delivery messages via BulkSMSBD.
            </span>
          </span>
          <input
            type="checkbox"
            checked={form.is_enabled}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, is_enabled: e.target.checked }))
            }
          />
        </label>
        <div>
          <label className="label">Sender ID</label>
          <input
            className="input"
            value={form.sender_id}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, sender_id: e.target.value }))
            }
            placeholder="Approved BulkSMSBD sender ID"
          />
        </div>
        <div>
          <label className="label">API key</label>
          <input
            className="input"
            type="password"
            value={form.api_key}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, api_key: e.target.value }))
            }
            placeholder={
              settings?.api_key_masked || "Paste BulkSMSBD API key"
            }
          />
          <p className="text-xs text-muted mt-1">
            Leave blank to keep the current key.
            {settings?.env_configured
              ? " Environment keys are used as fallback."
              : ""}
          </p>
        </div>
      </Section>
      <div className="flex justify-stretch sm:justify-end">
        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary disabled:opacity-60 w-full sm:w-auto"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Save size={16} /> Save SMS Settings
            </>
          )}
        </button>
      </div>
    </form>
  );
}

// ---------- Shared section wrapper ----------
function Section({ title, children }) {
  return (
    <div className="card p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-ink mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// ---------- Paginated list ----------
function usePagedList(items, defaultPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = items.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const pagination = (
    <Pagination
      page={currentPage}
      pageSize={pageSize}
      total={items.length}
      onChange={(p, ps) => {
        setPage(p);
        setPageSize(ps);
      }}
    />
  );
  return { paged, pagination };
}
