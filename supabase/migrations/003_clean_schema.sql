-- ============================================================
-- MHFood Store — clean schema (self-contained, idempotent)
-- ------------------------------------------------------------
-- Everything below can be run from the Supabase SQL editor on a
-- fresh project (or re-run safely on an existing one).
--
-- Covers:
--   1. Tables with proper types, constraints, defaults & indexes
--   2. updated_at trigger on every table that has updated_at
--   3. Triggers that keep product_ratings / product_order_counts
--      in sync from reviews / order_items
--   4. RLS enabled with documented policies (app runs on the
--      anon key — storefront + admin write via the same client)
--   5. Sensible seed data so the storefront renders immediately
-- ============================================================

-- ---------- Extensions ----------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. TABLES
-- ============================================================

-- ---------- Categories ----------
CREATE TABLE IF NOT EXISTS public.categories (
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

-- ---------- Products ----------
CREATE TABLE IF NOT EXISTS public.products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  price       numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock       integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  unit        text,
  is_featured boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- Product images ----------
CREATE TABLE IF NOT EXISTS public.product_images (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url  text NOT NULL,
  alt_text   text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Product variants ----------
CREATE TABLE IF NOT EXISTS public.product_variants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name             text NOT NULL,
  value            text NOT NULL,
  price_adjustment numeric(12,2) NOT NULL DEFAULT 0,
  stock            integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sku              text,
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, name, value)
);

-- ---------- Hero slides ----------
CREATE TABLE IF NOT EXISTS public.hero_slides (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text,
  subtitle   text,
  image_url  text,
  link_url   text,
  is_active  boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Delivery zones ----------
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  charge     numeric(12,2) NOT NULL DEFAULT 0 CHECK (charge >= 0),
  is_active  boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Discount rules (automatic) ----------
CREATE TABLE IF NOT EXISTS public.discount_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label          text NOT NULL,
  discount_type  text NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('fixed','percentage')),
  discount_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  min_amount     numeric(12,2) NOT NULL DEFAULT 0 CHECK (min_amount >= 0),
  max_amount     numeric(12,2),
  is_active      boolean NOT NULL DEFAULT true,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------- Coupons ----------
CREATE TABLE IF NOT EXISTS public.coupons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  discount_type   text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('fixed','percentage')),
  discount_value  numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  min_subtotal    numeric(12,2) NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
  max_discount    numeric(12,2),
  starts_at       timestamptz,
  ends_at         timestamptz,
  usage_limit     integer NOT NULL DEFAULT 0 CHECK (usage_limit >= 0),
  used_count      integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------- Orders ----------
CREATE TABLE IF NOT EXISTS public.orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_code      text NOT NULL UNIQUE,
  customer_name      text NOT NULL,
  phone              text NOT NULL,
  email              text,
  address            text,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed','out_for_delivery','delivered','cancelled')),
  delivery_zone_id   uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  delivery_zone_name text,
  delivery_charge    numeric(12,2) NOT NULL DEFAULT 0 CHECK (delivery_charge >= 0),
  discount_amount    numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  discount_label     text,
  coupon_code        text,
  total_amount       numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------- Order items ----------
CREATE TABLE IF NOT EXISTS public.order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id   uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  variant_text text,
  price        numeric(12,2) NOT NULL DEFAULT 0,
  quantity     integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  reviewed     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- Reviews ----------
CREATE TABLE IF NOT EXISTS public.reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid UNIQUE REFERENCES public.order_items(id) ON DELETE SET NULL,
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  rating        integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       text,
  approved      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- Aggregates (kept in sync by triggers) ----------
CREATE TABLE IF NOT EXISTS public.product_ratings (
  product_id   uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  avg_rating   numeric(3,2) NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_order_counts (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  total_sold integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Home sections control ----------
CREATE TABLE IF NOT EXISTS public.home_sections (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key            text NOT NULL UNIQUE,
  title          text,
  subtitle       text,
  enabled        boolean NOT NULL DEFAULT true,
  sort_order     integer NOT NULL DEFAULT 0,
  items_per_page integer NOT NULL DEFAULT 8,
  settings       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------- Site settings (single row, id = 1) ----------
CREATE TABLE IF NOT EXISTS public.site_settings (
  id                       integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_phone              text,
  store_email              text,
  store_address            text,
  whatsapp_enabled         boolean NOT NULL DEFAULT false,
  whatsapp_number          text,
  messenger_enabled        boolean NOT NULL DEFAULT false,
  messenger_link           text,
  free_delivery_enabled    boolean NOT NULL DEFAULT false,
  free_delivery_threshold  numeric(12,2) NOT NULL DEFAULT 0,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ---------- Theme settings (single row, id = 1) ----------
CREATE TABLE IF NOT EXISTS public.theme_settings (
  id                    integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  primary_color         text NOT NULL DEFAULT '#1F2A24',
  accent_color          text NOT NULL DEFAULT '#C77B4C',
  background_color      text NOT NULL DEFAULT '#FBF8F3',
  surface_color         text NOT NULL DEFAULT '#FFFFFF',
  text_color            text NOT NULL DEFAULT '#1F2A24',
  muted_color           text NOT NULL DEFAULT '#8A8578',
  border_color          text NOT NULL DEFAULT '#E7E0D3',
  store_name            text NOT NULL DEFAULT 'MHFood',
  logo_text             text NOT NULL DEFAULT 'MHFood',
  show_announcement_bar boolean NOT NULL DEFAULT false,
  announcement_text     text,
  font_family           text NOT NULL DEFAULT 'fraunces',
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ---------- SEO settings (single row, id = 1) ----------
CREATE TABLE IF NOT EXISTS public.seo_settings (
  id               integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  site_name        text NOT NULL DEFAULT 'MHFood',
  site_tagline     text,
  home_title       text,
  home_description text,
  home_keywords    text,
  og_image         text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 1b. BACKFILL COLUMNS ON PRE-EXISTING TABLES
-- ------------------------------------------------------------
-- Safe on databases that were created before this migration.
-- Never drops data; only adds what the app reads/writes.
-- ============================================================
ALTER TABLE public.products        ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE public.products        ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.products        ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
ALTER TABLE public.categories      ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.categories      ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.categories      ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.hero_slides     ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.hero_slides     ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders          ADD COLUMN IF NOT EXISTS tracking_code text;
ALTER TABLE public.orders          ADD COLUMN IF NOT EXISTS delivery_zone_name text;
ALTER TABLE public.orders          ADD COLUMN IF NOT EXISTS delivery_charge numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders          ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders          ADD COLUMN IF NOT EXISTS discount_label text;
ALTER TABLE public.orders          ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE public.orders          ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.order_items     ADD COLUMN IF NOT EXISTS product_name text;
ALTER TABLE public.order_items     ADD COLUMN IF NOT EXISTS variant_text text;
ALTER TABLE public.order_items     ADD COLUMN IF NOT EXISTS reviewed boolean NOT NULL DEFAULT false;
ALTER TABLE public.reviews         ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS products_category_id_idx   ON public.products(category_id);
CREATE INDEX IF NOT EXISTS products_is_featured_idx   ON public.products(is_featured);
CREATE INDEX IF NOT EXISTS products_is_active_idx     ON public.products(is_active);
CREATE INDEX IF NOT EXISTS product_images_product_idx ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS product_variants_product_idx ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx      ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx          ON public.orders(status);
CREATE INDEX IF NOT EXISTS order_items_order_idx      ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_product_idx    ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS reviews_product_idx        ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS hero_slides_active_idx     ON public.hero_slides(is_active);
CREATE INDEX IF NOT EXISTS coupons_code_idx           ON public.coupons(code);
CREATE INDEX IF NOT EXISTS delivery_zones_active_idx  ON public.delivery_zones(is_active);

-- ============================================================
-- 3. TRIGGERS / FUNCTIONS
-- ============================================================

-- Keep updated_at fresh on any row change.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'categories','products','product_variants','hero_slides',
    'delivery_zones','discount_rules','coupons','orders',
    'product_ratings','product_order_counts','home_sections',
    'site_settings','theme_settings','seo_settings'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;', tbl
    );
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', tbl
    );
  END LOOP;
END $$;

-- Recompute a product's rating aggregate from approved reviews.
CREATE OR REPLACE FUNCTION public.refresh_product_rating(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.product_ratings (product_id, avg_rating, review_count)
  SELECT
    r.product_id,
    COALESCE(AVG(r.rating)::numeric(3,2), 0),
    COUNT(*)
  FROM public.reviews r
  WHERE r.product_id = p_product_id AND r.approved = true
  GROUP BY r.product_id
  ON CONFLICT (product_id)
  DO UPDATE SET
    avg_rating   = EXCLUDED.avg_rating,
    review_count = EXCLUDED.review_count;
END;
$$;

-- Recompute a product's total sold from order items.
CREATE OR REPLACE FUNCTION public.refresh_product_sold(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.product_order_counts (product_id, total_sold)
  SELECT product_id, SUM(quantity)
  FROM public.order_items
  WHERE product_id = p_product_id
  GROUP BY product_id
  ON CONFLICT (product_id)
  DO UPDATE SET total_sold = EXCLUDED.total_sold;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_changed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_product_rating(OLD.product_id);
  ELSE
    PERFORM public.refresh_product_rating(NEW.product_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.order_item_changed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_product_sold(OLD.product_id);
  ELSE
    PERFORM public.refresh_product_sold(NEW.product_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_review_changed ON public.reviews;
CREATE TRIGGER trg_review_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.review_changed();

DROP TRIGGER IF EXISTS trg_order_item_changed ON public.order_items;
CREATE TRIGGER trg_order_item_changed
  AFTER INSERT OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_item_changed();

-- Safe, single-statement stock decrement helpers (atomic, no read-then-write).
-- Each returns TRUE only when enough stock was available and the row was
-- actually decremented, so callers can detect overselling atomically.
CREATE OR REPLACE FUNCTION public.decrement_stock(p_product_id uuid, p_quantity integer)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  ok boolean;
BEGIN
  UPDATE public.products
  SET stock = stock - p_quantity
  WHERE id = p_product_id
    AND stock >= p_quantity
  RETURNING TRUE INTO ok;
  RETURN COALESCE(ok, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_variant_stock(p_variant_id uuid, p_quantity integer)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  ok boolean;
BEGIN
  UPDATE public.product_variants
  SET stock = stock - p_quantity
  WHERE id = p_variant_id
    AND stock >= p_quantity
  RETURNING TRUE INTO ok;
  RETURN COALESCE(ok, FALSE);
END;
$$;

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ------------------------------------------------------------
-- The storefront and the admin panel both run on the anon key
-- (browser client). We therefore give anon and authenticated the
-- same full access. For a locked-down setup, move admin writes to
-- server routes with the service_role key and restrict anon to
-- SELECT on public tables only.
-- ============================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'categories','products','product_images','product_variants',
    'hero_slides','delivery_zones','discount_rules','coupons',
    'orders','order_items','reviews','product_ratings',
    'product_order_counts','home_sections','site_settings',
    'theme_settings','seo_settings'
  ] LOOP
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

-- ============================================================
-- 5. SEED DATA
-- ============================================================

-- ---------- Settings rows ----------
INSERT INTO public.site_settings (id, whatsapp_enabled, messenger_enabled, free_delivery_enabled, free_delivery_threshold)
VALUES (1, false, false, true, 2000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.theme_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seo_settings (id, site_name, site_tagline, home_title, home_description, home_keywords)
VALUES (
  1,
  'MHFood',
  'Fresh groceries and food, delivered to your door.',
  'MHFood — Fresh Food Delivered',
  'Shop fresh vegetables, fruits, meat, bakery and more. Order online in a click and track your delivery the whole way.',
  'food, grocery, fresh food, online store, delivery, bangladesh'
)
ON CONFLICT (id) DO NOTHING;

-- ---------- Home sections ----------
INSERT INTO public.home_sections (key, title, subtitle, enabled, sort_order, items_per_page)
VALUES
  ('hero',        'Featured',                  'Showcase your hero banner',  true,  1, 1),
  ('bestsellers', 'Best Selling Products',     'Our customers'' favorites',  true,  2, 12),
  ('categories',  'Shop by Category',          'Browse our collections',     true,  3, 12),
  ('featured',    'Featured Products',         'Handpicked for you',         true,  4, 8),
  ('latest',      'New Arrivals',              'Fresh in store',             true,  5, 8)
ON CONFLICT (key) DO UPDATE
SET title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    enabled = EXCLUDED.enabled,
    sort_order = EXCLUDED.sort_order,
    items_per_page = EXCLUDED.items_per_page;

-- ---------- Delivery zones ----------
INSERT INTO public.delivery_zones (name, charge, is_active, sort_order)
VALUES
  ('Inside City',  60,  true, 1),
  ('Nearby Area', 100,  true, 2),
  ('Outside City', 150, true, 3)
ON CONFLICT DO NOTHING;

-- ---------- Automatic discount rule ----------
INSERT INTO public.discount_rules (label, discount_type, discount_value, min_amount, max_amount, is_active, sort_order)
VALUES ('10% off orders over ৳2000', 'percentage', 10, 2000, NULL, true, 1)
ON CONFLICT DO NOTHING;

-- ---------- Coupon ----------
INSERT INTO public.coupons (code, discount_type, discount_value, min_subtotal, max_discount, usage_limit, is_active)
VALUES ('WELCOME10', 'percentage', 10, 0, 100, 500, true)
ON CONFLICT (code) DO NOTHING;

-- ---------- Hero slides ----------
INSERT INTO public.hero_slides (title, subtitle, image_url, link_url, is_active, sort_order)
SELECT
  'Fresh Food, Delivered Fast',
  'Order fresh groceries and meals online and track them right to your door.',
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1800&q=80',
  '/shop',
  true,
  1
WHERE NOT EXISTS (SELECT 1 FROM public.hero_slides);
INSERT INTO public.hero_slides (title, subtitle, image_url, link_url, is_active, sort_order)
SELECT
  'Order in a Click',
  'Fast checkout, real-time tracking and free delivery on orders over ৳2000.',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1800&q=80',
  '/track',
  true,
  2
WHERE NOT EXISTS (SELECT 1 FROM public.hero_slides WHERE sort_order = 2);

-- ---------- Categories ----------
INSERT INTO public.categories (name, slug, image_url, description, sort_order, is_active)
VALUES
  ('Vegetables & Greens', 'vegetables-greens', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80', 'Fresh seasonal vegetables', 1, true),
  ('Fresh Fruits',        'fresh-fruits',      'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=800&q=80', 'Ripe, juicy fruits every day', 2, true),
  ('Meat & Fish',         'meat-fish',         'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=800&q=80', 'Quality protein, cut fresh', 3, true),
  ('Bakery & Bread',      'bakery-bread',      'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80', 'Baked fresh each morning', 4, true),
  ('Drinks & Beverages',  'drinks-beverages',  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80', 'Hot and cold refreshments', 5, true),
  ('Snacks & Sweets',     'snacks-sweets',     'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80', 'Treats for any moment', 6, true)
ON CONFLICT (slug) DO NOTHING;

-- ---------- Products ----------
INSERT INTO public.products (name, slug, description, category_id, price, stock, unit, is_featured, is_active)
SELECT 'Organic Tomatoes', 'organic-tomatoes', 'Sun-ripened, pesticide-free tomatoes. Great for salads, curries and sauces.', c.id, 80, 60, 'per kg', true, true
FROM public.categories c WHERE c.slug = 'vegetables-greens'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products (name, slug, description, category_id, price, stock, unit, is_featured, is_active)
SELECT 'Fresh Red Onions', 'fresh-red-onions', 'Crisp red onions — a kitchen staple with a sweet, mild bite.', c.id, 60, 100, 'per kg', false, true
FROM public.categories c WHERE c.slug = 'vegetables-greens'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products (name, slug, description, category_id, price, stock, unit, is_featured, is_active)
SELECT 'Red Seedless Grapes', 'red-seedless-grapes', 'Sweet, plump and juicy. Perfect for snacking or fruit bowls.', c.id, 220, 40, 'per kg', true, true
FROM public.categories c WHERE c.slug = 'fresh-fruits'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products (name, slug, description, category_id, price, stock, unit, is_featured, is_active)
SELECT 'Farm Fresh Eggs', 'farm-fresh-eggs', 'Free-range eggs from local farms. Sold by the dozen.', c.id, 150, 80, 'per dozen', true, true
FROM public.categories c WHERE c.slug = 'meat-fish'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products (name, slug, description, category_id, price, stock, unit, is_featured, is_active)
SELECT 'Sourdough Bread', 'sourdough-bread', 'Crusty outside, soft inside. Baked fresh every morning.', c.id, 180, 30, 'per loaf', true, true
FROM public.categories c WHERE c.slug = 'bakery-bread'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products (name, slug, description, category_id, price, stock, unit, is_featured, is_active)
SELECT 'Fresh Whole Tilapia', 'fresh-whole-tilapia', 'Farm-raised tilapia, cleaned and weighed fresh to order.', c.id, 350, 25, 'per kg', false, true
FROM public.categories c WHERE c.slug = 'meat-fish'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products (name, slug, description, category_id, price, stock, unit, is_featured, is_active)
SELECT 'Iced Latte', 'iced-latte', 'Smooth espresso over cold milk with ice. Ready to enjoy.', c.id, 140, 50, 'per cup', false, true
FROM public.categories c WHERE c.slug = 'drinks-beverages'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products (name, slug, description, category_id, price, stock, unit, is_featured, is_active)
SELECT 'Chocolate Brownie', 'chocolate-brownie', 'Rich, fudgy brownie with a crackly top. A sweet treat for any time.', c.id, 120, 45, 'per piece', true, true
FROM public.categories c WHERE c.slug = 'snacks-sweets'
ON CONFLICT (slug) DO NOTHING;

-- ---------- Product images ----------
INSERT INTO public.product_images (product_id, image_url, alt_text, sort_order)
SELECT p.id, 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=800&q=80', 'Organic Tomatoes', 1
FROM public.products p WHERE p.slug = 'organic-tomatoes'
  AND NOT EXISTS (SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id);

INSERT INTO public.product_images (product_id, image_url, alt_text, sort_order)
SELECT p.id, 'https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=800&q=80', 'Fresh Red Onions', 1
FROM public.products p WHERE p.slug = 'fresh-red-onions'
  AND NOT EXISTS (SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id);

INSERT INTO public.product_images (product_id, image_url, alt_text, sort_order)
SELECT p.id, 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?auto=format&fit=crop&w=800&q=80', 'Red Seedless Grapes', 1
FROM public.products p WHERE p.slug = 'red-seedless-grapes'
  AND NOT EXISTS (SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id);

INSERT INTO public.product_images (product_id, image_url, alt_text, sort_order)
SELECT p.id, 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=800&q=80', 'Farm Fresh Eggs', 1
FROM public.products p WHERE p.slug = 'farm-fresh-eggs'
  AND NOT EXISTS (SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id);

INSERT INTO public.product_images (product_id, image_url, alt_text, sort_order)
SELECT p.id, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80', 'Sourdough Bread', 1
FROM public.products p WHERE p.slug = 'sourdough-bread'
  AND NOT EXISTS (SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id);

INSERT INTO public.product_images (product_id, image_url, alt_text, sort_order)
SELECT p.id, 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=800&q=80', 'Fresh Whole Tilapia', 1
FROM public.products p WHERE p.slug = 'fresh-whole-tilapia'
  AND NOT EXISTS (SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id);

INSERT INTO public.product_images (product_id, image_url, alt_text, sort_order)
SELECT p.id, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=80', 'Iced Latte', 1
FROM public.products p WHERE p.slug = 'iced-latte'
  AND NOT EXISTS (SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id);

INSERT INTO public.product_images (product_id, image_url, alt_text, sort_order)
SELECT p.id, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80', 'Chocolate Brownie', 1
FROM public.products p WHERE p.slug = 'chocolate-brownie'
  AND NOT EXISTS (SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id);

-- ============================================================
-- 6. BACKFILL AGGREGATES (safe on existing data)
-- ============================================================
INSERT INTO public.product_ratings (product_id, avg_rating, review_count)
SELECT r.product_id, COALESCE(AVG(r.rating)::numeric(3,2), 0), COUNT(*)
FROM public.reviews r
WHERE r.approved = true
GROUP BY r.product_id
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO public.product_order_counts (product_id, total_sold)
SELECT oi.product_id, SUM(oi.quantity)
FROM public.order_items oi
WHERE oi.product_id IS NOT NULL
GROUP BY oi.product_id
ON CONFLICT (product_id) DO NOTHING;
