-- ============================================================
-- MHFood Store — Steadfast logistics / courier parcels
-- ------------------------------------------------------------
-- Adds:
--   1. Courier consignment fields on orders
--   2. logistics_settings (API keys, admin-only via authenticated RLS)
-- Idempotent: safe to run more than once.
-- ============================================================

-- ---------- 1. Order courier fields ----------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS consignment_id bigint,
  ADD COLUMN IF NOT EXISTS courier_tracking_code text,
  ADD COLUMN IF NOT EXISTS courier_status text,
  ADD COLUMN IF NOT EXISTS courier_invoice text,
  ADD COLUMN IF NOT EXISTS parcel_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS parcel_note text,
  ADD COLUMN IF NOT EXISTS courier_delivery_type integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courier_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_consignment_id_idx ON public.orders(consignment_id);
CREATE INDEX IF NOT EXISTS orders_courier_status_idx ON public.orders(courier_status);

-- ---------- 2. Logistics settings (single row, id = 1) ----------
CREATE TABLE IF NOT EXISTS public.logistics_settings (
  id                     integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provider               text NOT NULL DEFAULT 'steadfast',
  api_key                text,
  secret_key             text,
  is_enabled             boolean NOT NULL DEFAULT false,
  default_delivery_type  integer NOT NULL DEFAULT 0,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.logistics_settings;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.logistics_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.logistics_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_anon_all ON public.logistics_settings;
DROP POLICY IF EXISTS app_auth_all ON public.logistics_settings;
DROP POLICY IF EXISTS logistics_settings_auth_all ON public.logistics_settings;

CREATE POLICY logistics_settings_auth_all ON public.logistics_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.logistics_settings (id, provider, is_enabled, default_delivery_type)
VALUES (1, 'steadfast', false, 0)
ON CONFLICT (id) DO NOTHING;
