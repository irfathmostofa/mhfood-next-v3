// ============================================================
// Supabase Edge Function: process-product-image
// ------------------------------------------------------------
// Creates a complete product listing from a single uploaded image.
//
// Expected payload (full pipeline):
//   { "imagePath": "raw/<file>.png", "productId": "<uuid>",
//     "language": "en" | "bn" }
//
// Regenerate-content payload (mode = "generate", used when the AI could
// not identify the product OR could not generate content, and the admin
// typed in the name manually):
//   { "mode": "generate", "imagePath": "raw/<file>.png",
//     "productId": "<uuid>", "name": "<product name>",
//     "language": "en" | "bn" }
//
// Full pipeline:
//   auth (JWT) -> download -> validate -> process (tiled store-name
//   watermark only -- no background removal) -> upload processed ->
//   Gemini vision analysis -> content generation (English or Bangla) ->
//   SEO analysis -> save -> done
//
// The admin is asked to confirm/provide the product name (processing_status
// = 'awaiting_name') in TWO cases:
//   1. Vision analysis could not identify a specific product at all.
//   2. Vision analysis succeeded, but AI content generation (title/
//      description/keywords) failed -- rather than silently completing
//      with generic fallback copy, we save that fallback copy as a draft
//      and still ask the admin to confirm the name before publishing.
// In both cases the admin UI then calls back in "generate" mode. If
// generation fails again on that second attempt, we no longer loop the
// admin back into the naming screen -- we just complete with fallback
// content, since they've already confirmed a name once.
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
  type ContentLanguage,
  type GeneratedContent,
  type ImageAnalysis,
} from "./hf.ts";
import { prepareVisionJpeg, startImagePipeline, validateImage } from "./images.ts";
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

// Turns raw AI/fallback description text into clean plain text: keeps
// paragraph breaks and normalizes markdown-style bullets into • bullets
// so the storefront renders it well. Shared by the draft-save path
// (content generation failed) and the final completed-save path.
function normalizeDescription(text: string): string {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/^([-*•])\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

// Replaces a product's image rows with the processed (main) image and the
// original raw photo. Returns an error message on failure, else null.
async function syncProductImages(
  supabase: ReturnType<typeof createClient>,
  productId: string,
  processedImageUrl: string,
  rawImageUrl: string,
  altText: string,
): Promise<string | null> {
  const { error: imagesError } = await supabase
    .from("product_images")
    .delete()
    .eq("product_id", productId);
  if (imagesError) return imagesError.message;

  const { error: insertImagesError } = await supabase
    .from("product_images")
    .insert([
      {
        product_id: productId,
        image_url: processedImageUrl,
        alt_text: altText,
        sort_order: 1,
      },
      {
        product_id: productId,
        image_url: rawImageUrl,
        alt_text: `${altText} (original)`,
        sort_order: 2,
      },
    ]);
  if (insertImagesError) return insertImagesError.message;
  return null;
}

// Shared "defer to the admin" path -- used both when vision analysis
// couldn't identify the product at all, and when content generation
// failed after a successful identification. Optionally saves a
// best-effort draft (fallback title/description/keywords/SEO) so the
// admin has something to look at / edit instead of an empty listing
// while they confirm the name, then leaves processing_status =
// 'awaiting_name' so the admin UI shows the naming screen.
async function deferToNaming(
  supabase: ReturnType<typeof createClient>,
  productId: string,
  imagePath: string,
  processedImageUrl: string,
  warnings: string[],
  draft?: { generated: GeneratedContent; seo: SeoResult },
): Promise<Response> {
  const update: Record<string, unknown> = {
    processed_image_url: processedImageUrl,
    processing_status: "awaiting_name",
    processing_errors: warnings.length > 0 ? warnings.join("\n") : null,
    publish_status: "draft",
    is_active: false,
  };

  if (draft) {
    update.name = draft.generated.title.slice(0, 120);
    update.short_description = draft.generated.short_description;
    update.description = normalizeDescription(draft.generated.description);
    update.seo_keywords = draft.generated.keywords;
    update.seo_score = draft.seo.seoScore;
    update.seo_data = {
      suggestedKeywords: draft.seo.suggestedKeywords,
      keywordDensity: draft.seo.keywordDensity,
      readabilityScore: draft.seo.readabilityScore,
      stats: draft.seo.stats,
    };
  }

  await supabase.from("products").update(update).eq("id", productId);

  const rawImageUrl = supabase.storage
    .from("product-images")
    .getPublicUrl(imagePath).data.publicUrl;
  const syncError = await syncProductImages(
    supabase,
    productId,
    processedImageUrl,
    rawImageUrl,
    draft?.generated.title || "Untitled product",
  );
  if (syncError) {
    await supabase
      .from("products")
      .update({ processing_errors: syncError })
      .eq("id", productId);
  }

  return json({
    ok: true,
    recognized: false,
    productId,
    processedImageUrl,
    generated: draft?.generated,
    warnings,
  });
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
    const mode = body.mode === "generate" ? "generate" : "full";
    const language: ContentLanguage = body.language === "bn" ? "bn" : "en";
    const providedName =
      typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!imagePath || !productId) {
      return json({ error: "imagePath and productId are required." }, 400);
    }
    if (mode === "generate" && !providedName) {
      return json({ error: "name is required when mode is generate." }, 400);
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
    try {
      validateImage(originalBytes);
    } catch (err) {
      return await fail(err instanceof Error ? err.message : "Invalid image.");
    }
    const fileName = imagePath.split("/").pop() ?? "";

    // -------- 3. process image (tiled store-name watermark only --
    // background removal has been removed from the pipeline) --------
    const storeName = String(
      Deno.env.get("WATERMARK_TEXT") ||
        Deno.env.get("STORE_NAME") ||
        Deno.env.get("WATERMARK_STORE_NAME") ||
        "",
    ).trim();

    let processedImageUrl = product.processed_image_url ?? "";
    let warnings: string[] = [];

    const emptyAnalysis = (name = ""): ImageAnalysis => ({
      identifiedName: name,
      productType: name || "product",
      category: "",
      colors: [],
      size: "",
      material: "",
      keyFeatures: [],
      targetAudience: "",
      sellingPoints: [],
    });

    const runVision = async (bytes: Uint8Array): Promise<ImageAnalysis> =>
      await analyzeImage(bytes, fileName);

    const uploadProcessed = async (result: {
      buffer: Uint8Array;
      mime: string;
      warnings: string[];
    }) => {
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
    };

    // Decode once, then watermark and vision in parallel so a slow
    // font fetch never delays Gemini (and vice versa).
    let analysis: ImageAnalysis;
    if (mode === "generate") {
      try {
        let visionBytes = originalBytes;
        try {
          visionBytes = await prepareVisionJpeg(originalBytes);
        } catch (prepErr) {
          console.warn(
            "[process-product-image] vision downscale skipped:",
            prepErr instanceof Error ? prepErr.message : String(prepErr),
          );
        }
        analysis = await runVision(visionBytes);
      } catch (err) {
        console.warn(
          "[process-product-image] vision skipped in generate mode:",
          err instanceof Error ? err.message : String(err),
        );
        analysis = emptyAnalysis(providedName);
      }
    } else {
      let pipeline;
      try {
        pipeline = await startImagePipeline(originalBytes, storeName);
      } catch (err) {
        return await fail(
          `Image processing failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      const [visionOutcome, imageOutcome] = await Promise.allSettled([
        runVision(pipeline.visionJpeg),
        pipeline.finishProcessed().then(uploadProcessed),
      ]);
      if (imageOutcome.status === "rejected") {
        const reason = imageOutcome.reason;
        return await fail(
          `Image processing failed: ${reason instanceof Error ? reason.message : String(reason)}`,
        );
      }
      if (visionOutcome.status === "rejected") {
        const reason = visionOutcome.reason;
        return await fail(
          `AI analysis failed: ${reason instanceof Error ? reason.message : String(reason)}`,
        );
      }
      analysis = visionOutcome.value;
    }

    if (mode === "generate") {
      // The admin typed the product name manually -- either because the
      // AI couldn't recognize it, or because AI content generation failed
      // on the first pass. Treat that name as authoritative. Both the
      // content generation prompt and the SEO keywords derive from it (via
      // identifiedName/productType), in the chosen language.
      analysis = {
        ...analysis,
        identifiedName: providedName,
        productType: providedName || analysis.productType,
      };
    }

    // -------- 5. not recognized -> defer generation, ask for the name --------
    if (!analysis.identifiedName && mode !== "generate") {
      return await deferToNaming(
        supabase,
        productId,
        imagePath,
        processedImageUrl,
        warnings,
      );
    }

    // -------- 6. generate content (in the chosen language) --------
    // Dynamic content: driven entirely by `analysis`, which either came
    // from vision recognition (identifiedName filled in automatically) or
    // from the admin-provided name (mode === "generate", step 4 above).
    let generated: GeneratedContent;
    let usedFallbackContent = false;
    try {
      generated = await generateContent(analysis, language);
    } catch (genErr) {
      usedFallbackContent = true;
      warnings.push(
        `AI content generation skipped (fallback used): ${
          genErr instanceof Error ? genErr.message : String(genErr)
        }`,
      );
      generated = fallbackContent(analysis, fileName, language);
    }

    // -------- 6b. content generation failed on the FIRST attempt -->
    // save the fallback draft and ask the admin to confirm/name the
    // product, same as the "not recognized" path above, instead of
    // silently completing with generic fallback copy. If this is
    // already the admin's second attempt (mode === "generate", they
    // already confirmed a name once), don't loop them back into the
    // naming screen -- fall through and complete with the fallback
    // content below. --------
    if (usedFallbackContent && mode !== "generate") {
      const seoDraft = analyzeSEO(generated.title, generated.description);
      return await deferToNaming(
        supabase,
        productId,
        imagePath,
        processedImageUrl,
        warnings,
        { generated, seo: seoDraft },
      );
    }

    const seo: SeoResult = analyzeSEO(generated.title, generated.description);
    const description = normalizeDescription(generated.description);
    const slug = await ensureUniqueSlug(supabase, slugify(generated.title));

    // -------- 7. save everything --------
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

    const syncError = await syncProductImages(
      supabase,
      productId,
      processedImageUrl,
      rawImageUrl,
      generated.title,
    );
    if (syncError) {
      // Non-fatal — the listing still exists with its raw image.
      await supabase
        .from("products")
        .update({
          processing_errors: `Product saved but image sync failed: ${syncError}`,
        })
        .eq("id", productId);
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
 