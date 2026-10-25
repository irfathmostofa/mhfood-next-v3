-- ============================================================
-- MHFood Store — shop location based delivery charges
-- ------------------------------------------------------------
-- Adds:
--   1. Shop origin on site_settings
--   2. Editable charge tiers relative to the shop
--   3. delivery_locations for extra areas and charge overrides
-- Idempotent: safe to run more than once.
-- ============================================================

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS shop_location_key text,
  ADD COLUMN IF NOT EXISTS shop_division text,
  ADD COLUMN IF NOT EXISTS shop_district text,
  ADD COLUMN IF NOT EXISTS shop_area text,
  ADD COLUMN IF NOT EXISTS delivery_same_area_charge numeric(12,2) NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS delivery_same_district_charge numeric(12,2) NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS delivery_same_division_charge numeric(12,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS delivery_outside_charge numeric(12,2) NOT NULL DEFAULT 130,
  ADD COLUMN IF NOT EXISTS delivery_remote_charge numeric(12,2) NOT NULL DEFAULT 160;

CREATE TABLE IF NOT EXISTS public.delivery_locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_key  text NOT NULL UNIQUE,
  division      text NOT NULL,
  district      text NOT NULL,
  area          text NOT NULL,
  charge        numeric(12,2),
  is_remote     boolean NOT NULL DEFAULT false,
  is_custom     boolean NOT NULL DEFAULT true,
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_locations_active_idx
  ON public.delivery_locations(is_active);
CREATE INDEX IF NOT EXISTS delivery_locations_sort_idx
  ON public.delivery_locations(sort_order, division, district, area);

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.delivery_locations;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.delivery_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.delivery_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_anon_all ON public.delivery_locations;
CREATE POLICY app_anon_all ON public.delivery_locations
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS app_auth_all ON public.delivery_locations;
CREATE POLICY app_auth_all ON public.delivery_locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
