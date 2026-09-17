-- ============================================================
-- MHFood Store — product enquiry / restock request
-- ------------------------------------------------------------
-- Adds:
--   1. site_settings.enquiry_enabled (show request button when out of stock)
--   2. product_enquiries table for customer restock requests
-- Idempotent: safe to run more than once.
-- ============================================================

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS enquiry_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.product_enquiries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name  text NOT NULL,
  product_slug  text,
  customer_name text NOT NULL,
  phone         text NOT NULL,
  email         text,
  quantity      integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  message       text,
  status        text NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'contacted', 'closed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_enquiries_created_idx
  ON public.product_enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS product_enquiries_status_idx
  ON public.product_enquiries(status);
CREATE INDEX IF NOT EXISTS product_enquiries_product_idx
  ON public.product_enquiries(product_id);

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.product_enquiries;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.product_enquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.product_enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_anon_all ON public.product_enquiries;
CREATE POLICY app_anon_all ON public.product_enquiries
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS app_auth_all ON public.product_enquiries;
CREATE POLICY app_auth_all ON public.product_enquiries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
