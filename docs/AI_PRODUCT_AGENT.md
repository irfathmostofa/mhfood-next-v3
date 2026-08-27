# AI Product Agent — Deployment Guide

The AI Product Creation agent lets an admin upload a single product image and get a
processed image (background removed + logo watermark) plus AI-generated title,
description, keywords and an SEO score, all reviewed and published from
`/admin/products/new`.

## Components

| Piece | Location |
| --- | --- |
| Schema + storage + realtime | `supabase/migrations/006_ai_product_creation.sql` |
| Edge function (Deno) | `supabase/functions/process-product-image/` |
| Admin UI | `src/components/admin/AiProductCreate.jsx` |
| Admin page | `src/app/admin/(protected)/products/new/page.jsx` |
| Admin proxy API | `src/app/api/admin/ai/process/route.js` |
| Client SEO mirror | `src/lib/seoAnalyzer.js` |

## 1. Database migration

```bash
# From the Supabase Dashboard -> SQL Editor, or via the CLI:
supabase db push
```

Or run `supabase/migrations/006_ai_product_creation.sql` manually in the SQL editor.
This adds new columns to `products`, creates the public `product-images` storage
bucket with RLS policies, and adds `products` to the `supabase_realtime` publication.

## 2. Storage bucket

The migration creates the bucket and policies. If you ever need to recreate it:

```sql
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true);
```

## 3. Environment variables

Next.js app (`.env.local`):

```
HUGGINGFACE_API_KEY=hf_...
# optional overrides:
# HF_VISION_MODEL=google/gemma-3-27b-it
# HF_TEXT_MODEL=mistralai/Mistral-7B-Instruct-v0.1
# HF_BG_REMOVE_MODEL=briaai/RMBG-1.4
# PRODUCT_LOGO_URL=https://your-store.example.com/logo.png
```

Get a free Hugging Face token at https://huggingface.co/settings/tokens.

The edge function reads the same `HUGGINGFACE_API_KEY` (set via `supabase secrets`),
and the service-role key automatically via `SUPABASE_SERVICE_ROLE_KEY`.

## 4. Deploy the edge function

```bash
supabase functions deploy process-product-image --no-verify-jwt
supabase secrets set HUGGINGFACE_API_KEY=hf_...
```

`--no-verify-jwt` is required — auth is enforced in the function itself using the
admin session JWT passed through the proxy.

## 5. Verify locally (optional)

```bash
supabase start          # local Supabase + functions
supabase db push        # run migrations against local instance
npm run dev             # start the Next.js app
```

Then open `/admin/products/new`, upload an image, and watch the edge function logs:

```bash
supabase functions logs process-product-image
```

## Notes

- Products created by the agent are saved as drafts (`publish_status: 'draft'`,
  `is_active: false`) until you click **Publish** in the review step.
- Image steps that are non-critical (background removal, logo watermark) fail
  softly: the function records a warning and continues.
- `supabase/functions/` is excluded from the Next.js `tsconfig.json` because it
  uses Deno-style `npm:` imports; it is compiled by the Supabase CLI, not Next.js.
