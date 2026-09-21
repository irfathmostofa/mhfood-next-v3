# MHFood Store — Features and Pricing

Complete feature list for the current product stage, plus package prices.

MHFood Store is a Next.js ecommerce platform for Bangladesh retailers. One install covers the customer storefront, admin, courier logistics, SMS, promotions, reporting, and AI product creation.

---

## Packages and pricing

All prices are in Bangladeshi Taka (BDT / Tk).

| Package | Price | Billing | Who it is for |
| --- | --- | --- | --- |
| Monthly | 500 Tk | Billed every month | Shops that want to start quickly and pay as they go |
| Yearly | 5500 Tk | Billed once per year | Shops that want a lower yearly cost (save 500 Tk vs 12 months) |
| Customize | By negotiation | Scoped to the store | Extra modules, unique design, extra courier, or custom workflows |

### What every package includes

Monthly and Yearly both include the full current platform described in this document:

- Customer storefront
- Admin panel
- Catalog, orders, checkout, tracking
- Promotions and coupons
- Steadfast / Packzy logistics
- SMS (BulkSMSBD)
- Order emails
- SEO and analytics
- AI product create
- Reports and expenses

### Customize

Custom work is available after discussion. Typical examples:

- Extra pages or landing layouts
- Brand-specific design beyond theme presets
- Extra courier or payment flows
- Extra reports or accounting fields
- Unique checkout or catalog rules

Price and timeline are agreed per store.

---

## Current stage

The product is a live-ready store platform. A shop can:

1. Publish a branded storefront
2. Sell products with variants, sales, and coupons
3. Take COD / checkout orders with delivery or pickup
4. Track orders and send parcels through Steadfast
5. Message customers by SMS and email
6. Measure profit from cost, sales, and expenses

---

## 1. Customer storefront

### Pages

| Page | Path | What it does |
| --- | --- | --- |
| Home | `/` | Configurable homepage sections |
| Shop | `/shop` | Full catalog with search, filters, and sort |
| Product | `/product/[slug]` | Product detail, variants, ratings, enquiry |
| Sale campaign | `/sale/[slug]` | Timed discount session landing page |
| Checkout | `/checkout` | Name, phone, address, delivery or pickup, coupon |
| Track order | `/track` and `/track/[code]` | Lookup by tracking code with status steps |
| Review | `/review/[orderId]` | Star ratings after an order |

### Homepage sections (admin-controlled)

Each block can be enabled, titled, ordered, and limited:

- Hero slider
- Flash sale / live discount sessions
- Best sellers
- Shop by category
- Featured products
- New arrivals
- Promotional banner
- Category product rows
- Trust / feature strip
- How it works
- Call-to-action band

### Shop and catalog browsing

- Search by product name
- Filter by category, price range, and in-stock
- Sort by newest, price low to high, price high to low, top rated
- Product cards with sale price, regular price, and ratings
- Nested category navigation in the header

### Product page

- Multiple images
- Short description and rich-text long description
- Variants (size, color, and similar) with price adjustment and stock
- Weight and unit (for example per kg)
- Live sale price when a discount session is running
- Star ratings and review list
- Product enquiry form (name, phone, email, quantity, message)
- Add to cart

### Cart and checkout

- Cart drawer and floating cart
- Quantity update and item remove
- Delivery or store pickup
- Delivery zones with base fee plus extra-kg charge
- Free delivery above a threshold (optional)
- Pickup points
- Automatic cart discount rules (best matching rule)
- Coupon codes (percentage or fixed, min subtotal, max discount, dates, usage limit)
- Order confirmation with a tracking code

### Tracking and reviews

- Public tracking by code
- Status steps for delivery and pickup
- Post-order review link per order item

### Store chrome

- Header: logo, search, categories, live sale links, cart
- Optional announcement bar
- Footer: contact, social links, category links
- Floating WhatsApp and Messenger buttons
- Back to top

---

## 2. Catalog and pricing

### Products

- Name, URL slug, category
- Short description and rich-text description
- Cost, regular price, selling price, and margin helper
- Stock (or total of variant stock)
- Unit and weight in kg (used for delivery charge)
- Featured flag and active / inactive
- Multiple images
- Variants: group name, value, price adjustment, stock, SKU

### Categories

- Parent and child categories
- Image, slug, sort order
- Show or hide on the storefront

### Pricing on the store

- Selling price is what the customer pays
- Regular price can show as struck-through
- Flash / campaign sessions override price while live
- Checkout then applies zone delivery, free-delivery rule, cart rules, and coupons

---

## 3. Promotions

### Discount sessions (flash sales)

- Named campaigns with slug, subtitle, start and end time
- Styles: Flash Sale, Black Friday, Campaign Sale
- Per-product percentage or fixed discount
- Homepage flash-sale block and `/sale/[slug]` page
- Countdown while the session is live

### Coupons

- Percentage or fixed amount
- Minimum subtotal and optional max discount
- Start / end dates
- Usage limit and used count
- Active toggle

### Automatic discount rules

- Cart-level rules by subtotal range
- Percentage or fixed
- Checkout picks the best eligible rule

### Promo banner and hero

- Full-width promotional banner on home
- Hero slides with image, title, link, sort order, active toggle

---

## 4. Admin panel

Protected at `/admin` after login.

| Module | Path | What it does |
| --- | --- | --- |
| Dashboard | `/admin` | Orders, revenue, product cost, expenses, net profit, low stock |
| Products | `/admin/products` | Create, edit, search, stock, variants, images |
| Create with AI | `/admin/products/new` | Upload one image, generate listing, review, save draft or publish |
| Categories | `/admin/categories` | Nested categories and images |
| Discount sessions | `/admin/discounts` | Flash / campaign sales and product discounts |
| Hero slides | `/admin/hero` | Homepage slider |
| Orders | `/admin/orders` | Status, search, dates, POS invoice, courier parcel, bulk send |
| Enquiries | `/admin/enquiries` | Product enquiries: new, contacted, closed |
| Logistics | `/admin/logistics` | Parcels, returns, payments, courier settings, manual parcels |
| Customers | `/admin/customers` | Buyers from orders, order history, bulk SMS |
| Expenses | `/admin/expenses` | Expense types, amounts, printable report |
| Reports | `/admin/reports` | Date-range sales report, printable |
| Settings | `/admin/settings` | Theme, SEO, contact, home, coupons, zones, pickup, rules, SMS |

### Orders

Statuses: Pending, Confirmed, Out for Delivery, Delivered, Cancelled.

Also includes:

- Search and date filter
- Expand line items
- Print 80mm POS-style invoice
- Create a Steadfast parcel from the order
- Bulk parcel create
- Courier status and tracking link

### Dashboard and reports

- Today and month revenue
- Product cost from `products.cost` x sold quantity
- Expenses in the same period
- Gross and net profit
- Low-stock alerts
- Printable sales report
- Printable expense report

---

## 5. Logistics (Steadfast / Packzy)

Courier integration for Bangladesh last-mile.

- Send order as a parcel (COD amount, note, delivery type)
- Bulk send selected orders
- Manual parcel (not tied to a store order)
- Sync parcel status from the courier
- Returns list
- Payment / merchant payout list
- Courier balance
- Settings for API credentials
- Public tracking URL on steadfast.com.bd

COD fee can be treated as a merchant cost (not added to the customer total).

---

## 6. Communications

### SMS (BulkSMSBD)

- Enable or disable from admin
- API key and sender ID
- Bangladesh number normalization
- Order / customer messaging
- Bulk SMS to selected customers
- Segment count for GSM-7 vs Unicode

### Email (EmailJS)

- Order placed emails
- Delivered emails
- Admin copy
- Server-side send so keys stay off the browser

### Chat buttons

- WhatsApp (optional)
- Messenger (optional)

---

## 7. AI product create

Admin path: `/admin/products/new`.

From one product photo the agent can:

- Remove background
- Apply store logo / watermark
- Generate title, description, and keywords
- Work in English or Bangla
- Score SEO before publish
- Save as draft until Publish

Non-critical image steps (background remove, watermark) fail softly and still return copy.

See `docs/AI_PRODUCT_AGENT.md` for migration, storage bucket, Hugging Face secrets, and edge-function deploy.

---

## 8. Settings

### Appearance

- Store name and logo (text or image)
- Color theme: primary, accent, background, surface, text, muted, border
- Theme presets (Harvest, Garden, Ocean, and others)
- Font
- Announcement bar
- Header category row

### SEO and analytics

- Site name, tagline, home title, description, keywords
- Open Graph image
- Canonical URLs, sitemap, robots
- Product JSON-LD
- Google site verification
- Google Analytics
- Meta (Facebook) Pixel
- TikTok Pixel
- Checkout events: initiate checkout and purchase

### Contact and store info

- Phone, email, address, description
- Facebook, Instagram, Messenger, WhatsApp
- Free delivery toggle and threshold

### Fulfillment

- Delivery zones: area, base charge, included kg, extra-kg charge
- Pickup points: name, address, sort order

---

## 9. Technical stack

| Layer | Technology |
| --- | --- |
| App | Next.js 15, React 19, Tailwind CSS 4 |
| Data | Supabase (Postgres, auth, storage, realtime) |
| Admin editor | TipTap rich text |
| Courier | Steadfast / Packzy API |
| SMS | BulkSMSBD |
| Email | EmailJS |
| AI | Hugging Face edge function `process-product-image` |

Local start:

```bash
# Install dependencies
npm install

# Copy env values into .env.local
# Start the app
npm run dev
```

AI deploy steps live in `docs/AI_PRODUCT_AGENT.md`.

---

## 10. How to choose a package

- **Monthly (500 Tk)** — try the full store, pay month by month.
- **Yearly (5500 Tk)** — same features, one yearly payment (equal to 11 months).
- **Customize (negotiation)** — keep the platform and add store-specific work.

The feature set above is the current stage included in Monthly and Yearly. Customize only adds extra work beyond this list.
