-- ============================================================
-- MHFood Store — BulkSMSBD settings
-- ------------------------------------------------------------
-- Stores API key and sender ID for order / bulk SMS.
-- Authenticated-only so keys are not readable from the storefront.
-- Idempotent: safe to run more than once.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sms_settings (
  id          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provider    text NOT NULL DEFAULT 'bulksmsbd',
  api_key     text,
  sender_id   text,
  is_enabled  boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.sms_settings;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.sms_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sms_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_anon_all ON public.sms_settings;
DROP POLICY IF EXISTS app_auth_all ON public.sms_settings;
DROP POLICY IF EXISTS sms_settings_auth_all ON public.sms_settings;

CREATE POLICY app_anon_all ON public.sms_settings
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY app_auth_all ON public.sms_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.sms_settings (id, provider, is_enabled)
VALUES (1, 'bulksmsbd', false)
ON CONFLICT (id) DO NOTHING;
