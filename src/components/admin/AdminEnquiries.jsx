"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Pagination from "./Pagination";
import { useToast } from "@/components/Toast";

const STATUSES = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "closed", label: "Closed" },
];

const STATUS_PILL = {
  new: "bg-amber-50 text-amber-700 border-amber-200",
  contacted: "bg-sky-50 text-sky-700 border-sky-200",
  closed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function AdminEnquiries() {
  const { success, error: toastError } = useToast();
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    loadEnquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadEnquiries() {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_enquiries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toastError(error.message);
    setEnquiries(data || []);
    setLoading(false);
  }

  async function updateStatus(id, status) {
    setUpdatingId(id);
    const { error } = await supabase
      .from("product_enquiries")
      .update({ status })
      .eq("id", id);
    if (error) {
      toastError(error.message);
    } else {
      setEnquiries((prev) =>
        prev.map((row) => (row.id === id ? { ...row, status } : row)),
      );
      success("Enquiry updated.");
    }
    setUpdatingId(null);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enquiries.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!q) return true;
      return `${row.customer_name} ${row.phone} ${row.email || ""} ${row.product_name}`
        .toLowerCase()
        .includes(q);
    });
  }, [enquiries, filter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display text-ink">Enquiries</h1>
        <p className="text-sm text-muted mt-1">
          Restock requests from out-of-stock products.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          {STATUSES.map((status) => (
            <button
              key={status.key}
              onClick={() => {
                setFilter(status.key);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs border ${
                filter === status.key
                  ? "bg-primary text-white border-primary"
                  : "bg-surface text-ink border-line"
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm sm:ml-auto">
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
            placeholder="Search name, phone or product..."
            className="input pl-9"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted py-10 text-center">Loading enquiries...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted py-10 text-center">No enquiries yet.</p>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary/5 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Message</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => (
                  <tr key={row.id} className="border-t border-line align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{row.customer_name}</p>
                      <p className="text-xs text-muted">{row.phone}</p>
                      {row.email && (
                        <p className="text-xs text-muted">{row.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.product_slug ? (
                        <Link
                          href={`/product/${row.product_slug}`}
                          className="text-ink hover:text-accent"
                        >
                          {row.product_name}
                        </Link>
                      ) : (
                        <span>{row.product_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{row.quantity}</td>
                    <td className="px-4 py-3 max-w-xs text-muted">
                      {row.message || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-medium ${
                            STATUS_PILL[row.status] || STATUS_PILL.new
                          }`}
                        >
                          {row.status}
                        </span>
                        <select
                          value={row.status}
                          disabled={updatingId === row.id}
                          onChange={(e) => updateStatus(row.id, e.target.value)}
                          className="input input-sm w-auto"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="closed">Closed</option>
                        </select>
                        {updatingId === row.id && (
                          <Loader2 size={14} className="animate-spin text-muted" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={filtered.length}
            onChange={(nextPage, nextSize) => {
              setPage(nextPage);
              if (nextSize) setPageSize(nextSize);
            }}
          />
        </div>
      )}
    </div>
  );
}
