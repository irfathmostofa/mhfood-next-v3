-- Persist Google Search Console verification from Admin > Settings > SEO.
ALTER TABLE public.seo_settings
  ADD COLUMN IF NOT EXISTS google_site_verification text NOT NULL DEFAULT 'Q3JuNXfnFKgNBH8M8uzf3ctObe58JuXVAC5_U2jMCKE';

UPDATE public.seo_settings
SET google_site_verification = 'Q3JuNXfnFKgNBH8M8uzf3ctObe58JuXVAC5_U2jMCKE'
WHERE id = 1
  AND (google_site_verification IS NULL OR btrim(google_site_verification) = '');
