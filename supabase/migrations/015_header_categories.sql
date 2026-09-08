-- ============================================================
-- header category nav toggle
-- ------------------------------------------------------------
-- Adds theme_settings.show_header_categories so admin can
-- hide or show the category list below the storefront header.
-- Default true preserves current storefront behaviour.
-- Idempotent: safe to run more than once.
-- ============================================================

ALTER TABLE public.theme_settings
  ADD COLUMN IF NOT EXISTS show_header_categories boolean NOT NULL DEFAULT true;

INSERT INTO public.theme_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
