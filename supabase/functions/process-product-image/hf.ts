// ============================================================
// AI content-generation helpers (Deno)
// ------------------------------------------------------------
//  - analyzeImage(): vision analysis of the product photo
//  - generateContent(): title / descriptions / keywords
//
// Primary engine: Google Gemini API (Google AI Studio), which has a
// genuinely free tier -- no credit card, no expiry -- that still supports
// multimodal (vision) input and modern instruct models. Hugging Face's
// free serverless tier was scaled back in 2025 and now mostly only
// serves small/legacy models (BERT/GPT-2-class); it no longer reliably
// hosts vision-capable or 7B+ instruct chat models for free, which is
// why analyzeImage/generateContent were silently failing end-to-end and
// falling through to fallbackContent() every time. HF is kept only for
// the caption-model fallback (a small, classic task that's still likely
// free on hf-inference) and for background removal in images.ts.
// ============================================================
import { HfInference } from "npm:@huggingface/inference@4.13.28";

export interface ImageAnalysis {
  identifiedName: string;
  productType: string;
  category: string;
  colors: string[];
  size: string;
  material: string;
  keyFeatures: string[];
  targetAudience: string;
  sellingPoints: string[];
}

export interface GeneratedContent {
  title: string;
  short_description: string;
  description: string;
  keywords: string[];
}

const CAPTION_MODEL = "Salesforce/blip-image-captioning-large";

// Google retires Flash model names periodically (2.0 Flash was retired in
// favor of 3.6 Flash). Override via GEMINI_MODEL env var if this drifts out
// of date again -- check ai.google.dev/gemini-api/docs/models for the
// current free-tier-eligible Flash model before changing this.
//
// SPEED NOTE: gemini-3.x cannot fully disable "thinking" -- thinkingLevel
// "low" (set below) is the fastest it allows, and thinking still eats a
// noticeable chunk of latency on every call. If generation feels slow, the
// single biggest lever is switching to a 2.5-era Flash model via the
// GEMINI_MODEL env var (e.g. "gemini-2.5-flash"): callGemini() below sets
// thinkingBudget: 0 for any "gemini-2.5*" model, which fully disables
// thinking and is noticeably faster, at a modest quality trade-off.
// Prefer 2.5 Flash: thinkingBudget:0 fully disables thinking and is the
// fastest free-tier model. Override with GEMINI_MODEL if needed. A 404
// retry below will follow Google's suggested replacement if this name
// is retired.
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
let resolvedGeminiModel: string | null = null;

// Keep each outbound AI call well under the Edge Function wall-clock
// budget. Image processing now runs in parallel with vision, so 25s
// per call still leaves room for watermarking + a single retry.
const CALL_TIMEOUT_MS = 25_000;
const CAPTION_TIMEOUT_MS = 8_000;

// Wraps an async call with an AbortController-based timeout. Rejects with
// a clear "timed out" error so callers' existing catch/fallback logic
// (analyzeImage's fallback chain, generateContent -> fallbackContent)
// keeps working unchanged -- they just fail much sooner.
async function withTimeout<T>(
  label: string,
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number = CALL_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`${label} timed out after ${ms}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const VISION_PROMPT =
  `Analyze this product image and respond with a single JSON object ` +
  `containing exactly these keys: ` +
  `"identifiedName" (string), "productType" (string), "category" (string), ` +
  `"colors" (array of strings), "size" (string), "material" (string), ` +
  `"keyFeatures" (array of strings), "targetAudience" (string), ` +
  `"sellingPoints" (array of strings). ` +
  `For "identifiedName": look closely and actually identify the specific ` +
  `real-world item, the way a knowledgeable person would recognize it on ` +
  `sight -- not just its category. Examples of the level of specificity ` +
  `wanted: an exact phone model ("iPhone 15 Pro Max", "Samsung Galaxy S24 ` +
  `Ultra") rather than "smartphone"; the actual dish name ("Chicken Biryani", ` +
  `"Margherita Pizza") rather than "food item"; a specific book/game/shoe ` +
  `model rather than a generic label. This store also sells handmade and ` +
  `handcrafted goods, so treat those as first-class products too: a woven ` +
  `cane basket, a hand-thrown clay pot, embroidered fabric, jute rope, bead ` +
  `jewelry, carved woodwork, and similar artisan items should be identified ` +
  `by what they actually are (e.g. "handwoven cane basket", "handmade clay ` +
  `flower pot") using the visible form, materials, and craft cues -- do not ` +
  `dismiss them as "craft item" or refuse to name them. Use visible logos, ` +
  `packaging text, distinctive shape/design cues, materials, and ` +
  `plating/ingredients (for food) to make the identification. Only put a ` +
  `specific name here if you're reasonably confident -- if you truly cannot ` +
  `tell beyond the general category, leave it as an empty string rather ` +
  `than guessing a specific model at random. ` +
  `"productType" should still be filled with the general type either way ` +
  `(e.g. "smartphone", "biryani dish", "handwoven basket"). ` +
  `Do not wrap the JSON in markdown. If a value is unknown use empty string or [].`;

// ------------------------------------------------------------
// Content generation is a single Gemini call for title, short
// description, body, and keywords. A 180-250 word listing is
// enough for the storefront and stays well under the Edge Function
// timeout; the previous 500-800 word dual-call path regularly hit
// MAX_TOKENS and 45s timeouts.
// ------------------------------------------------------------

const CONTENT_PROMPT_EN =
  `You are an expert e-commerce product copywriter. Based on the product analysis below, ` +
  `write a complete product listing. If "identifiedName" is non-empty, treat it as the ` +
  `actual identity of the product and lead with it. If empty, write from the other fields ` +
  `without inventing a specific name. Respond with a single JSON object containing exactly ` +
  `these keys: "title" (SEO-optimized, 50-60 characters), "short_description" (140-160 ` +
  `characters, persuasive), "description" (180-250 words: short intro, 4-6 bullet features, ` +
  `benefits, and a call to action), and "keywords" (array of 8-10 SEO keyword phrases). ` +
  `Do not wrap the JSON in markdown.\n\nProduct analysis: `;

const CONTENT_PROMPT_BN =
  `You are an expert e-commerce product copywriter. Based on the product analysis below, ` +
  `write a complete product listing entirely in Bengali (Bangla) script, not romanized. ` +
  `If "identifiedName" is non-empty, treat it as the actual identity of the product and ` +
  `lead with it. If empty, write from the other fields without inventing a specific name. ` +
  `Respond with a single JSON object containing exactly these keys: "title" (SEO-optimized, ` +
  `50-60 characters, in Bengali), "short_description" (140-160 characters, persuasive, in ` +
  `Bengali), "description" (150-220 words in Bengali: short intro, 4-6 bullet features, ` +
  `benefits, and a call to action), and "keywords" (array of 8-10 SEO phrases, mix Bengali ` +
  `and common English search terms). Do not wrap the JSON in markdown.\n\nProduct analysis: `;

export type ContentLanguage = "en" | "bn";

export function getHfKey(): string {
  const key =
    Deno.env.get("HUGGINGFACE_API_KEY") ?? Deno.env.get("HF_API_KEY") ?? "";
  if (!key)
    throw new Error("HUGGINGFACE_API_KEY is not set on the edge function.");
  return key;
}

export function createHf(): HfInference {
  return new HfInference(getHfKey());
}

function getGeminiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!key) throw new Error("GEMINI_API_KEY is not set on the edge function.");
  return key;
}

// Calls the Gemini generateContent endpoint. `parts` follows Google's
// content-part shape: plain strings become {text}, and callers can pass
// an inline_data part directly for images.
async function callGemini(
  label: string,
  parts: Array<
    { text: string } | { inline_data: { mime_type: string; data: string } }
  >,
  opts: { maxOutputTokens: number; temperature: number },
): Promise<string> {
  const model =
    resolvedGeminiModel ?? Deno.env.get("GEMINI_MODEL") ?? DEFAULT_GEMINI_MODEL;
  return await callGeminiWithModel(label, model, parts, opts);
}

// Separated from callGemini so a retired-model retry can call back in with
// a different model name without re-reading the env var.
async function callGeminiWithModel(
  label: string,
  model: string,
  parts: Array<
    { text: string } | { inline_data: { mime_type: string; data: string } }
  >,
  opts: { maxOutputTokens: number; temperature: number },
): Promise<string> {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${getGeminiKey()}`;

  // Thinking-enabled Gemini models spend part of maxOutputTokens on
  // internal reasoning before writing the actual reply, which is slower
  // and (if maxOutputTokens isn't generous) can eat the whole budget --
  // see the MAX_TOKENS handling below. Turn it down as far as each model
  // family allows so calls come back faster:
  //  - gemini-3.x: cannot fully disable thinking, but supports
  //    thinkingLevel; "low" is the fastest setting available.
  //  - gemini-2.5.x: supports thinkingBudget, and 0 fully disables it --
  //    this is the fastest option overall if you can accept slightly
  //    lower-quality output. Set GEMINI_MODEL=gemini-2.5-flash to use it.
  //  - anything else (legacy 2.0-era models, or an unrecognized future
  //    name after a self-heal retry): omit the field entirely, since an
  //    unsupported field name in generationConfig can itself trigger a
  //    400 on some model versions.
  let thinkingConfig: Record<string, unknown> | undefined;
  if (/^gemini-3/.test(model)) {
    thinkingConfig = { thinkingLevel: "low" };
  } else if (/^gemini-2\.5/.test(model)) {
    thinkingConfig = { thinkingBudget: 0 };
  }

  const res = await withTimeout(label, (signal) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: opts.temperature,
          maxOutputTokens: opts.maxOutputTokens,
          // Ask Gemini to emit raw JSON directly instead of prose that
          // happens to contain JSON. This skips markdown-fence wrapping
          // and any preamble/explanation the model might otherwise add,
          // which shaves a bit of generation time and removes a class of
          // parse failures -- parseJsonObject() below still runs as a
          // defensive fallback in case a model/version ignores this.
          responseMimeType: "application/json",
          ...(thinkingConfig ? { thinkingConfig } : {}),
        },
      }),
      signal,
    }),
  );

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    // Google's 404 for a retired model names its replacement directly
    // ("...use models/gemini-3.6-flash..."). Retry once against that
    // model so a Google-side rename doesn't take content generation down
    // until someone notices and edits GEMINI_MODEL by hand. Only applies
    // when GEMINI_MODEL wasn't explicitly set to this same retired name on
    // purpose -- we still retry in that case too, since the old name is
    // dead either way, but we log loudly so it's visible in the logs.
    if (res.status === 404) {
      const match = bodyText.match(/models\/([a-zA-Z0-9._-]+)/);
      const suggested = match?.[1];
      if (suggested && suggested !== model) {
        console.warn(
          `[ai] ${label}: model "${model}" was retired by Google, ` +
            `retrying once with "${suggested}" (update GEMINI_MODEL / ` +
            `DEFAULT_GEMINI_MODEL to stop seeing this warning):`,
          bodyText.slice(0, 300),
        );
        resolvedGeminiModel = suggested;
        return await callGeminiWithModel(label, suggested, parts, opts);
      }
    }
    // responseMimeType: "application/json" isn't accepted by every model
    // version -- if the call fails specifically because of that field,
    // retry once without it rather than losing the whole request.
    if (
      res.status === 400 &&
      /response_mime_type|responseMimeType/i.test(bodyText)
    ) {
      console.warn(
        `[ai] ${label}: model "${model}" rejected responseMimeType, ` +
          `retrying once without it:`,
        bodyText.slice(0, 300),
      );
      return await callGeminiPlainJson(label, model, parts, opts);
    }
    throw new Error(
      `${label} failed (HTTP ${res.status}): ${bodyText.slice(0, 300)}`,
    );
  }

  const text = extractGeminiText(label, await res.json());
  resolvedGeminiModel = model;
  return text;
}

// Fallback path used only when a model rejects responseMimeType outright
// -- identical to callGeminiWithModel but without that field.
async function callGeminiPlainJson(
  label: string,
  model: string,
  parts: Array<
    { text: string } | { inline_data: { mime_type: string; data: string } }
  >,
  opts: { maxOutputTokens: number; temperature: number },
): Promise<string> {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${getGeminiKey()}`;
  let thinkingConfig: Record<string, unknown> | undefined;
  if (/^gemini-3/.test(model)) {
    thinkingConfig = { thinkingLevel: "low" };
  } else if (/^gemini-2\.5/.test(model)) {
    thinkingConfig = { thinkingBudget: 0 };
  }
  const res = await withTimeout(label, (signal) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: opts.temperature,
          maxOutputTokens: opts.maxOutputTokens,
          ...(thinkingConfig ? { thinkingConfig } : {}),
        },
      }),
      signal,
    }),
  );
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(
      `${label} failed (HTTP ${res.status}): ${bodyText.slice(0, 300)}`,
    );
  }
  const text = extractGeminiText(label, await res.json());
  resolvedGeminiModel = model;
  return text;
}

function extractGeminiText(
  label: string,
  // deno-lint-ignore no-explicit-any
  data: any,
): string {
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p?.text ?? "")
      .join("") ?? "";
  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason;
    const finishReason = data?.candidates?.[0]?.finishReason;
    const usage = data?.usageMetadata;
    if (finishReason === "MAX_TOKENS") {
      // Gemini 2.5+/3.x models spend "thinking" tokens out of the same
      // maxOutputTokens budget as the visible reply, and Flash-tier models
      // can't fully disable thinking (2.5 with thinkingBudget:0 is the
      // exception). If thinking ate the whole budget, thoughtsTokenCount
      // will be high and candidatesTokenCount near zero.
      throw new Error(
        `${label} hit MAX_TOKENS with no visible output ` +
          `(thoughtsTokenCount=${usage?.thoughtsTokenCount ?? "?"}, ` +
          `candidatesTokenCount=${usage?.candidatesTokenCount ?? "?"}). ` +
          `The model's thinking budget likely consumed the whole ` +
          `maxOutputTokens allowance -- raise maxOutputTokens for this call.`,
      );
    }
    // Gemini returns no candidates when it blocks a response (safety
    // filters, recitation, etc.) -- surface why so it's visible in logs.
    throw new Error(
      `${label} returned no text${blockReason ? ` (blocked: ${blockReason})` : ""}${finishReason ? ` (finishReason: ${finishReason})` : ""}.`,
    );
  }
  if (data?.candidates?.[0]?.finishReason === "MAX_TOKENS") {
    console.warn(
      `[ai] ${label}: response was truncated by MAX_TOKENS -- output may ` +
        `be cut off mid-JSON. Consider raising maxOutputTokens for this call.`,
    );
  }
  return text;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// Extracts a JSON object from model output that may include prose or fences.
export function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/```(?:json)?/gi, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  const candidate = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    // Tolerate trailing commas (common with generated JSON).
    try {
      return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
}

function normalizeAnalysis(raw: Record<string, unknown>): ImageAnalysis {
  return {
    identifiedName: asString(raw.identifiedName),
    productType: asString(raw.productType) || "product",
    category: asString(raw.category),
    colors: asStringArray(raw.colors),
    size: asString(raw.size),
    material: asString(raw.material),
    keyFeatures: asStringArray(raw.keyFeatures),
    targetAudience: asString(raw.targetAudience),
    sellingPoints: asStringArray(raw.sellingPoints),
  };
}

const EMPTY_ANALYSIS: ImageAnalysis = {
  identifiedName: "",
  productType: "product",
  category: "",
  colors: [],
  size: "",
  material: "",
  keyFeatures: [],
  targetAudience: "",
  sellingPoints: [],
};

// Best-effort vision analysis with two fallbacks:
//  1. Gemini vision (image + prompt -> structured JSON directly)
//  2. HF caption model + Gemini text expansion
//  3. minimal analysis derived from the input filename
export async function analyzeImage(
  bytes: Uint8Array,
  fileName = "",
): Promise<ImageAnalysis> {
  // Attempt 1: Gemini multimodal call (returns structured JSON directly).
  try {
    const text = await callGemini(
      "Vision analysis",
      [
        { text: VISION_PROMPT },
        { inline_data: { mime_type: "image/jpeg", data: bytesToBase64(bytes) } },
      ],
      { maxOutputTokens: 900, temperature: 0.2 },
    );
    const parsed = parseJsonObject(text);
    if (parsed && Object.keys(parsed).length > 0) {
      return normalizeAnalysis(parsed);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[ai] vision analysis failed, falling back to caption:", msg);
    // A Gemini timeout already burned the call budget -- another HF +
    // Gemini round-trip would push the whole function over the edge
    // wall-clock limit. Skip straight to filename analysis instead.
    if (/timed out/i.test(msg)) {
      const slug = (fileName || "")
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[-_]+/g, " ")
        .trim();
      return {
        ...EMPTY_ANALYSIS,
        productType: slug || "product",
        keyFeatures: slug ? [slug] : [],
      };
    }
  }

  // Attempt 2: HF captioning model (small/legacy, likely still free),
  // then expand the caption into the analysis shape via Gemini.
  try {
    const hf = createHf();
    // NOTE: the HF client's `data` param needs a real Blob/ArrayBuffer.
    // `bytes as unknown as Blob` was a type-only cast -- at runtime it's
    // still a Uint8Array, which has none of the methods the client relies
    // on (.type, .arrayBuffer(), etc.), so this call was failing on every
    // invocation and silently falling through to fallbackContent(). Wrap
    // it in an actual Blob so the request body is built correctly.
    const imageBlob = new Blob([bytes], { type: "image/jpeg" });
    const caption = await withTimeout<{ generated_text?: string }>(
      "Caption model",
      (signal) =>
        hf.imageToText(
          { model: CAPTION_MODEL, data: imageBlob },
          { signal },
        ) as Promise<{ generated_text?: string }>,
      CAPTION_TIMEOUT_MS,
    );
    const captionText = (caption.generated_text || "").trim();
    if (captionText) {
      try {
        // A raw BLIP caption reads like "a bottle of shampoo on a white
        // background" -- accurate but robotic. Feed it through Gemini's
        // free tier with an explicit instruction to write it up the way a
        // person familiar with the product would, not as a caption dump.
        const text = await callGemini(
          "Caption expansion",
          [
            {
              text:
                `An image-captioning model produced this literal, robotic ` +
                `description of a product photo: "${captionText}". ` +
                `Using it only as a factual starting point, infer the product ` +
                `and rewrite the analysis in natural, authentic language, as ` +
                `a person who actually knows the product would describe it -- ` +
                `not a restatement of the caption. Note: you only have this ` +
                `text description, not the actual image, so for ` +
                `"identifiedName" only fill it in if the caption text itself ` +
                `names a specific brand/model/dish -- otherwise leave it as ` +
                `an empty string rather than guessing, since you cannot see ` +
                `logos or fine visual detail from text alone. ` +
                VISION_PROMPT,
            },
          ],
          { maxOutputTokens: 900, temperature: 0.3 },
        );
        const parsed = parseJsonObject(text);
        if (parsed && Object.keys(parsed).length > 0) {
          return normalizeAnalysis(parsed);
        }
      } catch (expandErr) {
        console.warn(
          "[ai] caption expansion failed, using raw caption:",
          expandErr instanceof Error ? expandErr.message : String(expandErr),
        );
      }
      return {
        ...EMPTY_ANALYSIS,
        keyFeatures: [captionText],
      };
    }
  } catch (err) {
    console.warn(
      "[ai] caption fallback failed, using filename analysis:",
      err instanceof Error ? err.message : String(err),
    );
    // fall through to filename-based analysis
  }

  // Attempt 3: minimal analysis from the file name.
  const slug = (fileName || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return {
    ...EMPTY_ANALYSIS,
    productType: slug || "product",
    keyFeatures: slug ? [slug] : [],
  };
}

// Generates title / short description / full description / keywords in
// one Gemini call. A 180-250 word listing is enough for the storefront
// and finishes well under the Edge Function timeout; the old 500-800
// word dual-call path regularly hit MAX_TOKENS / 45s timeouts.
export async function generateContent(
  analysis: ImageAnalysis,
  language: ContentLanguage = "en",
): Promise<GeneratedContent> {
  const prompt = language === "bn" ? CONTENT_PROMPT_BN : CONTENT_PROMPT_EN;
  const maxOutputTokens = language === "bn" ? 2200 : 1400;

  const text = await callGemini(
    "Content generation",
    [{ text: prompt + JSON.stringify(analysis) }],
    { maxOutputTokens, temperature: 0.6 },
  );

  const parsed = parseJsonObject(text);
  if (!parsed) {
    throw new Error("Could not parse AI-generated content.");
  }

  const title =
    asString(parsed.title).slice(0, 80) ||
    analysis.identifiedName ||
    analysis.productType;
  const short = asString(parsed.short_description).slice(0, 200);
  const description = asString(parsed.description);
  const keywords = asStringArray(parsed.keywords).slice(0, 12);

  if (!description) throw new Error("AI returned an empty description.");

  return {
    title,
    short_description: short,
    description,
    keywords,
  };
}

// Non-AI fallback so a transient AI outage can never block the pipeline.
// Builds minimal but valid content from the analysis + file name. For
// "bn" it produces a Bangla description using the same facts.
export function fallbackContent(
  analysis: ImageAnalysis,
  fileName = "",
  language: ContentLanguage = "en",
): GeneratedContent {
  const subject =
    analysis.identifiedName ||
    analysis.productType ||
    analysis.category ||
    "this product";
  const titleBase = (
    analysis.identifiedName ||
    analysis.productType ||
    fileName.split(".")[0] ||
    "product"
  )
    .replace(/[-_]+/g, " ")
    .trim();
  const title =
    titleBase.slice(0, 60) || `Premium ${String(subject).slice(0, 40)}`;

  const keywordPhrases = [
    title,
    `${title} price`,
    `buy ${title} online`,
    `${title} near me`,
    ...analysis.colors.map((c) => `${c} ${title}`),
    ...analysis.keyFeatures.slice(0, 4),
  ]
    .filter((k) => k.trim())
    .slice(0, 12);

  const features = analysis.keyFeatures.length
    ? analysis.keyFeatures
        .slice(0, 6)
        .map((f) => `• ${f}`)
        .join("\n")
    : `• High quality ${subject}\n• Great value for money`;

  const bn = language === "bn";
  const description = bn
    ? `আমাদের ${subject} পরিচিতি। এই পণ্যটি মান ও মূল্যের জন্য যত্নসহকারে বাছাই করা হয়েছে, যা আপনার দৈনন্দিন জীবনে একটি চমৎকার সংযোজন।\n\n${features}\n\n${analysis.targetAudience || "দৈনন্দিন ব্যবহারের"} জন্য উপযুক্ত, এই পণ্যটি নির্ভরযোগ্য মানসম্পন্ন সেবা ও দীর্ঘস্থায়ী সন্তুষ্টি নিশ্চিত করতে তৈরি। এখনই অর্ডার করুন এবং পার্থক্যটি অনুভব করুন।`
    : `Introducing our ${subject}. This item has been carefully selected for ` +
      `quality and value, making it an excellent addition to your everyday life.\n\n` +
      `${features}\n\n` +
      `Perfect for ${analysis.targetAudience || "everyday use"}, this product is ` +
      `designed to deliver reliable performance and long-lasting satisfaction. ` +
      `Order now and experience the difference.`;

  return {
    title,
    short_description: bn
      ? `${subject} — মানসম্পন্ন পণ্য যা আপনি বিশ্বাস করতে পারেন।`
      : `Discover our ${subject} — quality you can trust.`,
    description,
    keywords: keywordPhrases,
  };
}
