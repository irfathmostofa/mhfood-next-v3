"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  page,
  pageSize,
  total,
  onChange,
  pageSizeOptions = [10, 25, 50],
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const pages = [];
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= 2) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-line">
      <p className="text-xs text-muted">
        Showing {from}–{to} of {total}
      </p>

      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => onChange(1, Number(e.target.value))}
          className="input input-sm w-auto"
          aria-label="Rows per page"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange(Math.max(1, page - 1), pageSize)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-line text-ink hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={15} />
          </button>

          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`e-${i}`} className="px-1 text-muted text-xs">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p, pageSize)}
                className={`w-8 h-8 rounded-lg text-xs font-medium border transition-colors ${
                  p === page
                    ? "bg-primary text-white border-primary"
                    : "border-line text-ink hover:border-primary"
                }`}
              >
                {p}
              </button>
            ),
          )}

          <button
            onClick={() => onChange(Math.min(pageCount, page + 1), pageSize)}
            disabled={page >= pageCount}
            aria-label="Next page"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-line text-ink hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
