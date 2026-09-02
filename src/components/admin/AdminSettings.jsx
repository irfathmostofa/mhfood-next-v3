"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Palette,
  Search,
  Phone,
  Layout,
  Tag,
  Truck,
  Percent,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import ImageUploader from "./ImageUploader";
import Pagination from "./Pagination";

const TABS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "seo", label: "SEO", icon: Search },
  { id: "contact", label: "Contact & Delivery", icon: Phone },
  { id: "banner", label: "Promo Banner", icon: Layout },
  { id: "sections", label: "Home Sections", icon: Layout },
  { id: "coupons", label: "Coupons", icon: Tag },
  { id: "zones", label: "Delivery Zones", icon: Truck },
  { id: "rules", label: "Discount Rules", icon: Percent },
];

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("appearance");

  const [theme, setTheme] = useState(null);
  const [seo, setSeo] = useState(null);
  const [site, setSite] = useState(null);
  const [sections, setSections] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [zones, setZones] = useState([]);
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
      if (saved && TABS.some((t) => t.id === saved)) {
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
        .from("discount_rules")
        .select("*")
        .order("sort_order", { ascending: true }),
    ]);

    setTheme(themeData || {});
    setSeo(seoData || {});
    setSite(siteData || {});
    setSections(sectionsData || []);
    setCoupons(couponsData || []);
    setZones(zonesData || []);
    setRules(rulesData || []);
    setLoading(false);
  }

  function showFlash(msg) {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  }

  async function saveAll(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      await supabase.from("theme_settings").update(theme).eq("id", 1);
      await supabase.from("seo_settings").update(seo).eq("id", 1);
      await supabase.from("site_settings").update(site).eq("id", 1);
      showFlash("Settings saved.");
    } catch (err) {
      setError(err.message);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display text-ink">Settings</h1>
      </div>

      {flash && (
        <p className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
          {flash}
        </p>
      )}
      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {/* Tabs */}
      <div className="border-b border-line mb-6 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="max-w-3xl">
        {activeTab === "appearance" && (
          <form onSubmit={saveAll} className="space-y-6">
            <ThemeForm theme={theme} setTheme={setTheme} />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary disabled:opacity-60"
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
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary disabled:opacity-60"
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
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary disabled:opacity-60"
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

        {activeTab === "banner" && (
          <form onSubmit={saveAll} className="space-y-6">
            <PromoBannerForm site={site} setSite={setSite} />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} /> Save Banner
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {activeTab === "sections" && (
          <SectionsManager sections={sections} setSections={setSections} />
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

        {activeTab === "rules" && (
          <RulesManager
            rules={rules}
            setRules={setRules}
            showFlash={showFlash}
          />
        )}
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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

      <div className="grid grid-cols-2 gap-4">
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
      <div className="grid grid-cols-2 gap-4">
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
      <div className="flex items-center gap-3 mb-2">
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

      <div className="grid grid-cols-2 gap-4">
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

      <div className="grid grid-cols-2 gap-4">
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

      <div className="grid grid-cols-2 gap-4">
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

// ---------- Homepage promo banner (single banner next to hero slider) ----------
function PromoBannerForm({ site, setSite }) {
  function set(key, value) {
    setSite((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Section title="Homepage Promo Banner">
      <p className="text-xs text-muted">
        The single banner shown on the right side of the homepage hero slider.
        Recommended 600x700px portrait image.
      </p>
      <ImageUploader
        value={site.promo_banner_image || ""}
        onChange={(v) => set("promo_banner_image", v)}
        folder="promo-banner"
        aspect="square"
        label="Banner Image"
        hint="Shown next to the hero slider on the homepage."
      />
      <div>
        <label className="label">Banner Link URL</label>
        <input
          value={site.promo_banner_link || ""}
          onChange={(e) => set("promo_banner_link", e.target.value)}
          placeholder="/shop?category=..."
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
};

function SectionsManager({ sections, setSections }) {
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

            <div className="grid grid-cols-2 gap-3">
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
                  label="Banner Image"
                  hint="Full-width banner shown after your product sections. Recommended 1600x680px."
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
        className="grid grid-cols-2 gap-3 border border-dashed border-line rounded-xl p-4 mb-4"
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

        <div className="col-span-2 flex items-center justify-between">
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
            className="flex items-center justify-between py-2.5"
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
      <form onSubmit={save} className="flex gap-2 mb-4">
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
          className="input w-32"
          required
        />
        <button type="submit" className="btn btn-primary shrink-0">
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
      </form>

      <ul className="divide-y divide-line">
        {paged.map((zone) => (
          <li
            key={zone.id}
            className="flex items-center justify-between py-2.5"
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
        className="grid grid-cols-2 gap-3 border border-dashed border-line rounded-xl p-4 mb-4"
      >
        <div className="col-span-2">
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
        <div className="col-span-2 flex items-center justify-between">
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
            className="flex items-center justify-between py-2.5"
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

// ---------- Shared section wrapper ----------
function Section({ title, children }) {
  return (
    <div className="card p-6">
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
