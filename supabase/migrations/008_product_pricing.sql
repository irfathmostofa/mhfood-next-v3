-- ============================================================
-- MHFood Store — product pricing migration
-- ------------------------------------------------------------
-- Adds cost (your purchase cost) and regular_price (list price)
-- to products. The existing `price` column remains the selling
-- price that customers actually pay and that flows through cart,
-- checkout and orders.
-- Idempotent: safe to run more than once.
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost >= 0);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS regular_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (regular_price >= 0);
