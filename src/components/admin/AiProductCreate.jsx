"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  UploadCloud,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Plus,
  X,
  Save,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { analyzeSEO } from "@/lib/seoAnalyzer";
import { slugify } from "@/lib/slugify";
import ProductFormFields from "./ProductFormFields";
import {
  saveProductVariants,
  hasActiveVariants,
  variantStockTotal,
} from "./VariantsEditor";
import { useToast } from "@/components/Toast";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const WATERMARK_STORE_NAME = "M.H.Food";
const AI_QUOTA_MESSAGE =
  "AI token/quota limit reached. Wait a few minutes and try again, or check your Gemini API quota.";

function isQuotaLimitMessage(msg) {
  return /quota|rate.?limit|resource.?exhausted|\b429\b|token.?limit|exceeded your current quota|billing|usage.?limit/i.test(
    String(msg || ""),
  );
}

// How long the "saved" confirmation banner stays up before the whole
// form resets and is ready for the next product.
const RESET_DELAY_MS = 1600;

function fileToJpegBlob(file, maxWidth = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve({ blob, width: w, height: h })
              : reject(new Error("Could not encode image.")),
          "image/jpeg",
          0.88,
        );
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The selected file is not a valid image."));
    };
    img.src = url;
  });
}

const PROGRESS_LABELS = {
  pending: "Queued for processing…",
  processing: "Processing image & generating content…",
  completed: "Complete",
  failed: "Processing failed",
};

// Fires a native browser notification if permission has been granted.
// Safe to call unconditionally — silently does nothing if Notification
// isn't supported or permission was never granted, so callers never need
// to check first. Clicking the notification focuses this tab.
function notify(title, body) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "ai-product-create", // replaces any earlier notification from this flow
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Some browsers (mostly older mobile Safari) throw on `new
    // Notification()` even when permission is granted — never let a
    // notification failure interrupt the actual flow.
  }
}

const EMPTY_FORM = {
  name: "",
  slug: "",
  short_description: "",
  description: "",
  cost: "",
  regular_price: "",
  price: "",
  stock: "0",
  unit: "",
  category_id: "",
  is_featured: false,
  is_active: true,
};

function toEditorHtml(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export default function AiProductCreate() {
  const { success, error: toastError } = useToast();
  const inputRef = useRef(null);
  const dragDepth = useRef(0);

  const [phase, setPhase] = useState("upload"); // upload | processing | naming | review
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);

  const [existingImages, setExistingImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loadingImages, setLoadingImages] = useState(false);

  const [productId, setProductId] = useState(null);
  const [status, setStatus] = useState(null); // pending|processing|awaiting_name|completed|failed
  const [progress, setProgress] = useState(0);
  const [processingError, setProcessingError] = useState("");
  const [warnings, setWarnings] = useState([]);

  const [language, setLanguage] = useState("en"); // en | bn
  const [processedImage, setProcessedImage] = useState("");

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [variants, setVariants] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [saving, setSaving] = useState(false);

  const startedAt = useRef(null);
  const sourcePathRef = useRef("");
  const resetTimerRef = useRef(null);

  // Lists previously uploaded raw images so the admin can reuse one instead
  // of uploading a new photo. Reloads each time the upload step is shown.
  async function loadExistingImages() {
    setLoadingImages(true);
    try {
      const { data } = await supabase.storage
        .from("product-images")
        .list("raw", {
          limit: 60,
          sortBy: { column: "created_at", order: "desc" },
        });
      const items = (data || [])
        .filter((f) => f.name && !f.name.endsWith("/"))
        .map((f) => {
          const path = `raw/${f.name}`;
          const { data: urlData } = supabase.storage
            .from("product-images")
            .getPublicUrl(path);
          return { name: f.name, path, url: urlData.publicUrl };
        });
      setExistingImages(items);
      setSelectedImage((prev) =>
        prev && !items.some((i) => i.path === prev.path) ? null : prev,
      );
    } finally {
      setLoadingImages(false);
    }
  }

  useEffect(() => {
    if (phase === "upload") loadExistingImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    supabase
      .from("categories")
      .select("id, name")
      .order("name")
      .then(({ data }) => setCategories(data || []));
  }, []);

  // Clear any pending reset timer on unmount.
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  // Ask for notification permission once, up front, so it's already
  // granted by the time a long-running generation finishes (asking at
  // that point would be too late to matter for the first product).
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Flash the browser tab title while generation is running, in case the
  // admin switches tabs and notifications are blocked/unsupported. Reverts
  // to the original title as soon as the phase changes.
  useEffect(() => {
    const originalTitle = document.title;
    if (phase !== "processing") {
      document.title = originalTitle;
      return;
    }
    let flip = false;
    const id = setInterval(() => {
      document.title = flip ? "⏳ Generating…" : originalTitle;
      flip = !flip;
    }, 1500);
    return () => {
      clearInterval(id);
      document.title = originalTitle;
    };
  }, [phase]);

  // Live SEO score computed from the current title + description.
  const seo = useMemo(
    () => analyzeSEO(form.name, form.description),
    [form.name, form.description],
  );

  // Real-time subscription + polling fallback for processing status.
  useEffect(() => {
    if (
      !productId ||
      status === "completed" ||
      status === "failed" ||
      status === "awaiting_name"
    )
      return;

    const channel = supabase
      .channel(`product-ai-${productId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "products",
          filter: `id=eq.${productId}`,
        },
        (payload) => handleStatus(payload.new),
      )
      .subscribe();

    const poller = setInterval(async () => {
      const { data } = await supabase
        .from("products")
        .select("id, processing_status, processing_errors, processed_image_url")
        .eq("id", productId)
        .maybeSingle();
      if (data) handleStatus(data);
    }, 5000);

    const timeout = setTimeout(() => clearInterval(poller), 3 * 60 * 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poller);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, status]);

  // Animate the progress bar while processing.
  useEffect(() => {
    if (status !== "processing") return;
    const id = setInterval(() => {
      const elapsed = startedAt.current
        ? (Date.now() - startedAt.current) / 1000
        : 0;
      setProgress(Math.min(82, 24 + elapsed * 1.4));
    }, 500);
    return () => clearInterval(id);
  }, [status]);

  const handleStatus = useCallback(
    async (row) => {
      setStatus(row.processing_status);
      if (row.processing_status === "processing") {
        setProgress(25);
        setProcessingError("");
      }
      if (row.processing_status === "completed") {
        setProgress(100);
        await loadProduct(row.id);
        setPhase("review");
        notify(
          "Listing ready ✅",
          "Your AI-generated product listing is ready to review.",
        );
      }
      if (row.processing_status === "awaiting_name") {
        if (isQuotaLimitMessage(row.processing_errors)) {
          setProgress(0);
          setProcessingError(AI_QUOTA_MESSAGE);
          setPhase("upload");
          notify("AI token/quota limit reached", AI_QUOTA_MESSAGE);
          return;
        }
        setProgress(100);
        await loadProduct(row.id);
        setForm((prev) => ({ ...prev, name: "", slug: "" }));
        setPhase("naming");
        setProcessingError("");
        notify(
          "Couldn't identify the product",
          "Add a product name to finish generating the listing.",
        );
      }
      if (row.processing_status === "failed") {
        if (isQuotaLimitMessage(row.processing_errors)) {
          setProgress(0);
          setProcessingError(AI_QUOTA_MESSAGE);
          setPhase("upload");
          notify("AI token/quota limit reached", AI_QUOTA_MESSAGE);
          return;
        }
        if (row.processed_image_url) {
          await loadProduct(row.id);
          setProgress(100);
          setPhase("naming");
          setProcessingError("");
          notify(
            "Couldn't identify the product",
            "Add a product name to finish generating the listing.",
          );
          return;
        }
        setProgress(0);
        setProcessingError(row.processing_errors || "Processing failed.");
        notify(
          "Processing failed",
          row.processing_errors ||
            "Something went wrong generating the listing.",
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function loadProduct(id) {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();
    if (!data) return;
    const loadedName = data.name || "";
    const loadedSlug = data.slug || "";
    const tempSlug = /^ai-[a-z0-9]+$/i.test(loadedSlug);
    setForm({
      name: loadedName,
      slug: !loadedSlug || tempSlug ? slugify(loadedName) : loadedSlug,
      short_description: data.short_description || "",
      description: toEditorHtml(data.description || ""),
      cost:
        data.cost != null && Number(data.cost) !== 0 ? String(data.cost) : "",
      regular_price:
        data.regular_price != null && Number(data.regular_price) !== 0
          ? String(data.regular_price)
          : "",
      price:
        data.price != null && Number(data.price) !== 0
          ? String(data.price)
          : "",
      stock: String(Number(data.stock) || 0),
      unit: data.unit || "",
      category_id: data.category_id || "",
      is_featured: !!data.is_featured,
      is_active: data.is_active !== false,
    });
    setKeywords(data.seo_keywords || []);
    const { data: variantRows } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", id)
      .order("created_at", { ascending: true });
    setVariants(variantRows || []);
    setProcessedImage(data.processed_image_url || "");
    if (data.processing_errors) {
      setWarnings(String(data.processing_errors).split("\n").filter(Boolean));
    }
  }

  async function startProcessing() {
    if (!file && !selectedImage) return;
    setStarting(true);
    setProcessingError("");
    setWarnings([]);
    try {
      let path = selectedImage?.path || "";
      if (file) {
        const { blob } = await fileToJpegBlob(file);
        path = `raw/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.jpg`;

        const { error: upError } = await supabase.storage
          .from("product-images")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (upError) throw new Error(upError.message);
      }
      sourcePathRef.current = path;

      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);

      const tempSlug = `ai-${Date.now().toString(36)}`;
      const { data: product, error: createError } = await supabase
        .from("products")
        .insert({
          name: "Untitled product",
          slug: tempSlug,
          price: 0,
          stock: 0,
          is_active: false,
          is_featured: false,
          processing_status: "pending",
          publish_status: "draft",
        })
        .select()
        .single();
      if (createError) throw new Error(createError.message);

      await supabase.from("product_images").insert([
        {
          product_id: product.id,
          image_url: urlData.publicUrl,
          alt_text: "Original",
          sort_order: 1,
        },
      ]);

      setProductId(product.id);
      setStatus("pending");
      setProgress(8);
      startedAt.current = Date.now();
      setPhase("processing");

      // Fire the pipeline. Status transitions are tracked via realtime/polling
      // so the UI keeps updating even if this request is slow.
      fetch("/api/admin/ai/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagePath: path,
          productId: product.id,
          language,
          storeName: WATERMARK_STORE_NAME,
        }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok && data?.error && isQuotaLimitMessage(data.error)) {
            setProcessingError(AI_QUOTA_MESSAGE);
            setStatus("failed");
            setPhase("upload");
          }
        })
        .catch(() => {});
    } catch (err) {
      setProcessingError(err.message || "Could not start processing.");
      setPhase("upload");
    } finally {
      setStarting(false);
    }
  }

  async function regenerate() {
    if (!productId || !sourcePathRef.current || !form.name.trim()) return;
    setStarting(true);
    setProcessingError("");
    setWarnings([]);
    try {
      const res = await fetch("/api/admin/ai/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate",
          imagePath: sourcePathRef.current,
          productId,
          name: form.name.trim(),
          language,
          storeName: WATERMARK_STORE_NAME,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Content generation failed.");
      }
      setStatus("completed");
      setProgress(100);
      await loadProduct(productId);
      setPhase("review");
    } catch (err) {
      setProcessingError(err.message || "Could not generate content.");
    } finally {
      setStarting(false);
    }
  }

  function onFileSelect(next) {
    if (!next) return;
    if (!ACCEPTED.includes(next.type)) {
      setProcessingError("Please choose a JPEG, PNG or WebP image.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setProcessingError("Image must be 10 MB or smaller.");
      return;
    }
    setProcessingError("");
    setSelectedImage(null);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
  }

  function onPickExisting(img) {
    setSelectedImage(img);
    setFile(null);
    setPreviewUrl("");
    setProcessingError("");
  }

  // Clears everything and returns to the upload step, ready for the next
  // product. Called automatically a moment after a successful save.
  function resetAll() {
    setPhase("upload");
    setFile(null);
    setPreviewUrl("");
    setUploading(false);
    setStarting(false);
    setSelectedImage(null);
    setProductId(null);
    setStatus(null);
    setProgress(0);
    setProcessingError("");
    setWarnings([]);
    setProcessedImage("");
    setForm(EMPTY_FORM);
    setVariants([]);
    setKeywords([]);
    sourcePathRef.current = "";
    startedAt.current = null;
  }

  async function save(publish) {
    if (!productId) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug:
        form.slug.trim() ||
        slugify(form.name) ||
        `ai-${Date.now().toString(36)}`,
      short_description: form.short_description.trim(),
      description: form.description.trim(),
      cost: Number(form.cost) || 0,
      regular_price: Number(form.regular_price) || 0,
      price: Number(form.price) || 0,
      stock: hasActiveVariants(variants)
        ? variantStockTotal(variants)
        : Number(form.stock) || 0,
      unit: (form.unit || "").trim(),
      category_id: form.category_id || null,
      is_featured: !!form.is_featured,
      seo_keywords: keywords.filter(Boolean),
      publish_status: publish ? "published" : "draft",
      is_active: publish,
    };
    try {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", productId);
      if (error) {
        setProcessingError(error.message);
        toastError(error.message);
        return;
      }
      await saveProductVariants(supabase, productId, variants);
      success(
        publish
          ? "Product published to your store."
          : "Draft saved. You can edit it from the Products page.",
      );
      notify(
        publish ? "Product published" : "Draft saved",
        publish
          ? `"${payload.name}" is now live on your store.`
          : `"${payload.name}" was saved as a draft.`,
      );
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(resetAll, RESET_DELAY_MS);
    } catch (err) {
      const msg = err.message || "Could not save product.";
      setProcessingError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  const estimate =
    status === "processing" && startedAt.current
        ? Math.max(
          1,
          Math.round((35 - (Date.now() - startedAt.current) / 1000) / 5),
        ) * 5
      : 35;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display text-ink">Create with AI</h1>
          <p className="text-sm text-muted mt-1">
            Upload a product photo — or pick one you have already uploaded — and
            generate a complete, SEO-ready listing.
          </p>
        </div>
        <Link href="/admin/products" className="btn btn-ghost shrink-0">
          <ArrowLeft size={15} /> Products
        </Link>
      </div>

      {(processingError || warnings.length > 0) && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 space-y-1 ${
            isQuotaLimitMessage(processingError)
              ? "border-amber-300 bg-amber-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          {processingError && (
            <p
              className={`text-sm flex items-start gap-2 ${
                isQuotaLimitMessage(processingError)
                  ? "text-amber-900"
                  : "text-red-700"
              }`}
            >
              {isQuotaLimitMessage(processingError) ? (
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              ) : (
                <XCircle size={16} className="shrink-0 mt-0.5" />
              )}
              <span>
                {isQuotaLimitMessage(processingError) && (
                  <strong className="block mb-0.5">
                    AI token/quota limit reached
                  </strong>
                )}
                {processingError}
              </span>
            </p>
          )}
          {warnings.map((w, i) => (
            <p
              key={i}
              className="text-xs text-amber-700 flex items-start gap-2"
            >
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {w}
            </p>
          ))}
        </div>
      )}

      {/* ---------- STEP 1: UPLOAD ---------- */}
      {phase === "upload" && (
        <div className="card p-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              dragDepth.current += 1;
            }}
            onDragLeave={() => {
              dragDepth.current = Math.max(0, dragDepth.current - 1);
            }}
            onDrop={(e) => {
              e.preventDefault();
              dragDepth.current = 0;
              onFileSelect(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer rounded-2xl border-2 border-dashed border-line hover:border-accent transition-colors flex flex-col items-center justify-center gap-3 py-14 px-6 text-center"
          >
            {previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-64 rounded-xl object-contain"
                />
                <p className="text-sm text-muted">
                  {file.name} · {Math.round(file.size / 1024)} KB — click to
                  replace
                </p>
              </>
            ) : selectedImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedImage.url}
                  alt="Selected"
                  className="max-h-64 rounded-xl object-contain"
                />
                <p className="text-sm text-muted">
                  Using a previously uploaded image — click to choose a new one
                </p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-primary/5 text-primary flex items-center justify-center">
                  <UploadCloud size={26} />
                </div>
                <p className="text-sm text-ink font-medium">
                  Drag &amp; drop a product photo here
                </p>
                <p className="text-xs text-muted">
                  or click to browse · JPEG, PNG, WebP · max 10 MB
                </p>
              </>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => onFileSelect(e.target.files?.[0])}
          />

          {/* Previously uploaded images — pick one to reuse */}
          <div className="mt-6">
            <p className="text-xs font-medium text-ink mb-2">
              Previously uploaded images
            </p>
            {loadingImages ? (
              <p className="text-xs text-muted flex items-center gap-2">
                <Loader2 size={13} className="animate-spin" /> Loading…
              </p>
            ) : existingImages.length === 0 ? (
              <p className="text-xs text-muted">
                No uploaded images yet — upload one above.
              </p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {existingImages.map((img) => (
                  <button
                    key={img.name}
                    type="button"
                    onClick={() => onPickExisting(img)}
                    title={img.name}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-colors ${
                      selectedImage?.path === img.path
                        ? "border-accent ring-2 ring-accent/30"
                        : "border-line hover:border-accent/60"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">Listing language:</span>
              <LanguageToggle language={language} onChange={setLanguage} />
            </div>
            <button
              onClick={startProcessing}
              disabled={(!file && !selectedImage) || uploading || starting}
              className="btn btn-primary disabled:opacity-60"
            >
              {starting || uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Starting…
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Create &amp; Process with AI
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ---------- STEP 2: PROCESSING ---------- */}
      {phase === "processing" && (
        <div className="card p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Loader2 size={20} className="animate-spin" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">
                {PROGRESS_LABELS[status] || "Processing…"}
              </p>
              <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                <Clock size={12} /> About {estimate}s remaining
              </p>
            </div>
          </div>

          <div className="h-2.5 rounded-full bg-primary/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted">
            <div className="flex items-center gap-2">
              {progress >= 25 ? (
                <CheckCircle2 size={14} className="text-emerald-600" />
              ) : (
                <Loader2 size={14} className="animate-spin" />
              )}
              Image uploaded &amp; watermarking
            </div>
            <div className="flex items-center gap-2">
              {progress >= 50 ? (
                <CheckCircle2 size={14} className="text-emerald-600" />
              ) : (
                <Loader2 size={14} className="animate-spin" />
              )}
              AI content generation
            </div>
            <div className="flex items-center gap-2">
              {progress >= 82 ? (
                <CheckCircle2 size={14} className="text-emerald-600" />
              ) : (
                <Loader2 size={14} className="animate-spin" />
              )}
              SEO analysis &amp; saving
            </div>
          </div>
        </div>
      )}

      {/* ---------- STEP 3: NAME THE PRODUCT (not recognized) ---------- */}
      {phase === "naming" && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
              <ImageIcon size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">
                We couldn&apos;t identify this product
              </p>
              <p className="text-xs text-muted">
                Tell us what it is and we&apos;ll write the listing and pick SEO
                keywords based on that name.
              </p>
            </div>
          </div>

          {processedImage && (
            <div className="mb-5 rounded-xl overflow-hidden border border-line bg-primary/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={processedImage}
                alt="Processed product"
                className="max-h-64 w-full object-contain"
              />
            </div>
          )}

          <div>
            <label className="label">Product name</label>
            <input
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value, slug: "" })
              }
              placeholder="e.g. Handwoven cane basket, Handmade clay pot"
              className="input"
              autoFocus
            />
            <p className="text-[11px] text-muted mt-1">
              Supports English and বাংলা names — the listing will use it as the
              title.
            </p>
          </div>

          <div className="mt-4">
            <label className="label">Listing language</label>
            <LanguageToggle language={language} onChange={setLanguage} />
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              onClick={() => {
                setProductId(null);
                setStatus(null);
                setPhase("upload");
              }}
              disabled={starting}
              className="btn btn-ghost disabled:opacity-60"
            >
              Use a different image
            </button>
            <button
              onClick={regenerate}
              disabled={starting || !form.name.trim()}
              className="btn btn-accent disabled:opacity-60"
            >
              {starting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Generate listing
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ---------- STEP 4: REVIEW ---------- */}
      {phase === "review" && (
        <div className="space-y-5">
          <div className="card p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="text-lg font-display text-ink">Review content</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">SEO score</span>
                <span
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold ${
                    seo.seoScore >= 70
                      ? "bg-emerald-100 text-emerald-700"
                      : seo.seoScore >= 45
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-600"
                  }`}
                >
                  {seo.seoScore}
                </span>
              </div>
            </div>

            <ProductFormFields
              product={form}
              onChange={setForm}
              categories={categories}
              variants={variants}
              onVariantsChange={(next) => {
                setVariants(next);
                if (hasActiveVariants(next)) {
                  setForm((prev) => ({
                    ...prev,
                    stock: String(variantStockTotal(next)),
                  }));
                }
              }}
            />
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-ink">SEO analysis</h3>
              <div className="flex items-center gap-1.5">
                <ImageIcon size={14} className="text-muted" />
                <span className="text-xs text-muted">
                  {seo.stats.wordCount} words · {seo.stats.sentenceCount}{" "}
                  sentences
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl bg-primary/5 px-3 py-2.5">
                <p className="text-[11px] text-muted">Keyword density</p>
                <p className="text-sm font-semibold text-ink">
                  {seo.keywordDensity}%{" "}
                  <span className="text-[11px] font-normal text-muted">
                    (ideal 2–3%)
                  </span>
                </p>
              </div>
              <div className="rounded-xl bg-primary/5 px-3 py-2.5">
                <p className="text-[11px] text-muted">Readability</p>
                <p className="text-sm font-semibold text-ink">
                  {seo.readabilityScore}/100
                </p>
              </div>
              <div className="rounded-xl bg-primary/5 px-3 py-2.5">
                <p className="text-[11px] text-muted">Avg words / sentence</p>
                <p className="text-sm font-semibold text-ink">
                  {seo.stats.avgWordsPerSentence}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-ink mb-2">
                Suggested keywords
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {keywords.map((kw, i) => (
                  <span
                    key={`${kw}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 text-accent text-xs font-medium px-3 py-1.5"
                  >
                    {kw}
                    <button
                      onClick={() =>
                        setKeywords(keywords.filter((_, j) => j !== i))
                      }
                      aria-label={`Remove ${kw}`}
                      className="hover:text-red-600"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  placeholder="Add a keyword"
                  className="input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = e.target.value.trim();
                      if (v && !keywords.includes(v)) {
                        setKeywords([...keywords, v]);
                        e.target.value = "";
                      }
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = e.target.previousElementSibling;
                    const v = input?.value?.trim?.();
                    if (v && !keywords.includes(v))
                      setKeywords([...keywords, v]);
                    if (input) input.value = "";
                  }}
                  className="btn btn-outline shrink-0"
                >
                  <Plus size={15} /> Add
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              onClick={() => save(false)}
              disabled={saving}
              className="btn btn-ghost disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save Draft
            </button>
            {/* <Link
              href={`/product/${form.slug}`}
              target="_blank"
              className="btn btn-outline"
            >
              <Eye size={16} /> Preview
            </Link> */}
            <button
              onClick={() => save(true)}
              disabled={saving || !form.name.trim()}
              className="btn btn-accent disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} />
              )}
              Publish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Language toggle (English / বাংলা) ----------
function LanguageToggle({ language, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-line overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("en")}
        className={`px-4 py-2 text-sm font-medium transition-colors ${
          language === "en"
            ? "bg-accent text-white"
            : "bg-surface text-muted hover:text-ink"
        }`}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => onChange("bn")}
        className={`px-4 py-2 text-sm font-medium transition-colors ${
          language === "bn"
            ? "bg-accent text-white"
            : "bg-surface text-muted hover:text-ink"
        }`}
      >
        বাংলা
      </button>
    </div>
  );
}
