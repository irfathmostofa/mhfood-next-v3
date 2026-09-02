"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  Loader2,
  Printer,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { printExpenseReport } from "@/lib/expenseReport";
import Modal from "./Modal";
import Pagination from "./Pagination";

const PAGE_SIZES = [10, 25, 50];

function toLocalDateInput(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

const EMPTY_FORM = {
  id: null,
  expense_type_id: "",
  title: "",
  amount: "",
  expense_date: "",
  notes: "",
};

export default function AdminExpenses() {
  const [types, setTypes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toLocalDateInput(d);
  });
  const [to, setTo] = useState(() => toLocalDateInput(new Date()));
  const [typeFilter, setTypeFilter] = useState("all");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, typeFilter]);

  async function loadAll() {
    setLoading(true);
    const [{ data: typeData }, { data: siteData }] = await Promise.all([
      supabase
        .from("expense_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    setTypes(typeData || []);
    setSite(siteData || null);
    setLoading(false);
  }

  async function loadExpenses() {
    let query = supabase
      .from("expenses")
      .select("*, expense_types(name)")
      .order("expense_date", { ascending: false });

    if (from) {
      query = query.gte(
        "expense_date",
        startOfDay(new Date(from)).toISOString(),
      );
    }
    if (to) {
      query = query.lte("expense_date", endOfDay(new Date(to)).toISOString());
    }
    if (typeFilter !== "all") {
      query = query.eq("expense_type_id", typeFilter);
    }

    const { data } = await query;
    setExpenses(data || []);
  }

  function showFlash(msg) {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  }

  function openNew() {
    setError("");
    setEditing({
      ...EMPTY_FORM,
      expense_date: toLocalDateInput(new Date()),
    });
  }

  function openEdit(expense) {
    setError("");
    setEditing({
      ...expense,
      amount: String(expense.amount ?? ""),
      expense_date: toLocalDateInput(new Date(expense.expense_date)),
    });
  }

  async function saveExpense(e) {
    e.preventDefault();
    if (!editing?.expense_type_id || !editing?.title) {
      setError("Please fill in the expense type and title.");
      return;
    }
    if (!Number(editing.amount) || Number(editing.amount) <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    if (!editing.expense_date) {
      setError("Please choose an expense date.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      expense_type_id: editing.expense_type_id,
      title: editing.title.trim(),
      amount: Number(editing.amount),
      expense_date: startOfDay(new Date(editing.expense_date)).toISOString(),
      notes: editing.notes?.trim() || null,
    };

    const { error: saveError } = editing.id
      ? await supabase.from("expenses").update(payload).eq("id", editing.id)
      : await supabase.from("expenses").insert(payload);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setEditing(null);
    showFlash(editing.id ? "Expense updated." : "Expense added.");
    await loadExpenses();
    setSaving(false);
  }

  async function deleteExpense(expense) {
    if (!confirm(`Delete expense "${expense.title}"? This cannot be undone.`))
      return;
    const { error: deleteError } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expense.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    showFlash("Expense deleted.");
    await loadExpenses();
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const typeBreakdown = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      const name = e.expense_types?.name || "Uncategorized";
      map[name] = map[name] || { name, count: 0, total: 0 };
      map[name].count += 1;
      map[name].total += Number(e.amount || 0);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [expenses]);

  const activeTypeLabel =
    typeFilter === "all"
      ? "All Types"
      : types.find((t) => t.id === typeFilter)?.name || "All Types";

  const pageCount = Math.max(1, Math.ceil(expenses.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = expenses.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display text-ink">Expenses</h1>
          <p className="text-sm text-muted mt-1">
            Track your store expenses within a date range.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              printExpenseReport({
                from,
                to,
                typeLabel: activeTypeLabel,
                expenses,
                typeBreakdown,
                site,
              })
            }
            disabled={loading || expenses.length === 0}
            className="btn btn-outline"
          >
            <Printer size={16} />
            Print Report
          </button>
          <button onClick={openNew} className="btn btn-primary">
            <Plus size={16} /> Add Expense
          </button>
        </div>
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

      {/* Filters */}
      <div className="card p-5 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">From</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="input input-sm w-auto"
            />
          </div>

          <div>
            <label className="label">To</label>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="input input-sm w-auto"
            />
          </div>

          <div>
            <label className="label">Expense Type</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="input input-sm w-auto"
            >
              <option value="all">All Types</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto text-right">
            <label className="label">Total in Range</label>
            <p className="text-2xl font-semibold text-accent">
              ৳{total.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Type-wise summary */}
      {typeBreakdown.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {typeBreakdown.map((t) => (
            <span key={t.name} className="chip bg-surface border border-line">
              <Wallet size={12} className="inline -mt-0.5 mr-1" />
              {t.name}: ৳{t.total.toFixed(2)}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted py-10 text-center">
          Loading expenses...
        </p>
      ) : (
        <div className="card overflow-hidden">
          {expenses.length === 0 ? (
            <p className="text-sm text-muted py-12 text-center">
              No expenses in this range — click “Add Expense” to record one.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {paged.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center gap-4 px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">
                      {expense.title}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {new Date(expense.expense_date).toLocaleDateString()} ·{" "}
                      {expense.expense_types?.name || "Uncategorized"}
                      {expense.notes ? ` · ${expense.notes}` : ""}
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-ink shrink-0">
                    ৳{Number(expense.amount).toFixed(2)}
                  </p>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(expense)}
                      aria-label="Edit expense"
                      className="p-2 text-muted hover:text-ink"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => deleteExpense(expense)}
                      aria-label="Delete expense"
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
            total={expenses.length}
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
        title={editing?.id ? "Edit Expense" : "Add Expense"}
        subtitle={editing?.id ? editing.title : "Record a new store expense."}
        size="sm"
      >
        {editing && (
          <form onSubmit={saveExpense} className="space-y-4">
            <div>
              <label className="label">Expense Type</label>
              <select
                value={editing.expense_type_id}
                onChange={(e) =>
                  setEditing({ ...editing, expense_type_id: e.target.value })
                }
                className="input"
                required
              >
                <option value="">— Select type —</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Title</label>
              <input
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
                placeholder="e.g. Weekly vegetable purchase"
                className="input"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Amount (৳)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editing.amount}
                  onChange={(e) =>
                    setEditing({ ...editing, amount: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Date</label>
                <input
                  type="date"
                  value={editing.expense_date}
                  onChange={(e) =>
                    setEditing({ ...editing, expense_date: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Notes (optional)</label>
              <textarea
                value={editing.notes || ""}
                onChange={(e) =>
                  setEditing({ ...editing, notes: e.target.value })
                }
                rows={2}
                className="input resize-none"
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
                    {editing.id ? "Save Changes" : "Add Expense"}
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
