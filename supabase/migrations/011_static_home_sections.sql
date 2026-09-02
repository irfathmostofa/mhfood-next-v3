INSERT INTO public.home_sections (key, title, subtitle, enabled, sort_order, items_per_page)
VALUES
  ('feature_strip', 'Trust Features', 'Delivery, freshness, tracking and support', true, 7, 4),
  ('how_it_works', 'How it works', 'Fresh food, in three easy steps', true, 8, 3),
  ('cta', 'Hungry? Your order is a click away.', 'Order fresh food and groceries online and track them the whole way to your door.', true, 9, 1)
ON CONFLICT (key) DO NOTHING;
