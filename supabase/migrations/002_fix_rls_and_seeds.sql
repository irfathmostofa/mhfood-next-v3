-- ============================================================
-- MHFood Store — fix RLS + seed default rows
-- Fixes:
--   1. Admin writes blocked by RLS on new/legacy tables
--      (coupons, products, home_sections, ...) — anon key is
--      used by the app (matching the existing orders behavior).
--   2. Missing seed rows for home_sections / theme_settings /
--      seo_settings so the storefront renders sections by default.
-- Idempotent: safe to run more than once.
-- ============================================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'products', 'product_images', 'categories',
    'orders', 'order_items', 'reviews',
    'hero_slides', 'site_settings', 'delivery_zones', 'discount_rules',
    'product_variants', 'coupons', 'home_sections',
    'theme_settings', 'seo_settings'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

    -- anon: full access (the storefront + admin panel run on the anon key)
    EXECUTE format('DROP POLICY IF EXISTS app_anon_all ON public.%I;', tbl);
    EXECUTE format(
      'CREATE POLICY app_anon_all ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true);',
      tbl
    );

    -- authenticated: full access (server-side admin client)
    EXECUTE format('DROP POLICY IF EXISTS app_auth_all ON public.%I;', tbl);
    EXECUTE format(
      'CREATE POLICY app_auth_all ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
      tbl
    );
  END LOOP;
END $$;

-- ---------- Seed home sections ----------
INSERT INTO public.home_sections (key, title, subtitle, enabled, sort_order, items_per_page)
VALUES
  ('hero', 'Featured', 'Showcase your hero banner', true, 1, 1),
  ('bestsellers', 'Best Selling Products', 'Our customers'' favorites', true, 2, 12),
  ('categories', 'Shop by Category', 'Browse our collections', true, 3, 12),
  ('featured', 'Featured Products', 'Handpicked for you', true, 4, 8),
  ('latest', 'New Arrivals', 'Fresh in store', true, 5, 8)
ON CONFLICT (key) DO UPDATE
SET title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    enabled = EXCLUDED.enabled,
    sort_order = EXCLUDED.sort_order,
    items_per_page = EXCLUDED.items_per_page;

-- ---------- Seed theme settings ----------
INSERT INTO public.theme_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ---------- Seed SEO settings ----------
INSERT INTO public.seo_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
