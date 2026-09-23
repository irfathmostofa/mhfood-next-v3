"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  Loader2,
  Search,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import ImageUploader from "./ImageUploader";
import Modal from "./Modal";
import Pagination from "./Pagination";
import { slugify } from "@/lib/slugify";
import { useToast } from "@/components/Toast";

const PAGE_SIZES = [10, 25, 50];

export default function AdminBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  const { success, error: toastError } = useToast();
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const { data } = await supabase
      .from("brands")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    setBrands(data || []);
    setLoading(false);
  }

  function openNew() {
    setError("");
    const nextOrder =
      brands.reduce((max, b) => Math.max(max, Number(b.sort_order) || 0), 0) +
      1;
    setEditing({
      id: null,
      name: "",
      slug: "",
      image_url: "",
      description: "",
      sort_order: nextOrder,
      is_active: true,
    });
  }

  function openEdit(brand) {
    setError("");
    setEditing({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      image_url: brand.image_url || "",
      description: brand.description || "",
      sort_order: brand.sort_order ?? 0,
      is_active: brand.is_active !== false,
    });
  }

  async function saveBrand(e) {
    e.preventDefault();
    if (!editing?.name) return;
    setSaving(true);
    setError("");

    const payload = {
      name: editing.name.trim(),
      slug: editing.slug || slugify(editing.name),
      image_url: editing.image_url || null,
      description: (editing.description || "").trim() || null,
      sort_order: Number(editing.sort_order) || 0,
      is_active: editing.is_active !== false,
    };

    const { error: saveError } = editing.id
      ? await supabase.from("brands").update(payload).eq("id", editing.id)
      : await supabase.from("brands").insert(payload);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setEditing(null);
    success(editing.id ? "Brand updated." : "Brand added.");
    await loadAll();
    setSaving(false);
  }

  async function deleteBrand(id) {
    if (
      !confirm(
        "Delete this brand? Products using it will keep their other data and lose the brand.",
      )
    )
      return;
    const { error: deleteError } = await supabase
      .from("brands")
      .delete()
      .eq("id", id);
    if (deleteError) {
      toastError(deleteError.message);
      return;
    }
    success("Brand deleted.");
    await loadAll();
  }

  async function toggleActive(brand) {
    const { error: updateError } = await supabase
      .from("brands")
      .update({ is_active: !brand.is_active })
      .eq("id", brand.id);
    if (updateError) {
      toastError(updateError.message);
      return;
    }
    setBrands((prev) =>
      prev.map((b) =>
        b.id === brand.id ? { ...b, is_active: !brand.is_active } : b,
      ),
    );
  }

  const filtered = useMemo(
    () =>
      brands.filter(
        (b) =>
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          (b.slug || "").toLowerCase().includes(search.toLowerCase()),
      ),
    [brands, search],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display text-ink">Brands</h1>
          <p className="text-sm text-muted mt-1">
            Optional brands you can assign to products.
          </p>
        </div>
        <button onClick={openNew} className="btn btn-primary">
          <Plus size={16} /> Add Brand
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <div className="relative mb-4 max-w-sm">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search brands..."
          className="input pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted py-10 text-center">Loading...</p>
      ) : (
        <div className="card overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted py-12 text-center">
              {search
                ? "No brands match your search."
                : "No brands yet — click “Add Brand” to create one."}
            </p>
          ) : (
            <div className="divide-y divide-line">
              {paged.map((brand) => (
                <div
                  key={brand.id}
                  className="flex items-center gap-4 px-5 py-3.5"
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/5 overflow-hidden shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        brand.image_url ||
                        "https://placehold.co/100x100?text=Brand"
                      }
                      alt={brand.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">
                      {brand.name}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {brand.slug}
                      {` · Order ${brand.sort_order ?? 0}`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleActive(brand)}
                    className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors shrink-0 ${
                      brand.is_active !== false
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-muted border-line"
                    }`}
                  >
                    {brand.is_active !== false ? (
                      <>
                        <Eye size={11} /> Active
                      </>
                    ) : (
                      <>
                        <EyeOff size={11} /> Hidden
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(brand)}
                      aria-label="Edit brand"
                      className="p-2 text-muted hover:text-ink"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => deleteBrand(brand.id)}
                      aria-label="Delete brand"
                      className="p-2 text-muted hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={filtered.length}
            onChange={(p, ps) => {
              setPage(p);
              setPageSize(ps);
            }}
            pageSizeOptions={PAGE_SIZES}
          />
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? "Edit Brand" : "New Brand"}
        subtitle={
          editing?.id
            ? editing.name
            : "Create a brand you can optionally assign to products."
        }
        size="md"
      >
        {editing && (
          <form onSubmit={saveBrand} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Name</label>
                <input
                  value={editing.name || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Slug (URL)</label>
                <input
                  value={editing.slug || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, slug: e.target.value })
                  }
                  placeholder="auto-generated from name"
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                value={editing.description || ""}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
                rows={2}
                className="input resize-none"
                placeholder="Optional short note"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Sort order</label>
                <input
                  type="number"
                  value={editing.sort_order ?? 0}
                  onChange={(e) =>
                    setEditing({ ...editing, sort_order: e.target.value })
                  }
                  className="input"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink pt-6 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editing.is_active !== false}
                  onChange={(e) =>
                    setEditing({ ...editing, is_active: e.target.checked })
                  }
                  className="w-4 h-4 rounded accent-[#C77B4C]"
                />
                Active
              </label>
            </div>

            <ImageUploader
              value={editing.image_url || ""}
              onChange={(v) => setEditing({ ...editing, image_url: v })}
              folder="brands"
              label="Brand logo"
              aspect="square"
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={saving}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />{" "}
                    {editing.id ? "Save Changes" : "Add Brand"}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
