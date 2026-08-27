// ============================================================
// Supabase Edge Function: process-product-image
// ------------------------------------------------------------
// Creates a complete product listing from a single uploaded image.
//
// Expected payload:
//   { "imagePath": "raw/<file>.png", "productId": "<uuid>" }
//
// Pipeline:
//   auth (JWT) -> download -> validate -> process (bg removal +
//   logo watermark) -> upload processed -> HF vision analysis ->
//   HF content generation -> SEO analysis -> save -> completed
//
// Any hard failure flips the product to processing_status = 'failed'
// with details in processing_errors. Non-critical image steps log
// warnings and continue.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import {
  analyzeImage,
  fallbackContent,
  generateContent,
  type GeneratedContent,
  type ImageAnalysis,
} from "./hf.ts";
import { processImage, validateImage } from "./images.ts";
import { analyzeSEO, type SeoResult } from "./seo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function slugify(text: string): string {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

async function ensureUniqueSlug(
  supabase: ReturnType<typeof createClient>,
  base: string,
): Promise<string> {
  const candidate = base || `product-${Date.now()}`;
  const { data } = await supabase
    .from("products")
    .select("slug")
    .eq("slug", candidate)
    .maybeSingle();
  if (!data) return candidate;
  return `${candidate.slice(0, 60)}-${Date.now().toString(36).slice(-4)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // -------- Auth: verify the caller's JWT --------
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !anonKey || !serviceKey) {
      throw new Error("Supabase environment variables are not configured.");
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Missing bearer token." }, 401);

    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: authData, error: authError } =
      await authClient.auth.getUser();
    if (authError || !authData.user) {
      return json({ error: "Unauthorized." }, 401);
    }

    // -------- Parse input --------
    const body = await req.json().catch(() => ({}));
    const imagePath = typeof body.imagePath === "string" ? body.imagePath : "";
    const productId = typeof body.productId === "string" ? body.productId : "";
    if (!imagePath || !productId) {
      return json({ error: "imagePath and productId are required." }, 400);
    }

    // Service-role client for storage + DB operations.
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();
    if (productError || !product) {
      return json({ error: "Product not found." }, 404);
    }

    const fail = async (message: string) => {
      const errMsg = message.slice(0, 2000);
      console.error("[process-product-image] failure:", errMsg);
      await supabase
        .from("products")
        .update({
          processing_status: "failed",
          processing_errors: errMsg,
        })
        .eq("id", productId);
      return json({ error: errMsg, productId }, 500);
    };

    // -------- 1. mark as processing --------
    await supabase
      .from("products")
      .update({
        processing_status: "processing",
        publish_status: "draft",
        is_active: false,
        processing_errors: null,
      })
      .eq("id", productId);

    // -------- 2. download + validate the raw image --------
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("product-images")
      .download(imagePath);
    if (downloadError || !fileBlob) {
      return await fail(
        `Could not download image: ${downloadError?.message ?? "not found"}`,
      );
    }
    const originalBytes = new Uint8Array(await fileBlob.arrayBuffer());
    let rawExt: string;
    try {
      rawExt = validateImage(originalBytes).ext;
    } catch (err) {
      return await fail(err instanceof Error ? err.message : "Invalid image.");
    }
    const fileName = imagePath.split("/").pop() ?? "";

    // -------- 3. process image (background removal + logo/text watermark) --------
    const logoUrl = Deno.env.get("PRODUCT_LOGO_URL") ?? "";
    // Used as the watermark fallback (see images.ts addWatermark()) when
    // there's no logo configured, or the logo step fails for any reason.
    let storeName = "";
    try {
      const { data: theme } = await supabase
        .from("theme_settings")
        .select("store_name")
        .eq("id", 1)
        .maybeSingle();
      storeName = theme?.store_name ?? "";
    } catch {
      // Non-critical -- just means no text-watermark fallback is available.
    }
    let processedImageUrl = "";
    let warnings: string[] = [];
    try {
      const result = await processImage(originalBytes, logoUrl, storeName);
      warnings = result.warnings;
      const ext = result.mime === "image/jpeg" ? "jpg" : "png";
      const processedPath = `processed/${productId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(processedPath, result.buffer, {
          contentType: result.mime,
          cacheControl: "3600",
          upsert: true,
        });
      if (uploadError) throw new Error(uploadError.message);
      processedImageUrl = supabase.storage
        .from("product-images")
        .getPublicUrl(processedPath).data.publicUrl;
    } catch (err) {
      return await fail(
        `Image processing failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // -------- 4. AI content generation --------
    let analysis: ImageAnalysis;
    let generated: GeneratedContent;
    let seo: SeoResult;
    try {
      analysis = await analyzeImage(originalBytes, fileName);
      try {
        generated = await generateContent(analysis);
      } catch (genErr) {
        warnings.push(
          `AI content generation skipped (fallback used): ${
            genErr instanceof Error ? genErr.message : String(genErr)
          }`,
        );
        generated = fallbackContent(analysis, fileName);
      }
      seo = analyzeSEO(generated.title, generated.description);
    } catch (err) {
      return await fail(
        `AI analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Normalise AI output into clean plain text: keep paragraph breaks and
    // turn markdown bullets into • bullets so the storefront renders it well.
    const description = String(generated.description || "")
      .replace(/\r/g, "")
      .replace(/^([-*•])\s+/gm, "• ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const slug = await ensureUniqueSlug(supabase, slugify(generated.title));

    // -------- 5. save everything --------
    const { error: saveError } = await supabase
      .from("products")
      .update({
        name: generated.title.slice(0, 120),
        slug,
        short_description: generated.short_description,
        description,
        processed_image_url: processedImageUrl,
        seo_keywords: generated.keywords,
        seo_score: seo.seoScore,
        seo_data: {
          suggestedKeywords: seo.suggestedKeywords,
          keywordDensity: seo.keywordDensity,
          readabilityScore: seo.readabilityScore,
          stats: seo.stats,
        },
        processing_status: "completed",
        processing_errors: warnings.length > 0 ? warnings.join("\n") : null,
        publish_status: "draft",
        is_active: false,
      })
      .eq("id", productId);

    if (saveError)
      return await fail(`Could not save product: ${saveError.message}`);

    // Keep both images: processed version is the storefront main image.
    const rawImageUrl = supabase.storage
      .from("product-images")
      .getPublicUrl(imagePath).data.publicUrl;

    const { error: imagesError } = await supabase
      .from("product_images")
      .delete()
      .eq("product_id", productId);

    if (!imagesError) {
      const { error: insertImagesError } = await supabase
        .from("product_images")
        .insert([
          {
            product_id: productId,
            image_url: processedImageUrl,
            alt_text: generated.title,
            sort_order: 1,
          },
          {
            product_id: productId,
            image_url: rawImageUrl,
            alt_text: `${generated.title} (original)`,
            sort_order: 2,
          },
        ]);
      if (insertImagesError) {
        // Non-fatal — the listing still exists with its raw image.
        await supabase
          .from("products")
          .update({
            processing_errors: `Product saved but image sync failed: ${insertImagesError.message}`,
          })
          .eq("id", productId);
      }
    }

    return json({
      ok: true,
      productId,
      processedImageUrl,
      generated,
      seo,
      warnings,
    });
  } catch (err) {
    console.error(
      "[process-product-image] unhandled error:",
      err instanceof Error ? (err.stack ?? err.message) : String(err),
    );
    return json(
      {
        error: err instanceof Error ? err.message : "Something went wrong.",
      },
      500,
    );
  }
});
