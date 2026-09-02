-- ============================================================
-- MHFood Store — pickup points
-- ------------------------------------------------------------
-- Customers can collect orders from a store pickup point instead
-- of home delivery. Idempotent: safe to run more than once.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pickup_points (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  address    text NOT NULL DEFAULT '',
  phone      text,
  hours      text,
  is_active  boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_method text NOT NULL DEFAULT 'delivery';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_fulfillment_method_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_fulfillment_method_check
      CHECK (fulfillment_method IN ('delivery', 'pickup'));
  END IF;
END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_point_id uuid REFERENCES public.pickup_points(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_point_name text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_point_address text;

CREATE INDEX IF NOT EXISTS pickup_points_active_idx ON public.pickup_points(is_active);
CREATE INDEX IF NOT EXISTS orders_fulfillment_method_idx ON public.orders(fulfillment_method);
CREATE INDEX IF NOT EXISTS orders_pickup_point_id_idx ON public.orders(pickup_point_id);

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.pickup_points;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.pickup_points
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  ALTER TABLE public.pickup_points ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS app_anon_all ON public.pickup_points;
  CREATE POLICY app_anon_all ON public.pickup_points
    FOR ALL TO anon USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS app_auth_all ON public.pickup_points;
  CREATE POLICY app_auth_all ON public.pickup_points
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;
