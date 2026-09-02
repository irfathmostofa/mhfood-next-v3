"use client";

import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

export default function VariantsEditor({ variants = [], onChange }) {
  const [open, setOpen] = useState(variants.some((v) => !v._removed));

  function update(idx, field, value) {
    onChange(
      variants.map((v, i) =>
        i === idx ? { ...v, [field]: value, _dirty: true } : v,
      ),
    );
  }

  function addRow() {
    setOpen(true);
    onChange([
      ...variants,
      {
        id: null,
        name: "",
        value: "",
        price_adjustment: 0,
        stock: 0,
        sku: "",
        _dirty: true,
        _removed: false,
      },
    ]);
  }

  function removeRow(idx) {
    onChange(
      variants.map((v, i) =>
        i === idx ? { ...v, _removed: true, _dirty: true } : v,
      ),
    );
  }

  const visible = variants.filter((v) => !v._removed);

  return (
    <div className="border border-line rounded-xl p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-sm font-semibold text-ink"
      >
        <span>Options / Variants</span>
        <span className="flex items-center gap-2">
          {visible.length > 0 && (
            <span className="text-xs text-muted font-normal">
              {visible.length} set
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
            Groups are options like Size or Color. Each row is one option. Fill
            Group and Value to create a variant.
          </p>

          {visible.length === 0 && (
            <p className="text-xs text-muted mb-3">
              No variants — this product is sold as-is.
            </p>
          )}

          <div className="space-y-3">
            {variants.map((v, i) =>
              v._removed ? null : (
                <div
                  key={v.id || `new-${i}`}
                  className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end"
                >
                  <div>
                    <label className="label">Group</label>
                    <input
                      value={v.name}
                      onChange={(e) => update(i, "name", e.target.value)}
                      placeholder="Size, Color"
                      className="input input-sm"
                    />
                  </div>
                  <div>
                    <label className="label">Value</label>
                    <input
                      value={v.value}
                      onChange={(e) => update(i, "value", e.target.value)}
                      placeholder="Large, Red"
                      className="input input-sm"
                    />
                  </div>
                  <div>
                    <label className="label">Price adj. (৳)</label>
                    <input
                      type="number"
                      value={v.price_adjustment}
                      onChange={(e) =>
                        update(i, "price_adjustment", e.target.value)
                      }
                      placeholder="0"
                      className="input input-sm"
                    />
                  </div>
                  <div>
                    <label className="label">Stock</label>
                    <input
                      type="number"
                      value={v.stock}
                      onChange={(e) => update(i, "stock", e.target.value)}
                      placeholder="0"
                      className="input input-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    aria-label="Remove variant"
                    className="justify-self-start sm:justify-self-end p-1.5 text-muted hover:text-red-600 mb-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="mt-3 btn btn-outline btn-sm"
          >
            <Plus size={14} /> Add Option
          </button>
        </div>
      )}
    </div>
  );
}

export async function saveProductVariants(supabase, productId, variants = []) {
  const variantRows = variants || [];
  if (!variantRows.some((v) => v._dirty)) return;

  const existing = variantRows.filter((v) => v.id && !v._removed);
  const removedIds = variantRows
    .filter((v) => v._removed && v.id)
    .map((v) => v.id);
  const newRows = variantRows
    .filter((v) => !v.id && !v._removed && (v.name || v.value))
    .map(({ name, value, price_adjustment, stock, sku }) => ({
      product_id: productId,
      name,
      value,
      price_adjustment: Number(price_adjustment) || 0,
      stock: Number(stock) || 0,
      sku: sku || null,
    }));

  if (removedIds.length > 0) {
    await supabase.from("product_variants").delete().in("id", removedIds);
  }
  if (existing.length > 0) {
    await Promise.all(
      existing.map((v) =>
        supabase
          .from("product_variants")
          .update({
            name: v.name,
            value: v.value,
            price_adjustment: Number(v.price_adjustment) || 0,
            stock: Number(v.stock) || 0,
            sku: v.sku || null,
          })
          .eq("id", v.id),
      ),
    );
  }
  if (newRows.length > 0) {
    await supabase.from("product_variants").insert(newRows);
  }
}
