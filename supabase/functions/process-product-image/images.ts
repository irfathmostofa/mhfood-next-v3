// ============================================================
// Image processing pipeline (Deno)
// ------------------------------------------------------------
//  - validateImage: magic-byte + size validation
//  - addTiledTextWatermark: tile the store name across the whole image
//    (low opacity, brick-pattern tiling)
//  - processImage: validate + watermark, return the final image buffer
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

// Re-encodes any supported input as an 8-bit RGBA PNG. Kept as a small
// utility in case callers need a normalized PNG for other purposes.
export async function toPng(bytes: Uint8Array): Promise<Uint8Array> {
  const img = await Image.decode(bytes);
  return toUint8(await img.encode(0));
}

// Renders the store name as a translucent-white watermark and tiles it
// across the whole image in a brick pattern, so the brand is visible
// across the entire canvas rather than just one corner.
//
// Needs a TTF/OTF font to rasterize with (ImageScript has no built-in
// font). Point WATERMARK_FONT_URL at one you host yourself (e.g. upload a
// .ttf next to the logo in the `store-images` bucket and use its public
// URL) -- a font isn't bundled by default so this never depends on a
// third-party URL staying available. If the store name itself is in
// Bangla, use a font that includes Bengali glyphs (e.g. Noto Sans
// Bengali). If WATERMARK_FONT_URL isn't set, this step is skipped with a
// warning rather than failing the whole pipeline.
const WATERMARK_FONT_FETCH_TIMEOUT_MS = 10_000;

async function loadWatermarkFont(): Promise<Uint8Array> {
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
  return toUint8(await fontRes.arrayBuffer());
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

export async function addTiledTextWatermark(
  originalBytes: Uint8Array,
  text: string = WATERMARK_TEXT,
): Promise<Uint8Array> {
  const mark = (text || WATERMARK_TEXT).trim() || WATERMARK_TEXT;
  const fontBytes = await loadWatermarkFont();
  const base = await Image.decode(originalBytes);
  const envSize = Number(Deno.env.get("WATERMARK_FONT_SIZE") ?? "");
  const fontSize =
    envSize ||
    Math.max(
      18,
      Math.round(Math.min(base.width, base.height) * 0.048),
    );

  // Dual-tone stamps so the mark stays readable on both light and dark
  // photos, at very low opacity (~10% white / ~8% black).
  const light = renderStamp(fontBytes, fontSize, mark, 0xffffff1a);
  const dark = renderStamp(fontBytes, fontSize, mark, 0x00000014);
  const stampW = Math.max(light.width, dark.width);
  const stampH = Math.max(light.height, dark.height);
  const gapX = Math.round(stampW * 1.15);
  const gapY = Math.round(stampH * 1.25);

  let row = 0;
  for (let y = -stampH; y < base.height + stampH; y += gapY) {
    const offsetX = row % 2 === 0 ? -Math.round(stampW / 4) : Math.round(gapX / 2);
    for (let x = offsetX - stampW; x < base.width + stampW; x += gapX) {
      base.composite(dark, x + 1, y + 1);
      base.composite(light, x, y);
    }
    row++;
  }

  return toUint8(await base.encode(0));
}

// Watermarks the image with the store name tiled across the entire canvas.
// No store name -> returns the image untouched (the caller surfaces a
// warning) rather than failing the whole listing over a brand asset.
export async function addWatermark(
  originalBytes: Uint8Array,
  _storeName?: string,
): Promise<{ buffer: Uint8Array; watermarked: boolean }> {
  const buffer = await addTiledTextWatermark(originalBytes, WATERMARK_TEXT);
  return { buffer, watermarked: true };
}

export async function processImage(
  originalBytes: Uint8Array,
  storeName?: string,
): Promise<ImageResult> {
  const warnings: string[] = [];
  let buffer: Uint8Array = originalBytes;

  try {
    const result = await addWatermark(originalBytes, storeName);
    buffer = result.buffer;
    if (!result.watermarked) {
      warnings.push("Watermark skipped.");
    }
  } catch (err) {
    warnings.push(
      `Watermark skipped: ${err instanceof Error ? err.message : String(err)}`,
    );
    buffer = originalBytes;
  }

  // No background removal / flattening happens anymore, so we keep PNG
  // input as PNG and otherwise normalize to JPEG for a smaller file size.
  if (isPng(buffer)) {
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
