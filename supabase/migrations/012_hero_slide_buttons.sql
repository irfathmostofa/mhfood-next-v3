ALTER TABLE public.hero_slides
  ADD COLUMN IF NOT EXISTS button_label text,
  ADD COLUMN IF NOT EXISTS button_2_label text,
  ADD COLUMN IF NOT EXISTS button_2_url text;
