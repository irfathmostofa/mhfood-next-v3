"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  ChevronDown,
} from "lucide-react";
import ImageUploader from "./ImageUploader";
import RichTextEditor from "./RichTextEditor";
import VariantsEditor, {
  hasActiveVariants,
  variantStockTotal,
} from "./VariantsEditor";

export function calcMargin(cost, price) {
  const c = Number(cost) || 0;
  const p = Number(price) || 0;
  if (c <= 0 || p <= 0) return 0;
  return ((p - c) / p) * 100;
}

export default function ProductFormFields({
  product,
  onChange,
  categories = [],
  variants = [],
  onVariantsChange,
  images,
  onImagesChange,
  showImages = false,
  showFeatured = true,
}) {
  function patch(fields) {
    onChange({ ...product, ...fields });
  }

  const cost = Number(product.cost) || 0;
  const price = Number(product.price) || 0;
  const profit = price - cost;
  const margin = price > 0 ? calcMargin(cost, price) : 0;
  const withVariants = hasActiveVariants(variants);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Name</label>
          <input
            value={product.name || ""}
            onChange={(e) => patch({ name: e.target.value })}
            className="input"
            required
          />
          <p className="text-[11px] text-muted mt-1">
            {(product.name || "").length}/60 characters
          </p>
        </div>
        <div>
          <label className="label">Slug (URL)</label>
          <input
            value={product.slug || ""}
            onChange={(e) => patch({ slug: e.target.value })}
            placeholder="auto-generated from name"
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label">Short description</label>
        <textarea
          value={product.short_description || ""}
          onChange={(e) => patch({ short_description: e.target.value })}
          rows={2}
          placeholder="Brief summary shown on the product page"
          className="input resize-none"
        />
        <p className="text-[11px] text-muted mt-1">
          {(product.short_description || "").length}/160 characters
        </p>
      </div>

      <div>
        <label className="label">Description</label>
        <RichTextEditor
          value={product.description || ""}
          onChange={(html) => patch({ description: html })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1">
          <label className="label">Category</label>
          <select
            value={product.category_id || ""}
            onChange={(e) => patch({ category_id: e.target.value })}
            className="input"
          >
            <option value="">— No category —</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Stock</label>
          <input
            type="number"
            min="0"
            value={
              withVariants ? variantStockTotal(variants) : product.stock ?? 0
            }
            onChange={(e) => patch({ stock: e.target.value })}
            className="input"
            required
            readOnly={withVariants}
            disabled={withVariants}
          />
          {withVariants && (
            <p className="text-[11px] text-muted mt-1">
              Total of variant stock. Edit stock on each variant.
            </p>
          )}
        </div>
        <div>
          <label className="label">Unit</label>
          <input
            value={product.unit || ""}
            onChange={(e) => patch({ unit: e.target.value })}
            placeholder="per kg"
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Cost (৳)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={product.cost}
            onChange={(e) => patch({ cost: e.target.value })}
            placeholder="0.00"
            className="input"
          />
          <p className="text-[11px] text-muted mt-1">
            What you pay per unit (for profit tracking).
          </p>
        </div>
        <div>
          <label className="label">Regular Price (৳)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={product.regular_price}
            onChange={(e) => patch({ regular_price: e.target.value })}
            placeholder="0.00"
            className="input"
          />
          <p className="text-[11px] text-muted mt-1">
            List price, shown struck-through.
          </p>
        </div>
        <div>
          <label className="label">Selling Price (৳)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={product.price}
            onChange={(e) => patch({ price: e.target.value })}
            className="input"
            required
          />
          <p className="text-[11px] text-muted mt-1">What customers pay.</p>
        </div>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm ${
          cost > 0
            ? profit >= 0
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-600"
            : "border-line bg-surface text-muted"
        }`}
      >
        <span className="font-medium">Profit / Margin</span>
        <span className="font-semibold">
          {cost > 0 ? (
            <>
              ৳{profit.toFixed(2)} ({margin.toFixed(1)}% margin)
            </>
          ) : (
            "Enter a cost to see profit"
          )}
        </span>
      </div>

      {showFeatured && (
        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={!!product.is_featured}
              onChange={(e) => patch({ is_featured: e.target.checked })}
            />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={product.is_active !== false}
              onChange={(e) => patch({ is_active: e.target.checked })}
            />
            Active
          </label>
        </div>
      )}

      {onVariantsChange && (
        <VariantsEditor variants={variants || []} onChange={onVariantsChange} />
      )}

      {showImages && onImagesChange && (
        <ImagesEditor images={images || []} onChange={onImagesChange} />
      )}
    </div>
  );
}

export function ImagesEditor({ images, onChange }) {
  const [open, setOpen] = useState(false);

  function addImage() {
    onChange([
      ...images,
      {
        id: null,
        image_url: "",
        sort_order: images.length + 1,
        _removed: false,
      },
    ]);
  }

  function updateImage(idx, value) {
    onChange(
      images.map((im, i) => {
        if (i !== idx) return im;
        if (value === "" && im.id) return { ...im, _removed: true };
        return { ...im, image_url: value };
      }),
    );
  }

  function removeImage(idx) {
    onChange(
      images.map((im, i) => (i === idx ? { ...im, _removed: true } : im)),
    );
  }

  const visible = images.filter((im) => !im._removed);

  return (
    <div className="border border-line rounded-xl p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-sm font-semibold text-ink"
      >
        <span className="flex items-center gap-2">
          <ImageIcon size={15} /> Product Images
        </span>
        <span className="flex items-center gap-2">
          {visible.length > 0 && (
            <span className="text-xs text-muted font-normal">
              {visible.length}
            </span>
          )}
          <ChevronDown
            size={15}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="mt-4">
          <p className="text-xs text-muted mb-3">
            Images are optimized automatically before upload. The first image is
            used as the main product photo.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {visible.map((img, i) => (
              <div key={i} className="relative">
                <ImageUploader
                  value={img.image_url}
                  onChange={(v) => updateImage(i, v)}
                  folder="products"
                  label={`Image ${i + 1}`}
                  aspect="square"
                />
                {img.id && (
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    aria-label="Delete image"
                    className="absolute top-1.5 left-1.5 p-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors z-10"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addImage}
            className="mt-3 btn btn-outline btn-sm"
          >
            <Plus size={14} /> Add Image
          </button>
        </div>
      )}
    </div>
  );
}
