-- ============================================================
-- MHFood Store — Manual parcel orders, product weights & pricing
-- ------------------------------------------------------------
-- Adds:
--   1. products.weight (kg per unit)
--   2. delivery_zones weight pricing (base weight + per-kg add-on)
--   3. orders manual-order / weight / COD fields
--   4. order_items.weight
--   5. customers directory (old + new customers for manual parcels)
--   6. logistics_settings.cod_percent (COD fee paid by admin side)
-- Idempotent: safe to run more than once.
-- ============================================================

-- ---------- 1. Product unit weight ----------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight numeric(10,3) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_weight_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_weight_check CHECK (weight >= 0);
  END IF;
END $$;

-- ---------- 2. Delivery zone weight pricing ----------
-- charge           = base charge for the first base_weight_kg
-- extra_kg_charge  = add-on charged for each extra (started) kg
ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS base_weight_kg numeric(10,3) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS extra_kg_charge numeric(12,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_zones_base_weight_check'
  ) THEN
    ALTER TABLE public.delivery_zones
      ADD CONSTRAINT delivery_zones_base_weight_check CHECK (base_weight_kg >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_zones_extra_kg_check'
  ) THEN
    ALTER TABLE public.delivery_zones
      ADD CONSTRAINT delivery_zones_extra_kg_check CHECK (extra_kg_charge >= 0);
  END IF;
END $$;

-- ---------- 3. Order manual / weight / COD fields ----------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS total_weight numeric(10,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weight_charge numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_weight_kg numeric(10,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cod_percent numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cod_charge numeric(12,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_order_type_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_order_type_check
      CHECK (order_type IN ('online', 'manual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_order_type_idx ON public.orders(order_type);

-- ---------- 4. Order item weight ----------
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS weight numeric(10,3) NOT NULL DEFAULT 0;

-- ---------- 5. Customers directory ----------
CREATE TABLE IF NOT EXISTS public.customers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  phone      text NOT NULL UNIQUE,
  email      text,
  address    text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_phone_idx ON public.customers(phone);
CREATE INDEX IF NOT EXISTS customers_created_at_idx ON public.customers(created_at DESC);

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.customers;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Admin panel and storefront both use the anon key, so mirror the
-- access pattern used by the rest of the public tables.
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_anon_all ON public.customers;
DROP POLICY IF EXISTS app_auth_all ON public.customers;
DROP POLICY IF EXISTS customers_anon_all ON public.customers;
DROP POLICY IF EXISTS customers_auth_all ON public.customers;

CREATE POLICY customers_anon_all ON public.customers
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY customers_auth_all ON public.customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- 6. COD fee percentage (admin bears this cost) ----------
ALTER TABLE public.logistics_settings
  ADD COLUMN IF NOT EXISTS cod_percent numeric(6,3) NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'logistics_settings_cod_percent_check'
  ) THEN
    ALTER TABLE public.logistics_settings
      ADD CONSTRAINT logistics_settings_cod_percent_check CHECK (cod_percent >= 0);
  END IF;
END $$;
