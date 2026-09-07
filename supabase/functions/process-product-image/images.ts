// ============================================================
// Image processing pipeline (Deno)
// ------------------------------------------------------------
//  - validateImage: magic-byte + size validation
//  - addTiledTextWatermark: tile the store name across the whole image
//    (low opacity, brick-pattern tiling)
//  - processImage: downscale + watermark + JPEG encode
//  - prepareVisionJpeg: small JPEG for Gemini vision (fast upload)
//
// Background removal / white-background flattening has been removed
// entirely -- we now watermark the original product photo directly.
// Watermarking is best-effort: a failure logs a warning and processing
// continues with the unwatermarked photo, so a font-fetch hiccup or
// missing store name can never block the whole listing.
// ============================================================
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const WATERMARK_TEXT = "M.H.Food";
const WATERMARK_ANGLE = -32;
const DEFAULT_FONT_URL =
  "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf";
const MAX_OUTPUT_DIM = 1400;
const VISION_MAX_DIM = 1024;
const WATERMARK_FONT_FETCH_TIMEOUT_MS = 5_000;

export interface ImageResult {
  buffer: Uint8Array;
  mime: string;
  warnings: string[];
}

let cachedFontBytes: Uint8Array | null = null;

function toUint8(data: ArrayBuffer | Uint8Array): Uint8Array {
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(data);
}

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

export async function toPng(bytes: Uint8Array): Promise<Uint8Array> {
  const img = await Image.decode(bytes);
  return toUint8(await img.encode(0));
}

function scaleDown(img: Image, maxDim: number): void {
  const longest = Math.max(img.width, img.height);
  if (longest <= maxDim) return;
  const scale = maxDim / longest;
  img.resize(
    Math.max(1, Math.round(img.width * scale)),
    Math.max(1, Math.round(img.height * scale)),
  );
}

async function loadWatermarkFont(): Promise<Uint8Array> {
  if (cachedFontBytes) return cachedFontBytes;
  const fontUrl = Deno.env.get("WATERMARK_FONT_URL") || DEFAULT_FONT_URL;
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
  cachedFontBytes = toUint8(await fontRes.arrayBuffer());
  return cachedFontBytes;
}

function renderStamp(
  fontBytes: Uint8Array,
  fontSize: number,
  text: string,
  color: number,
) {
  let stamp = Image.renderText(fontBytes, fontSize, text, color);
  try {
    stamp = stamp.rotate(WATERMARK_ANGLE, true);
  } catch {
    // Keep the unrotated stamp if rotate is unavailable.
  }
  return stamp;
}

function applyTiledWatermark(base: Image, text: string, fontBytes: Uint8Array) {
  const envSize = Number(Deno.env.get("WATERMARK_FONT_SIZE") ?? "");
  const fontSize =
    envSize ||
    Math.max(16, Math.round(Math.min(base.width, base.height) * 0.042));

  const light = renderStamp(fontBytes, fontSize, text, 0xffffff1a);
  const dark = renderStamp(fontBytes, fontSize, text, 0x00000014);
  const stampW = Math.max(light.width, dark.width);
  const stampH = Math.max(light.height, dark.height);
  const gapX = Math.round(stampW * 1.55);
  const gapY = Math.round(stampH * 1.7);

  let row = 0;
  for (let y = -stampH; y < base.height + stampH; y += gapY) {
    const offsetX =
      row % 2 === 0 ? -Math.round(stampW / 4) : Math.round(gapX / 2);
    for (let x = offsetX - stampW; x < base.width + stampW; x += gapX) {
      base.composite(dark, x + 1, y + 1);
      base.composite(light, x, y);
    }
    row++;
  }
}

export async function addTiledTextWatermark(
  originalBytes: Uint8Array,
  text: string = WATERMARK_TEXT,
): Promise<Uint8Array> {
  const mark = (text || WATERMARK_TEXT).trim() || WATERMARK_TEXT;
  const fontBytes = await loadWatermarkFont();
  const base = await Image.decode(originalBytes);
  applyTiledWatermark(base, mark, fontBytes);
  return toUint8(await base.encodeJPEG(88));
}

export async function addWatermark(
  originalBytes: Uint8Array,
  storeName?: string,
): Promise<{ buffer: Uint8Array; watermarked: boolean }> {
  const mark = (storeName || WATERMARK_TEXT).trim() || WATERMARK_TEXT;
  const buffer = await addTiledTextWatermark(originalBytes, mark);
  return { buffer, watermarked: true };
}

export async function prepareVisionJpeg(
  originalBytes: Uint8Array,
): Promise<Uint8Array> {
  const img = await Image.decode(originalBytes);
  scaleDown(img, VISION_MAX_DIM);
  return toUint8(await img.encodeJPEG(78));
}

export async function processImage(
  originalBytes: Uint8Array,
  storeName?: string,
): Promise<ImageResult> {
  const pipeline = await startImagePipeline(originalBytes, storeName);
  return await pipeline.finishProcessed();
}

// Decode once, emit a small JPEG for Gemini, then watermark the same
// in-memory image. Callers should fire vision as soon as visionJpeg is
// ready so watermarking overlaps the AI round-trip.
export async function startImagePipeline(
  originalBytes: Uint8Array,
  storeName?: string,
): Promise<{
  visionJpeg: Uint8Array;
  finishProcessed: () => Promise<ImageResult>;
}> {
  const warnings: string[] = [];
  const img = await Image.decode(originalBytes);
  scaleDown(img, MAX_OUTPUT_DIM);
  const visionJpeg = toUint8(await img.encodeJPEG(78));

  const finishProcessed = async (): Promise<ImageResult> => {
    try {
      const mark = (storeName || WATERMARK_TEXT).trim() || WATERMARK_TEXT;
      const fontBytes = await loadWatermarkFont();
      applyTiledWatermark(img, mark, fontBytes);
    } catch (err) {
      warnings.push(
        `Watermark skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const jpeg = await img.encodeJPEG(88);
    return { buffer: toUint8(jpeg), mime: "image/jpeg", warnings };
  };

  return { visionJpeg, finishProcessed };
}
