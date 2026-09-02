-- ============================================================
-- MHFood Store — discount sessions (flash sale / campaign)
-- ------------------------------------------------------------
-- Timed campaigns with a name, period and per-product discounts.
-- A global percentage can be applied to all selected products;
-- individual products can override with their own % or amount.
-- Idempotent: safe to run more than once.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.discount_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text NOT NULL UNIQUE,
  subtitle      text,
  style         text NOT NULL DEFAULT 'flash'
                CHECK (style IN ('flash', 'blackfriday', 'sale')),
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.discount_session_products (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid NOT NULL REFERENCES public.discount_sessions(id) ON DELETE CASCADE,
  product_id     uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  discount_type  text NOT NULL DEFAULT 'percentage'
                 CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, product_id)
);

CREATE INDEX IF NOT EXISTS discount_sessions_live_idx
  ON public.discount_sessions(is_active, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS discount_session_products_session_idx
  ON public.discount_session_products(session_id);

CREATE INDEX IF NOT EXISTS discount_session_products_product_idx
  ON public.discount_session_products(product_id);

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.discount_sessions;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.discount_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['discount_sessions','discount_session_products'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

    EXECUTE format('DROP POLICY IF EXISTS app_anon_all ON public.%I;', tbl);
    EXECUTE format(
      'CREATE POLICY app_anon_all ON public.%I
       FOR ALL TO anon USING (true) WITH CHECK (true);', tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS app_auth_all ON public.%I;', tbl);
    EXECUTE format(
      'CREATE POLICY app_auth_all ON public.%I
       FOR ALL TO authenticated USING (true) WITH CHECK (true);', tbl
    );
  END LOOP;
END $$;

INSERT INTO public.home_sections (key, title, subtitle, enabled, sort_order, items_per_page)
VALUES ('flash_sale', 'Flash Sale', 'Limited-time campaign offers', true, 2, 10)
ON CONFLICT (key) DO NOTHING;
