-- ============================================================
-- MHFood Store — logo settings migration
-- ------------------------------------------------------------
-- Adds:
--   1. theme_settings.logo_image — uploadable store logo that
--      renders in the public header, footer, favicon and
--      SEO metadata (site logo / icons).
-- Idempotent: safe to run more than once.
-- ============================================================

-- ---------- 1. theme_settings.logo_image ----------
ALTER TABLE public.theme_settings
  ADD COLUMN IF NOT EXISTS logo_image text;

-- ---------- 2. Ensure the single settings row exists ----------
INSERT INTO public.theme_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
