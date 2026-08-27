// ============================================================
// Image processing pipeline (Deno)
// ------------------------------------------------------------
//  - validateImage: magic-byte + size validation
//  - removeBackground: Hugging Face segmentation model -> transparent cutout
//  - flattenOntoWhite: composite the cutout onto a solid white canvas
//  - addLogoWatermark: overlay the system logo (bottom-right, 80% opacity)
//  - processImage: chain the steps and return a white-background PNG/JPEG
//
// Non-critical steps (background removal / flatten / watermark) are
// best-effort: a failure logs a warning and processing continues with the
// previous image so a model hiccup can't block the whole listing. If
// background removal itself fails, we skip the white-background step too
// (no reliable foreground/background split to flatten against) and fall
// back to the original photo with just a watermark attempt.
// ============================================================
// IMPORTANT: import imagescript from its Deno-native source, not via the
// `npm:` specifier. The npm build bundles a Node-only native codec loader
// (codecs/node/index.js) that does platform detection and throws
// "unsupported arch/platform: Not supported" immediately at import time on
// Supabase's Edge Runtime -- before any of our code or try/catch runs, so
// it crashes the whole function on every invocation. Supabase's own docs
// are explicit about this class of bug: Edge Functions only support
// WASM-based image libraries, not ones with native bindings (same reason
// `sharp` doesn't work here). The deno.land/x build of imagescript is the
// original target platform for this library and has no such native path.
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { PNG } from "npm:pngjs@7.0.0";
import { Buffer } from "node:buffer";
import { createHf } from "./hf.ts";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const LOGO_MAX_SIZE = 200;
const LOGO_MARGIN = 16;

// Same rationale as hf.ts: no HF call in this pipeline should be allowed
// to hang until Supabase's platform kills the whole function (-> raw 502).
const HF_CALL_TIMEOUT_MS = 20_000;
const LOGO_FETCH_TIMEOUT_MS = 10_000;

export interface ImageResult {
  buffer: Uint8Array;
  mime: string;
  warnings: string[];
}

function toUint8(data: ArrayBuffer | Uint8Array): Uint8Array {
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(data);
}

// Validates JPEG / PNG / WebP by magic bytes and enforces the size cap.
export function validateImage(bytes: Uint8Array): { ext: string } {
  if (bytes.byteLength === 0) throw new Error("Image is empty.");
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error("Image is larger than the 10 MB limit.");
  }
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { ext: "png" };
  }
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return { ext: "webp" };
  }
  throw new Error("Unsupported image format. Use JPEG, PNG or WebP.");
}

// Re-encodes any supported input as an 8-bit RGBA PNG.
export async function toPng(bytes: Uint8Array): Promise<Uint8Array> {
  const img = await Image.decode(bytes);
  return toUint8(await img.encode(0));
}

// briaai/RMBG-1.4 and RMBG-2.0 are no longer hosted by any Hugging Face
// Inference Provider on the free hf-inference tier as of mid-2026 (RMBG-2.0
// is only routed through fal-ai, a paid partner) -- this is an ecosystem
// change on HF's side, not something fixable in this code. The best
// remaining genuinely-free option is a general panoptic segmentation
// model: it labels every pixel as either a "thing" (a countable object --
// "cell phone", "bottle", "pizza", ...) or "stuff" (background-like --
// "wall-other-merged", "floor-wood", "sky-other-merged", ...). We treat
// the union of all "thing" segments as the foreground. This is an
// approximation, not a purpose-built cutout model: edges will be less
// clean than RMBG's soft matte, and any object outside the model's ~80
// known categories won't be recognized as foreground at all -- if that
// happens we throw so processImage() falls back to the untouched photo
// rather than producing a blank/wrongly-cut image.
//
// If you want RMBG-2.0's higher quality and are fine using a provider
// with usage-based billing beyond a limited free allowance, override:
//   HF_BG_REMOVE_PROVIDER=fal-ai
//   HF_BG_REMOVE_MODEL=briaai/RMBG-2.0
const DEFAULT_BG_REMOVE_MODEL = "facebook/detr-resnet-50-panoptic";
const DEFAULT_BG_REMOVE_PROVIDER = "hf-inference";

// COCO-panoptic "stuff" (background-like) labels are consistently
// hyphenated ("wall-other-merged", "floor-wood", "sky-other-merged", ...)
// while "thing" (countable object) labels aren't ("bottle", "cell phone",
// "pizza", ...) -- a reliable-enough split without hardcoding the full
// label list. One deliberate override: COCO buckets miscellaneous
// home-cooked/plated food into the "stuff" category "food-other-merged"
// even though for a food-listing app (see the "MHFood" User-Agent below)
// that's almost always exactly the foreground subject -- so we treat it
// as foreground despite the hyphen.
const FOREGROUND_STUFF_OVERRIDES = new Set(["food-other-merged"]);
function isBackgroundLabel(label: string): boolean {
  return label.includes("-") && !FOREGROUND_STUFF_OVERRIDES.has(label);
}

// Removes the background using a free HF segmentation model, then bakes
// the combined foreground mask into the alpha channel. Returns a
// transparent PNG.
export async function removeBackground(
  originalBytes: Uint8Array,
): Promise<{ buffer: Uint8Array; note: string }> {
  const hf = createHf();
  const model = Deno.env.get("HF_BG_REMOVE_MODEL") ?? DEFAULT_BG_REMOVE_MODEL;
  const provider =
    Deno.env.get("HF_BG_REMOVE_PROVIDER") ?? DEFAULT_BG_REMOVE_PROVIDER;

  const originalPng = await toPng(originalBytes);
  const base = PNG.sync.read(Buffer.from(originalPng));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HF_CALL_TIMEOUT_MS);
  // NOTE: unlike hf.imageToText()/hf.automaticSpeechRecognition(), the
  // image-segmentation provider helper does NOT accept a legacy `data`
  // field -- @huggingface/inference's HFInferenceImageSegmentationTask.
  // preparePayloadAsync() reads `args.inputs` directly and calls
  // `.arrayBuffer()` on it. Passing `data:` here left `inputs` undefined,
  // so the client crashed with "Cannot read properties of undefined
  // (reading 'arrayBuffer')" on every single call, before our code or its
  // try/catch ever ran. The field MUST be named `inputs`.
  const segmentationBlob = new Blob([originalBytes], { type: "image/png" });
  let outputs;
  try {
    outputs = await hf.imageSegmentation(
      {
        model,
        provider,
        inputs: segmentationBlob,
        // Explicit, rather than relying on the model's own default --
        // some providers/models default to "instance" or "semantic" for
        // DETR-panoptic checkpoints depending on how they wired it up,
        // which changes the label set entirely.
        parameters: { subtask: "panoptic" },
      },
      { signal: controller.signal },
    );
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(
        `Background removal timed out after ${HF_CALL_TIMEOUT_MS}ms`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!outputs || outputs.length === 0) {
    throw new Error("Background removal returned no segments.");
  }

  const foregroundSegments = outputs.filter(
    (o) => !isBackgroundLabel(o.label ?? ""),
  );
  if (foregroundSegments.length === 0) {
    throw new Error(
      "No recognizable foreground object in this photo (only " +
        `background-like regions were detected: ${outputs.map((o) => o.label).join(", ")}) -- keeping the original.`,
    );
  }

  // Union (pixel-wise max) of every foreground segment's mask, since a
  // photo can contain more than one foreground object (e.g. a phone and
  // its charger) and we want all of them kept, not just the first.
  const combinedMask = new Uint8ClampedArray(base.width * base.height);
  let usableSegments = 0;
  for (const segment of foregroundSegments) {
    try {
      if (!segment?.mask) continue;
      // The HF-Inference image-segmentation response defines `mask` as a
      // base64-encoded PNG *string* (see @huggingface/tasks'
      // ImageSegmentationOutputElement), not a Blob -- it has no
      // .arrayBuffer() method. Some providers prefix it as a data URL
      // ("data:image/png;base64,..."), so strip that if present before
      // decoding.
      const maskBase64 = segment.mask.includes(",")
        ? segment.mask.slice(segment.mask.indexOf(",") + 1)
        : segment.mask;
      const maskBytes = Uint8Array.from(atob(maskBase64), (c) => c.charCodeAt(0));
      const maskImg = await Image.decode(maskBytes);
      if (maskImg.width !== base.width || maskImg.height !== base.height) {
        maskImg.resize(base.width, base.height);
      }
      const maskPng = PNG.sync.read(
        Buffer.from(toUint8(await maskImg.encode(0))),
      );
      const maskData = maskPng.data;
      for (let i = 0; i < combinedMask.length; i++) {
        const r = maskData[i * 4];
        const g = maskData[i * 4 + 1];
        const b = maskData[i * 4 + 2];
        const a = maskData[i * 4 + 3];
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const value = Math.min(a, luma);
        if (value > combinedMask[i]) combinedMask[i] = value;
      }
      usableSegments++;
    } catch (err) {
      // This provider/model combo can return a segment shape the HF
      // client doesn't fully expect for every label; skip that one
      // segment rather than losing the whole background-removal attempt
      // over it. Logged with the raw segment so a real pattern (vs. a
      // one-off) is diagnosable from function logs.
      console.warn(
        `[images] skipping unusable segment "${segment?.label}":`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  if (usableSegments === 0) {
    throw new Error(
      "Found foreground labels but couldn't read any of their masks " +
        "(unexpected response shape from this model/provider) -- keeping the original.",
    );
  }

  const baseData = base.data;
  let clearedPixels = 0;
  for (let i = 0; i < combinedMask.length; i++) {
    baseData[i * 4 + 3] = combinedMask[i];
    if (combinedMask[i] < 128) clearedPixels++;
  }
  const clearedPct = Math.round((clearedPixels / combinedMask.length) * 100);

  // This is the case that used to fail silently: no error, no crash, but
  // almost nothing was actually classified as background (e.g. because
  // the surface/table/prop the product sits on is itself a COCO "thing"
  // label -- see the isBackgroundLabel note above -- so it got kept as
  // "foreground" right along with the product). The photo comes out
  // basically unchanged even though whiteBackground gets set to true.
  // Surface that as an explicit, always-visible note instead of leaving
  // it indistinguishable from "it worked".
  let note = "";
  if (clearedPct < 5) {
    note =
      `Background removal ran (labels: ${outputs.map((o) => o.label).join(", ")}) ` +
      `but classified only ~${clearedPct}% of the photo as background, so the ` +
      "white-background effect will look minimal or absent. This usually means " +
      "the surface/prop the product sits on was itself detected as a foreground " +
      "\"thing\" (e.g. a table, plate, or similar) rather than background -- try " +
      "a plainer backdrop (solid wall/floor, no table edge in frame), or override " +
      "HF_BG_REMOVE_MODEL with a dedicated cutout model if you have a paid " +
      "provider available.";
  }

  return { buffer: toUint8(PNG.sync.write(base)), note };
}

// Composites a transparent-background PNG (as produced by removeBackground)
// onto a solid opaque white canvas, baking the alpha channel into RGB.
// Standard "over" alpha compositing against white: result = fg*a + white*(1-a).
// Downstream steps then see a fully opaque white-background image instead
// of having to special-case transparency.
export function flattenOntoWhite(pngBytes: Uint8Array): Uint8Array {
  const png = PNG.sync.read(Buffer.from(pngBytes));
  const data = png.data;
  const pixelCount = png.width * png.height;
  for (let i = 0; i < pixelCount; i++) {
    const a = data[i * 4 + 3] / 255;
    data[i * 4] = Math.round(data[i * 4] * a + 255 * (1 - a));
    data[i * 4 + 1] = Math.round(data[i * 4 + 1] * a + 255 * (1 - a));
    data[i * 4 + 2] = Math.round(data[i * 4 + 2] * a + 255 * (1 - a));
    data[i * 4 + 3] = 255;
  }
  return toUint8(PNG.sync.write(png));
}

// Overlays the store logo in the bottom-right corner at 80% opacity,
// capped at 200px on the longest edge.
export async function addLogoWatermark(
  pngBytes: Uint8Array,
  logoUrl?: string,
): Promise<Uint8Array> {
  if (!logoUrl) return pngBytes;

  const base = await Image.decode(pngBytes);

  const logoController = new AbortController();
  const logoTimer = setTimeout(
    () => logoController.abort(),
    LOGO_FETCH_TIMEOUT_MS,
  );
  let logoRes: Response;
  try {
    logoRes = await fetch(logoUrl, {
      headers: { "User-Agent": "MHFood-EdgeFunction" },
      signal: logoController.signal,
    });
  } catch (err) {
    if (logoController.signal.aborted) {
      throw new Error(`Logo fetch timed out after ${LOGO_FETCH_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(logoTimer);
  }
  if (!logoRes.ok)
    throw new Error(`Could not fetch logo (HTTP ${logoRes.status}).`);
  const logoBytes = toUint8(await logoRes.arrayBuffer());

  // ImageScript (this pipeline's image library -- see the top-of-file note
  // on why `sharp` can't be used here) can only *decode* PNG/JPEG/GIF/TIFF;
  // it can *encode* WebP but not read it back in. A WebP logo will fail
  // here with an opaque "Unsupported image type" unless we catch it early.
  const contentType = logoRes.headers.get("content-type") ?? "";
  if (contentType.includes("webp") || /\.webp(\?|$)/i.test(logoUrl)) {
    throw new Error(
      "Logo is a WebP image, which this pipeline's image library can't " +
        "decode. Re-export the logo as PNG (or JPEG) and update " +
        "PRODUCT_LOGO_URL to point at that file -- this is a one-time " +
        "asset conversion, not a code change.",
    );
  }

  let logo;
  try {
    logo = await Image.decode(logoBytes);
  } catch (err) {
    throw new Error(
      `Could not decode logo image (must be PNG, JPEG, GIF, or TIFF): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  const longest = Math.max(logo.width, logo.height);
  const scale = Math.min(1, LOGO_MAX_SIZE / longest);
  const lw = Math.max(1, Math.round(logo.width * scale));
  const lh = Math.max(1, Math.round(logo.height * scale));
  if (lw !== logo.width || lh !== logo.height) logo.resize(lw, lh);

  // 80% opacity, then composite bottom-right with a small margin.
  logo.opacity(0.8);
  base.composite(
    logo,
    Math.max(0, base.width - lw - LOGO_MARGIN),
    Math.max(0, base.height - lh - LOGO_MARGIN),
  );

  return toUint8(await base.encode(0));
}

// Renders `text` (typically the store name) as a translucent-white
// watermark and composites it bottom-right, in the same spot the logo
// would go. Used as a fallback when there's no logo configured, or the
// logo watermark step failed for some reason (missing/broken URL, wrong
// format, network hiccup, etc.) -- so a listing still gets *some*
// watermark instead of none.
//
// Needs a TTF/OTF font to rasterize with (ImageScript has no built-in
// font). Point WATERMARK_FONT_URL at one you host yourself (e.g. upload a
// .ttf next to the logo in the `store-images` bucket and use its public
// URL) -- a font isn't bundled by default so this never depends on a
// third-party URL staying available. If it isn't set, this step is
// skipped with a warning rather than failing the whole pipeline.
const WATERMARK_FONT_FETCH_TIMEOUT_MS = 10_000;
const WATERMARK_FONT_SIZE = 34;

export async function addTextWatermark(
  pngBytes: Uint8Array,
  text: string,
): Promise<Uint8Array> {
  const fontUrl = Deno.env.get("WATERMARK_FONT_URL") ?? "";
  if (!fontUrl) {
    throw new Error(
      "WATERMARK_FONT_URL is not set on the edge function, so no font is " +
        "available to render a text watermark -- upload a .ttf/.otf " +
        "somewhere public (e.g. the store-images bucket) and set that env var.",
    );
  }

  const fontController = new AbortController();
  const fontTimer = setTimeout(
    () => fontController.abort(),
    WATERMARK_FONT_FETCH_TIMEOUT_MS,
  );
  let fontRes: Response;
  try {
    fontRes = await fetch(fontUrl, { signal: fontController.signal });
  } catch (err) {
    if (fontController.signal.aborted) {
      throw new Error(
        `Watermark font fetch timed out after ${WATERMARK_FONT_FETCH_TIMEOUT_MS}ms`,
      );
    }
    throw err;
  } finally {
    clearTimeout(fontTimer);
  }
  if (!fontRes.ok) {
    throw new Error(`Could not fetch watermark font (HTTP ${fontRes.status}).`);
  }
  const fontBytes = toUint8(await fontRes.arrayBuffer());

  const base = await Image.decode(pngBytes);
  // White text at 85% opacity reads reasonably well on most product
  // photos; renderText's `color` alpha channel controls this directly.
  const textImg = Image.renderText(fontBytes, WATERMARK_FONT_SIZE, text, 0xffffffd9);
  base.composite(
    textImg,
    Math.max(0, base.width - textImg.width - LOGO_MARGIN),
    Math.max(0, base.height - textImg.height - LOGO_MARGIN),
  );
  return toUint8(await base.encode(0));
}

// Tries the logo watermark first; if there's no logo configured or that
// step fails, falls back to a text watermark using the store name (when
// one was passed in) instead of leaving the image completely unmarked.
export async function addWatermark(
  pngBytes: Uint8Array,
  logoUrl?: string,
  storeName?: string,
): Promise<Uint8Array> {
  if (logoUrl) {
    try {
      return await addLogoWatermark(pngBytes, logoUrl);
    } catch (err) {
      if (!storeName) throw err;
      console.warn(
        "[images] logo watermark failed, falling back to store-name text watermark:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  if (storeName) return addTextWatermark(pngBytes, storeName);
  return pngBytes;
}

export async function processImage(
  originalBytes: Uint8Array,
  logoUrl?: string,
  storeName?: string,
): Promise<ImageResult> {
  const warnings: string[] = [];

  let buffer: Uint8Array = originalBytes;
  let whiteBackground = false;

  try {
    const cutout = await removeBackground(originalBytes);
    buffer = flattenOntoWhite(cutout.buffer);
    whiteBackground = true;
    if (cutout.note) warnings.push(`[bg-removal] ${cutout.note}`);
  } catch (err) {
    // No reliable foreground/background split -> we can't force a white
    // background without risking cutting into the actual product, so we
    // fall back to the original photo untouched rather than guessing.
    warnings.push(
      `White background skipped (background removal failed): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    buffer = await addWatermark(buffer, logoUrl, storeName);
  } catch (err) {
    warnings.push(
      `Watermark skipped: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Once flattened onto white, there's no transparency left worth
  // preserving as PNG -- JPEG gives a smaller file for the same solid
  // background. Only keep PNG when we never flattened and the source
  // already happened to be a PNG.
  if (!whiteBackground && isPng(buffer)) {
    return { buffer, mime: "image/png", warnings };
  }

  const img = await Image.decode(buffer);
  const jpeg = await img.encodeJPEG(92);
  return { buffer: toUint8(jpeg), mime: "image/jpeg", warnings };
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}