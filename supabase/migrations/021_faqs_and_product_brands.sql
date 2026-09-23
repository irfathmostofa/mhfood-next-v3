-- ============================================================
-- MHFood Store — FAQs + optional product brands
-- ------------------------------------------------------------
-- Adds:
--   1. faqs table (public FAQ page + admin CRUD)
--   2. brands table (optional product brand)
--   3. products.brand_id (nullable)
-- Idempotent: safe to run more than once.
-- ============================================================

-- ---------- Brands ----------
CREATE TABLE IF NOT EXISTS public.brands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  image_url   text,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brands_sort_idx ON public.brands(sort_order, name);
CREATE INDEX IF NOT EXISTS brands_active_idx ON public.brands(is_active);

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.brands;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS products_brand_idx ON public.products(brand_id);

-- ---------- FAQs ----------
CREATE TABLE IF NOT EXISTS public.faqs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question   text NOT NULL,
  answer     text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS faqs_sort_idx ON public.faqs(sort_order, created_at);
CREATE INDEX IF NOT EXISTS faqs_active_idx ON public.faqs(is_active);

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.faqs;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_anon_all ON public.brands;
CREATE POLICY app_anon_all ON public.brands
  FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS app_auth_all ON public.brands;
CREATE POLICY app_auth_all ON public.brands
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_anon_all ON public.faqs;
CREATE POLICY app_anon_all ON public.faqs
  FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS app_auth_all ON public.faqs;
CREATE POLICY app_auth_all ON public.faqs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.faqs (question, answer, sort_order, is_active)
SELECT * FROM (VALUES
  (
    'How do I place an order?',
    '<p>Browse the shop, add items to your cart, then go to checkout. Enter your name, phone and delivery address (or pick a pickup point) and place the order. You will receive a tracking code to follow your order.</p>',
    1,
    true
  ),
  (
    'How can I track my order?',
    '<p>Use the <strong>Track Order</strong> page and enter the tracking code you received after checkout. You can also tap Track Order in the header or footer at any time.</p>',
    2,
    true
  ),
  (
    'What payment methods do you accept?',
    '<p>Orders are typically paid as cash on delivery unless the store has enabled another method. If you have a question about payment, contact us before placing the order.</p>',
    3,
    true
  ),
  (
    'How long does delivery take?',
    '<p>Delivery time depends on your zone and courier. After confirmation, most local orders are delivered within 1–3 days. You can follow status updates with your tracking code.</p>',
    4,
    true
  ),
  (
    'Can I cancel or change my order?',
    '<p>Please contact us as soon as possible with your tracking code. We can usually change or cancel an order before it is packed or handed to the courier.</p>',
    5,
    true
  )
) AS seed(question, answer, sort_order, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.faqs LIMIT 1);

INSERT INTO public.home_sections (key, title, subtitle, enabled, sort_order, items_per_page)
VALUES (
  'faq',
  'Frequently asked questions',
  'Quick answers about ordering, delivery and tracking.',
  false,
  10,
  6
)
ON CONFLICT (key) DO NOTHING;
