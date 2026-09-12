-- Hide/show homepage hero side promotional banner without removing the image.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS promo_banner_enabled boolean NOT NULL DEFAULT true;
