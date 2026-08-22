-- ============================================================
-- MHFood Store — site updates migration
-- ------------------------------------------------------------
-- Adds:
--   1. Missing site_settings fields (store email/address,
--      description, social links, homepage promo banner)
--   2. categories.parent_id for parent/child (mega menu footer)
--   3. A public Supabase storage bucket ("store-images") used by
--      the admin image uploader, with RLS policies so the anon
--      key (storefront + admin panel) can read/write.
-- Idempotent: safe to run more than once.
-- ============================================================

-- ---------- 1. site_settings missing fields ----------
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS store_email text,
  ADD COLUMN IF NOT EXISTS store_address text,
  ADD COLUMN IF NOT EXISTS store_description text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS promo_banner_image text,
  ADD COLUMN IF NOT EXISTS promo_banner_link text;

-- ---------- 2. categories parent/child ----------
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON public.categories(parent_id);

-- ---------- 3. Storage bucket + policies ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-images',
  'store-images',
  true,
  5242880,
  ARRAY['image/png','image/jpeg','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  -- Public read for everyone
  EXECUTE 'DROP POLICY IF EXISTS store_images_public_read ON storage.objects';
  EXECUTE 'CREATE POLICY store_images_public_read ON storage.objects
           FOR SELECT USING (bucket_id = ''store-images'')';

  -- anon writes (storefront + admin panel run on the anon key)
  EXECUTE 'DROP POLICY IF EXISTS store_images_anon_write ON storage.objects';
  EXECUTE 'CREATE POLICY store_images_anon_write ON storage.objects
           FOR INSERT TO anon WITH CHECK (bucket_id = ''store-images'')';
  EXECUTE 'DROP POLICY IF EXISTS store_images_anon_update ON storage.objects';
  EXECUTE 'CREATE POLICY store_images_anon_update ON storage.objects
           FOR UPDATE TO anon USING (bucket_id = ''store-images'')';
  EXECUTE 'DROP POLICY IF EXISTS store_images_anon_delete ON storage.objects';
  EXECUTE 'CREATE POLICY store_images_anon_delete ON storage.objects
           FOR DELETE TO anon USING (bucket_id = ''store-images'')';

  -- authenticated (server-side admin client)
  EXECUTE 'DROP POLICY IF EXISTS store_images_auth_write ON storage.objects';
  EXECUTE 'CREATE POLICY store_images_auth_write ON storage.objects
           FOR INSERT TO authenticated WITH CHECK (bucket_id = ''store-images'')';
  EXECUTE 'DROP POLICY IF EXISTS store_images_auth_update ON storage.objects';
  EXECUTE 'CREATE POLICY store_images_auth_update ON storage.objects
           FOR UPDATE TO authenticated USING (bucket_id = ''store-images'')';
  EXECUTE 'DROP POLICY IF EXISTS store_images_auth_delete ON storage.objects';
  EXECUTE 'CREATE POLICY store_images_auth_delete ON storage.objects
           FOR DELETE TO authenticated USING (bucket_id = ''store-images'')';
END $$;
