"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";

const BUCKET = "store-images";
const DEFAULT_MAX_WIDTH = 1600;
const QUALITY = 0.82;

// Draw the source image onto a canvas at a reduced size and re-encode it
// to WebP. This typically shrinks an upload by 70–90% with no visible
// quality loss for on-screen images.
function compressImage(file, maxWidth) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const scale = Math.min(1, maxWidth / img.width);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Could not encode image."));
              return;
            }
            resolve({
              blob,
              width,
              height,
              mime: "image/webp",
              ext: "webp",
            });
          },
          "image/webp",
          QUALITY,
        );
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected file is not a valid image."));
    };
    img.src = objectUrl;
  });
}

export default function ImageUploader({
  value,
  onChange,
  folder = "images",
  maxWidth = DEFAULT_MAX_WIDTH,
  label = "Image",
  aspect = "auto",
  hint,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const { blob, ext } = await compressImage(file, maxWidth);
      const path = `${folder}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    onChange("");
  }

  const previewClass =
    aspect === "wide"
      ? "aspect-[21/9]"
      : aspect === "square"
        ? "aspect-square"
        : "aspect-[4/3]";

  return (
    <div>
      <label className="label">{label}</label>

      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-line bg-primary/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Preview"
            className={`w-full object-cover ${previewClass}`}
          />
          <button
            type="button"
            onClick={removeImage}
            aria-label="Remove image"
            className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
          >
            <X size={15} />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-2 left-2 btn btn-outline btn-sm bg-surface/90 disabled:opacity-60"
          >
            <Upload size={13} /> Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`w-full ${previewClass} rounded-xl border-2 border-dashed border-line text-muted hover:border-accent hover:text-accent transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {uploading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Optimizing &amp; uploading...
            </>
          ) : (
            <>
              <ImageIcon size={20} />
              <span className="text-xs font-medium">
                {value ? "Replace" : "Upload image"}
              </span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFile}
        className="hidden"
      />

      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
      {hint && !error && (
        <p className="text-xs text-muted mt-1.5">{hint}</p>
      )}
      {!hint && !error && (
        <p className="text-xs text-muted mt-1.5">
          Auto-compressed and optimized before upload — stored in Supabase
          Storage.
        </p>
      )}
    </div>
  );
}
