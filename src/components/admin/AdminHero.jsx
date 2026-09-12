"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import ImageUploader from "./ImageUploader";
import Modal from "./Modal";
import Pagination from "./Pagination";
import { useToast } from "@/components/Toast";

const PAGE_SIZES = [5, 10, 20];

const EMPTY_SLIDE = {
  id: null,
  image_url: "",
  title: "",
  link_url: "",
  sort_order: 1,
  is_active: true,
};

export default function AdminHero({ embedded = false }) {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
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
      .from("hero_slides")
      .select("*")
      .order("sort_order", { ascending: true });
    setSlides(data || []);
    setLoading(false);
  }

  function openNew() {
    setError("");
    setEditing({
      ...EMPTY_SLIDE,
      sort_order: slides.length + 1,
    });
  }

  function openEdit(slide) {
    setError("");
    setEditing({
      id: slide.id,
      image_url: slide.image_url || "",
      title: slide.title || "",
      link_url: slide.link_url || "",
      sort_order: slide.sort_order ?? slides.length + 1,
      is_active: slide.is_active !== false,
    });
  }

  async function saveSlide(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      image_url: editing.image_url || null,
      title: editing.title || "",
      subtitle: "",
      link_url: editing.link_url || "",
      button_label: "",
      button_2_label: "",
      button_2_url: "",
      sort_order: Number(editing.sort_order) || 0,
      is_active: editing.is_active,
    };

    const { error: saveError } = editing.id
      ? await supabase.from("hero_slides").update(payload).eq("id", editing.id)
      : await supabase.from("hero_slides").insert(payload);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setEditing(null);
    success(editing.id ? "Slide saved." : "Slide added.");
    await loadAll();
    setSaving(false);
  }

  async function toggleActive(slide) {
    await supabase
      .from("hero_slides")
      .update({ is_active: !slide.is_active })
      .eq("id", slide.id);
    await loadAll();
  }

  async function deleteSlide(id) {
    if (!confirm("Delete this hero slide?")) return;
    const { error: deleteError } = await supabase
      .from("hero_slides")
      .delete()
      .eq("id", id);
    if (deleteError) {
      toastError(deleteError.message);
      return;
    }
    success("Slide deleted.");
    await loadAll();
  }

  const pageCount = Math.max(1, Math.ceil(slides.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = slides.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div>
      <div
        className={`flex flex-wrap items-center justify-between gap-3 ${
          embedded ? "mb-3" : "mb-6"
        }`}
      >
        <div>
          {!embedded && (
            <h1 className="text-2xl font-display text-ink">Hero Slides</h1>
          )}
          <p
            className={
              embedded ? "text-xs text-muted" : "text-sm text-muted mt-1"
            }
          >
            {embedded
              ? "Carousel on the left of the homepage hero. Recommended 1920x300px."
              : "Slides shown in the storefront hero carousel, ordered by sort order."}
          </p>
        </div>
        <button
          onClick={openNew}
          className={embedded ? "btn btn-primary btn-sm" : "btn btn-primary"}
        >
          <Plus size={embedded ? 12 : 16} /> Add Slide
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted py-10 text-center">Loading...</p>
      ) : (
        <div className="card overflow-hidden">
          {slides.length === 0 ? (
            <p className="text-sm text-muted py-12 text-center">
              No slides yet — click “Add Slide” to create one.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {paged.map((slide) => (
                <div
                  key={slide.id}
                  className="flex items-center gap-4 px-5 py-3.5"
                >
                  <div className="w-28 h-16 rounded-lg bg-primary/5 overflow-hidden shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        slide.image_url ||
                        "https://placehold.co/200x100?text=No+Image"
                      }
                      alt={slide.title || "Hero slide"}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">
                      {slide.link_url || "(no link)"}
                    </p>
                    <p className="text-xs text-muted truncate">
                      Order {slide.sort_order}
                      {slide.title ? ` · ${slide.title}` : ""}
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleActive(slide)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        slide.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-muted border-line"
                      }`}
                    >
                      {slide.is_active ? (
                        <>
                          <Eye size={11} className="inline mr-1" /> Active
                        </>
                      ) : (
                        <>
                          <EyeOff size={11} className="inline mr-1" /> Hidden
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(slide)}
                      aria-label="Edit slide"
                      className="p-2 text-muted hover:text-ink"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => deleteSlide(slide.id)}
                      aria-label="Delete slide"
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
            total={slides.length}
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
        title={editing?.id ? "Edit Slide" : "New Slide"}
        subtitle="Hero carousel slide shown on the storefront home page."
        size="md"
      >
        {editing && (
          <form onSubmit={saveSlide} className="space-y-4">
            <div>
              <ImageUploader
                value={editing.image_url || ""}
                onChange={(v) => setEditing({ ...editing, image_url: v })}
                folder="hero-slides"
                label="Image"
                aspect="wide"
                hint="Recommended 1920x300px — optimized automatically on upload."
              />
            </div>

            <div>
              <label className="label">Link URL</label>
              <input
                value={editing.link_url || ""}
                onChange={(e) =>
                  setEditing({ ...editing, link_url: e.target.value })
                }
                placeholder="/shop"
                className="input"
              />
              <p className="mt-1.5 text-[11px] text-muted">
                Optional. If set, the entire slide image is clickable.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Sort Order</label>
                <input
                  type="number"
                  min="0"
                  value={editing.sort_order ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, sort_order: e.target.value })
                  }
                  className="input"
                />
              </div>
              <label className="flex items-end pb-2 gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) =>
                    setEditing({ ...editing, is_active: e.target.checked })
                  }
                />
                Active
              </label>
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
                    <Save size={16} /> {editing.id ? "Save Slide" : "Add Slide"}
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
