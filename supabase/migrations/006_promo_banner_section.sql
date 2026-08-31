-- ============================================================
-- MHFood Store — promo banner section migration
-- ------------------------------------------------------------
-- Adds a "promo" home section that renders a full-width
-- promotional banner after the product sections. The image and
-- link are stored in home_sections.settings (jsonb) and managed
-- from Admin > Settings > Home Sections.
-- Idempotent: safe to run more than once.
-- ============================================================

INSERT INTO public.home_sections (key, title, subtitle, enabled, sort_order, items_per_page)
VALUES
  ('promo', 'Promotional Banner', 'Full-width banner after your products', true, 6, 1)
ON CONFLICT (key) DO UPDATE
SET title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    enabled = EXCLUDED.enabled,
    sort_order = EXCLUDED.sort_order;
