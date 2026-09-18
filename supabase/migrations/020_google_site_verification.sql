-- Persist Google Search Console verification from Admin > Settings > SEO.
ALTER TABLE public.seo_settings
  ADD COLUMN IF NOT EXISTS google_site_verification text NOT NULL DEFAULT '';


