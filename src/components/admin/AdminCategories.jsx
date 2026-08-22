"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import ImageUploader from "./ImageUploader";
import Modal from "./Modal";
import Pagination from "./Pagination";

const PAGE_SIZES = [10, 25, 50];

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    setCategories(data || []);
    setLoading(false);
  }

  function showFlash(msg) {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  }

  function openNew() {
    setError("");
    setEditing({
      id: null,
      name: "",
      slug: "",
      image_url: "",
      parent_id: null,
    });
  }

  function openEdit(cat) {
    setError("");
    setEditing({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      image_url: cat.image_url || "",
      parent_id: cat.parent_id || null,
    });
  }

  async function saveCategory(e) {
    e.preventDefault();
    if (!editing?.name) return;
    setSaving(true);
    setError("");

    const payload = {
      name: editing.name,
      slug: editing.slug || slugify(editing.name),
      image_url: editing.image_url || null,
      parent_id: editing.parent_id || null,
    };

    const { error: saveError } = editing.id
      ? await supabase
          .from("categories")
          .update(payload)
          .eq("id", editing.id)
      : await supabase.from("categories").insert(payload);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setEditing(null);
    showFlash(editing.id ? "Category updated." : "Category added.");
    await loadAll();
    setSaving(false);
  }

  async function deleteCategory(id) {
    if (!confirm("Delete this category? Products in it will keep their data."))
      return;
    const { error: deleteError } = await supabase
      .from("categories")
      .delete()
      .eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    showFlash("Category deleted.");
    await loadAll();
  }

  const filtered = useMemo(
    () =>
      categories.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.slug.toLowerCase().includes(search.toLowerCase()),
      ),
    [categories, search],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display text-ink">Categories</h1>
          <p className="text-sm text-muted mt-1">
            {categories.length} categor{ categories.length === 1 ? "y" : "ies"}{" "}
            for organizing products.
          </p>
        </div>
        <button onClick={openNew} className="btn btn-primary">
          <Plus size={16} /> Add Category
        </button>
      </div>

      {flash && (
        <p className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
          {flash}
        </p>
      )}
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
          placeholder="Search categories..."
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
                ? "No categories match your search."
                : "No categories yet — click “Add Category” to create one."}
            </p>
          ) : (
            <div className="divide-y divide-line">
              {paged.map((cat) => {
                const parent = categories.find((c) => c.id === cat.parent_id);
                const childCount = categories.filter(
                  (c) => c.parent_id === cat.id,
                ).length;
                return (
                  <div
                    key={cat.id}
                    className="flex items-center gap-4 px-5 py-3.5"
                  >
                    <div className="w-12 h-12 rounded-lg bg-primary/5 overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          cat.image_url ||
                          "https://placehold.co/100x100?text=No+Image"
                        }
                        alt={cat.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">
                        {cat.name}
                      </p>
                      <p className="text-xs text-muted truncate">
                        {parent
                          ? `Sub-category of ${parent.name}`
                          : "Top level"}
                        {childCount > 0 && ` · ${childCount} sub-categor${childCount === 1 ? "y" : "ies"}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(cat)}
                        aria-label="Edit category"
                        className="p-2 text-muted hover:text-ink"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => deleteCategory(cat.id)}
                        aria-label="Delete category"
                        className="p-2 text-muted hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
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
        title={editing?.id ? "Edit Category" : "New Category"}
        subtitle={editing?.id ? editing.name : "Create a new product category."}
        size="md"
      >
        {editing && (
          <form onSubmit={saveCategory} className="space-y-4">
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
              <label className="label">Parent Category</label>
              <select
                value={editing.parent_id || ""}
                onChange={(e) =>
                  setEditing({ ...editing, parent_id: e.target.value || null })
                }
                className="input"
              >
                <option value="">— No parent (top level) —</option>
                {categories
                  .filter((c) => !editing.id || c.id !== editing.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <ImageUploader
                value={editing.image_url || ""}
                onChange={(v) => setEditing({ ...editing, image_url: v })}
                folder="categories"
                label="Image (optional)"
                aspect="square"
              />
            </div>

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
                    {editing.id ? "Save Category" : "Add Category"}
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
