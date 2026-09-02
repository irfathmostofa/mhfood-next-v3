-- ============================================================
-- MHFood Store — expenses module migration
-- ------------------------------------------------------------
-- Adds pre-defined expense types plus an expenses ledger that is
-- managed from Admin > Expenses. Supports date-range and type-wise
-- filtering, pagination and a printable report.
-- Idempotent: safe to run more than once.
-- ============================================================

-- ---------- Expense types (pre-defined) ----------
CREATE TABLE IF NOT EXISTS public.expense_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- Expenses ledger ----------
CREATE TABLE IF NOT EXISTS public.expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_type_id uuid REFERENCES public.expense_types(id) ON DELETE RESTRICT,
  title           text NOT NULL,
  amount          numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  expense_date    timestamptz NOT NULL DEFAULT now(),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS expenses_date_idx ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS expenses_type_idx ON public.expenses(expense_type_id);
CREATE INDEX IF NOT EXISTS expense_types_active_idx ON public.expense_types(is_active);

-- ---------- updated_at trigger ----------
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['expense_types','expenses'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;', tbl
    );
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', tbl
    );
  END LOOP;
END $$;

-- ---------- RLS (matches the rest of the app) ----------
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['expense_types','expenses'] LOOP
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

-- ---------- Seed pre-defined expense types ----------
INSERT INTO public.expense_types (name, description, sort_order)
VALUES
  ('Ingredients & Raw Materials', 'Produce, meat, spices and other raw ingredients', 1),
  ('Packaging & Supplies',        'Bags, boxes, labels and packing materials',        2),
  ('Rent',                        'Shop or store rent',                               3),
  ('Salaries & Wages',            'Staff salaries and wages',                         4),
  ('Utilities',                   'Electricity, water, gas and internet',             5),
  ('Transport & Delivery',        'Fuel, vehicle maintenance and delivery costs',      6),
  ('Marketing & Advertising',     'Ads, promotions and marketing spend',               7),
  ('Equipment & Maintenance',     'Equipment purchase, repair and upkeep',             8),
  ('Miscellaneous',               'Other day-to-day expenses',                         9)
ON CONFLICT (name) DO NOTHING;
