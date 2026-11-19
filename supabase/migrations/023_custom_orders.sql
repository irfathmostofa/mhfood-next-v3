-- ============================================================
-- MHFood Store — custom orders
-- ------------------------------------------------------------
-- Customers submit a custom order request (message + optional
-- file up to 2MB and/or Google Drive link). Admin reviews it in
-- Admin > Custom Orders and gets an email on every submission.
--
-- Security model (stricter than the rest of the app):
--   * anon          -> INSERT only (no read / update / delete)
--   * authenticated -> full access (admin session)
--   * files live in a PRIVATE bucket; admin reads via signed URLs
-- Idempotent: safe to run more than once.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.custom_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  phone         text NOT NULL,
  email         text,
  message       text NOT NULL,
  file_path     text,
  file_name     text,
  file_size     integer CHECK (file_size IS NULL OR file_size <= 2097152),
  file_mime     text,
  drive_url     text,
  status        text NOT NULL DEFAULT 'new'
                CHECK (status IN ('new','contacted','quoted','confirmed','completed','cancelled')),
  admin_note    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_orders_created_idx ON public.custom_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS custom_orders_status_idx  ON public.custom_orders(status);

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.custom_orders;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.custom_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- RLS ----------
ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_orders_anon_insert ON public.custom_orders;
CREATE POLICY custom_orders_anon_insert ON public.custom_orders
  FOR INSERT TO anon
  WITH CHECK (status = 'new' AND admin_note IS NULL);

DROP POLICY IF EXISTS custom_orders_auth_all ON public.custom_orders;
CREATE POLICY custom_orders_auth_all ON public.custom_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- Private storage bucket (2MB, documents + images) ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'custom-order-files',
  'custom-order-files',
  false,
  2097152,
  ARRAY[
    'image/png','image/jpeg','image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 2097152,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  -- customers (anon) can only upload; they can never list/read/delete
  EXECUTE 'DROP POLICY IF EXISTS custom_files_anon_insert ON storage.objects';
  EXECUTE 'CREATE POLICY custom_files_anon_insert ON storage.objects
           FOR INSERT TO anon WITH CHECK (bucket_id = ''custom-order-files'')';

  -- admin (authenticated) can read (signed URLs), upload and delete
  EXECUTE 'DROP POLICY IF EXISTS custom_files_auth_select ON storage.objects';
  EXECUTE 'CREATE POLICY custom_files_auth_select ON storage.objects
           FOR SELECT TO authenticated USING (bucket_id = ''custom-order-files'')';

  EXECUTE 'DROP POLICY IF EXISTS custom_files_auth_insert ON storage.objects';
  EXECUTE 'CREATE POLICY custom_files_auth_insert ON storage.objects
           FOR INSERT TO authenticated WITH CHECK (bucket_id = ''custom-order-files'')';

  EXECUTE 'DROP POLICY IF EXISTS custom_files_auth_delete ON storage.objects';
  EXECUTE 'CREATE POLICY custom_files_auth_delete ON storage.objects
           FOR DELETE TO authenticated USING (bucket_id = ''custom-order-files'')';
END $$;