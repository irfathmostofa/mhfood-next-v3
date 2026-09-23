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
  HelpCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Modal from "./Modal";
import Pagination from "./Pagination";
import RichTextEditor from "./RichTextEditor";
import { useToast } from "@/components/Toast";
import { stripHtml } from "@/lib/richtext";

const PAGE_SIZES = [10, 25, 50];

const EMPTY_FAQ = {
  id: null,
  question: "",
  answer: "",
  sort_order: 1,
  is_active: true,
};

export default function AdminFaqs() {
  const [faqs, setFaqs] = useState([]);
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
      .from("faqs")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setFaqs(data || []);
    setLoading(false);
  }

  function openNew() {
    setError("");
    const nextOrder =
      faqs.reduce((max, f) => Math.max(max, Number(f.sort_order) || 0), 0) + 1;
    setEditing({ ...EMPTY_FAQ, sort_order: nextOrder });
  }

  function openEdit(faq) {
    setError("");
    setEditing({
      id: faq.id,
      question: faq.question || "",
      answer: faq.answer || "",
      sort_order: faq.sort_order ?? 0,
      is_active: faq.is_active !== false,
    });
  }

  async function saveFaq(e) {
    e.preventDefault();
    if (!editing?.question?.trim()) return;
    setSaving(true);
    setError("");

    const payload = {
      question: editing.question.trim(),
      answer: editing.answer || "",
      sort_order: Number(editing.sort_order) || 0,
      is_active: editing.is_active !== false,
    };

    const { error: saveError } = editing.id
      ? await supabase.from("faqs").update(payload).eq("id", editing.id)
      : await supabase.from("faqs").insert(payload);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setEditing(null);
    success(editing.id ? "FAQ updated." : "FAQ added.");
    await loadAll();
    setSaving(false);
  }

  async function deleteFaq(id) {
    if (!confirm("Delete this FAQ? This cannot be undone.")) return;
    const { error: deleteError } = await supabase
      .from("faqs")
      .delete()
      .eq("id", id);
    if (deleteError) {
      toastError(deleteError.message);
      return;
    }
    success("FAQ deleted.");
    await loadAll();
  }

  async function toggleActive(faq) {
    const { error: updateError } = await supabase
      .from("faqs")
      .update({ is_active: !faq.is_active })
      .eq("id", faq.id);
    if (updateError) {
      toastError(updateError.message);
      return;
    }
    setFaqs((prev) =>
      prev.map((f) =>
        f.id === faq.id ? { ...f, is_active: !faq.is_active } : f,
      ),
    );
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return faqs.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        stripHtml(f.answer || "").toLowerCase().includes(q),
    );
  }, [faqs, search]);

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
          <h1 className="text-2xl font-display text-ink">FAQs</h1>
          <p className="text-sm text-muted mt-1">
            {faqs.length} question{faqs.length === 1 ? "" : "s"} shown on the
            public FAQ page.
          </p>
        </div>
        <button onClick={openNew} className="btn btn-primary">
          <Plus size={16} /> Add FAQ
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
          placeholder="Search questions..."
          className="input pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted py-10 text-center">Loading...</p>
      ) : (
        <div className="card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-12 text-center px-6">
              <HelpCircle size={28} className="mx-auto text-muted mb-3" />
              <p className="text-sm text-muted">
                {search
                  ? "No FAQs match your search."
                  : "No FAQs yet — click “Add FAQ” to create one."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {paged.map((faq) => (
                <div
                  key={faq.id}
                  className="flex items-start gap-4 px-5 py-3.5"
                >
                  <span className="mt-0.5 shrink-0 w-8 h-8 rounded-lg bg-primary/8 text-primary text-xs font-semibold flex items-center justify-center">
                    {faq.sort_order ?? 0}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      {faq.question}
                    </p>
                    <p className="text-xs text-muted mt-0.5 line-clamp-2">
                      {stripHtml(faq.answer) || "No answer yet"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleActive(faq)}
                    className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors shrink-0 ${
                      faq.is_active !== false
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-muted border-line"
                    }`}
                  >
                    {faq.is_active !== false ? (
                      <>
                        <Eye size={11} /> Visible
                      </>
                    ) : (
                      <>
                        <EyeOff size={11} /> Hidden
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(faq)}
                      aria-label="Edit FAQ"
                      className="p-2 text-muted hover:text-ink"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => deleteFaq(faq.id)}
                      aria-label="Delete FAQ"
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
        title={editing?.id ? "Edit FAQ" : "New FAQ"}
        subtitle={
          editing?.id
            ? "Update the question and answer shown on the storefront."
            : "Write a question and a rich-text answer for customers."
        }
        size="lg"
      >
        {editing && (
          <form onSubmit={saveFaq} className="space-y-4">
            <div>
              <label className="label">Question</label>
              <input
                value={editing.question || ""}
                onChange={(e) =>
                  setEditing({ ...editing, question: e.target.value })
                }
                placeholder="e.g. How long does delivery take?"
                className="input"
                required
              />
            </div>

            <div>
              <label className="label">Answer</label>
              <RichTextEditor
                value={editing.answer || ""}
                onChange={(html) => setEditing({ ...editing, answer: html })}
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
                Visible on the FAQ page
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
                    <Save size={16} /> {editing.id ? "Save Changes" : "Add FAQ"}
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
