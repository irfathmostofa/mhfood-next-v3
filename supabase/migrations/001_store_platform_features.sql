-- ============================================================
-- MHFood Store — feature migration
-- New tables that power the admin-controlled storefront:
--   * product variants
--   * coupons
--   * home sections control
--   * theme settings (colors / header / card styles)
--   * SEO settings
-- ============================================================

-- ---------- Product variants ----------
-- Groups are stored as rows (name = group label e.g. "Size"/"Color",
-- value = option e.g. "Large"/"Red"). A product can have many groups.
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL,
  name text NOT NULL,
  value text NOT NULL,
  price_adjustment numeric NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  sku text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_pkey PRIMARY KEY (id),
  CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS product_variants_product_id_idx ON public.product_variants(product_id);
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_product_name_value_key
  UNIQUE (product_id, name, value);

-- Snapshot of variant info on each ordered line so history stays stable.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_text text;

-- RPC helpers for stock decrement (used by the order API).
CREATE OR REPLACE FUNCTION public.decrement_stock(p_product_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.products
  SET stock = GREATEST(0, stock - p_quantity)
  WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_variant_stock(p_variant_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.product_variants
  SET stock = GREATEST(0, stock - p_quantity)
  WHERE id = p_variant_id;
END;
$$;

-- ---------- Coupons ----------
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percentage'
    CHECK (discount_type IN ('fixed','percentage')),
  discount_value numeric NOT NULL DEFAULT 0,
  min_subtotal numeric NOT NULL DEFAULT 0,
  max_discount numeric,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  usage_limit integer NOT NULL DEFAULT 0,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT coupons_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS coupons_code_idx ON public.coupons(code);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_code text;

-- ---------- Home sections control ----------
CREATE TABLE IF NOT EXISTS public.home_sections (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  key text NOT NULL UNIQUE,
  title text,
  subtitle text,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  items_per_page integer NOT NULL DEFAULT 8,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT home_sections_pkey PRIMARY KEY (id)
);

INSERT INTO public.home_sections (key, title, subtitle, enabled, sort_order, items_per_page)
VALUES
  ('hero', 'Featured', 'Showcase your hero banner', true, 1, 1),
  ('bestsellers', 'Best Selling Products', 'Our customers'' favorites', true, 2, 12),
  ('categories', 'Shop by Category', 'Browse our collections', true, 3, 12),
  ('featured', 'Featured Products', 'Handpicked for you', true, 4, 8),
  ('latest', 'New Arrivals', 'Fresh in store', true, 5, 8)
ON CONFLICT (key) DO UPDATE
SET title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, enabled = EXCLUDED.enabled, sort_order = EXCLUDED.sort_order;

-- ---------- Theme settings ----------
CREATE TABLE IF NOT EXISTS public.theme_settings (
  id integer NOT NULL DEFAULT 1 CHECK (id = 1),
  primary_color text NOT NULL DEFAULT '#1F2A24',
  accent_color text NOT NULL DEFAULT '#C77B4C',
  background_color text NOT NULL DEFAULT '#FBF8F3',
  surface_color text NOT NULL DEFAULT '#FFFFFF',
  text_color text NOT NULL DEFAULT '#1F2A24',
  muted_color text NOT NULL DEFAULT '#8A8578',
  border_color text NOT NULL DEFAULT '#E7E0D3',
  header_style text NOT NULL DEFAULT 'classic',
  product_card_style text NOT NULL DEFAULT 'classic',
  show_announcement_bar boolean NOT NULL DEFAULT false,
  announcement_text text,
  font_family text NOT NULL DEFAULT 'fraunces',
  logo_text text NOT NULL DEFAULT 'MHFood',
  store_name text NOT NULL DEFAULT 'MHFood',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT theme_settings_pkey PRIMARY KEY (id)
);

INSERT INTO public.theme_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ---------- SEO settings ----------
CREATE TABLE IF NOT EXISTS public.seo_settings (
  id integer NOT NULL DEFAULT 1 CHECK (id = 1),
  site_name text NOT NULL DEFAULT 'MHFood',
  site_tagline text,
  home_title text,
  home_description text,
  home_keywords text,
  og_image text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT seo_settings_pkey PRIMARY KEY (id)
);

INSERT INTO public.seo_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed: keep site_settings generic so any category can be sold.
-- (No domain-specific defaults are forced here.)
-- ============================================================
