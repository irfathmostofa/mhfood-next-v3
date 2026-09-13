-- Persist Analytics & Tracking IDs from Admin > Settings > SEO.
ALTER TABLE public.seo_settings
  ADD COLUMN IF NOT EXISTS ga_measurement_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS facebook_pixel_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tiktok_pixel_id text NOT NULL DEFAULT '';
