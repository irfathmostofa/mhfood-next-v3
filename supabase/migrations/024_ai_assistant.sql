-- ============================================================
-- MHFood Store — AI chat assistant
-- ------------------------------------------------------------
--   1. site_settings.ai_assistant_enabled  (admin on/off switch)
--   2. assistant_logs  (one row per chat turn: cost / quality review)
--      * anon          -> INSERT only, customer rows only
--      * authenticated -> full access (admin)
-- Idempotent: safe to run more than once.
-- ============================================================

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS ai_assistant_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.assistant_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode         text NOT NULL CHECK (mode IN ('customer', 'admin')),
  user_message text,
  reply        text,
  tools        jsonb NOT NULL DEFAULT '[]'::jsonb,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assistant_logs_created_idx
  ON public.assistant_logs(created_at DESC);

ALTER TABLE public.assistant_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assistant_logs_anon_insert ON public.assistant_logs;
CREATE POLICY assistant_logs_anon_insert ON public.assistant_logs
  FOR INSERT TO anon WITH CHECK (mode = 'customer');

DROP POLICY IF EXISTS assistant_logs_auth_all ON public.assistant_logs;
CREATE POLICY assistant_logs_auth_all ON public.assistant_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);