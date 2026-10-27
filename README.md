# MHFood Store

A Next.js ecommerce platform for Bangladesh retailers: storefront, admin, courier logistics, SMS, and AI-assisted product creation.
## Current stage

The product is a working store platform suitable for live shops. Store owners can run catalog, checkout, orders, courier parcels, promotions, and reporting from one admin.

### Storefront
- Home with configurable sections (hero, bestsellers, categories, featured, latest, flash sale, promo banner)
- Shop, product pages, variants, and weight-based pricing
- Cart, coupons, automatic discount rules, delivery zones, and pickup points
- Checkout, order tracking, and post-order reviews
- SEO metadata, sitemap, robots, JSON-LD, and analytics pixels (GA, Meta, TikTok)

### Admin

- Dashboard with revenue, cost, expenses, and profit
- Products, categories, variants, stock, and AI product create
- Discount sessions / flash sales and hero slides
- Orders, customer enquiries, and customer list
- Steadfast / Packzy logistics (parcels, returns, payments, manual parcels)
- Expenses and sales reports
- Settings: theme, SEO, contact, home sections, coupons, zones, pickup, discount rules, SMS (BulkSMSBD)

### Integrations

- Supabase (data, auth, storage, realtime)
- Steadfast courier (Packzy API)
- BulkSMSBD
- EmailJS order emails
- Hugging Face AI for product image processing and copy

## Packages

All prices are in Bangladeshi Taka (BDT / Tk).

| Package | Price | Billing |
| --- | --- | --- |
| Monthly | 500 Tk | Per month |
| Yearly | 5500 Tk | Per year |
| Customize | By negotiation | Scoped to the store |

Yearly is billed once per year. Custom work (extra modules, design, or unique workflows) is available after discussion.

## Stack

- Next.js 15, React 19, Tailwind CSS 4
- Supabase
- Edge function: `process-product-image`

## Local setup

```bash
# Install dependencies
npm install

# Copy env values into .env.local
# Start the app
npm run dev
```

See `docs/AI_PRODUCT_AGENT.md` for AI product-create deployment (migration, storage, Hugging Face secrets, and the edge function).
