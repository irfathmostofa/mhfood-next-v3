"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle, Search } from "lucide-react";
import { toHtml } from "@/lib/richtext";

export default function FaqList({ faqs = [], compact = false }) {
  const [openId, setOpenId] = useState(faqs[0]?.id || null);
  const [query, setQuery] = useState("");

  const filtered = faqs.filter((faq) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const answerText = String(faq.answer || "").replace(/<[^>]*>/g, " ");
    return (
      faq.question.toLowerCase().includes(q) ||
      answerText.toLowerCase().includes(q)
    );
  });

  if (!faqs.length) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-16 text-center">
        <HelpCircle size={32} className="mx-auto text-muted mb-3" />
        <p className="text-sm text-muted">
          No questions yet. Check back soon or contact us for help.
        </p>
      </div>
    );
  }

  return (
    <div>
      {!compact && faqs.length > 4 && (
        <div className="relative mb-6 max-w-full">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions..."
            className="w-full pl-11 pr-4 py-3 rounded-full border border-line bg-surface text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted py-10 text-center">
          No questions match “{query}”.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((faq, index) => {
            const open = openId === faq.id;
            return (
              <div
                key={faq.id}
                className={`rounded-2xl border bg-surface overflow-hidden transition-colors ${
                  open ? "border-accent/40 shadow-sm" : "border-line"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : faq.id)}
                  aria-expanded={open}
                  className="w-full flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-4 text-left"
                >
                  <span className="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-primary/8 text-primary text-xs font-semibold flex items-center justify-center">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 min-w-0 text-sm sm:text-base font-medium text-ink leading-snug">
                    {faq.question}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 mt-1 text-muted transition-transform duration-200 ${
                      open ? "rotate-180 text-accent" : ""
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-200 ${
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div
                      className="px-4 sm:px-5 pb-5 pl-14 sm:pl-16 prose prose-sm max-w-none text-muted leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: toHtml(faq.answer),
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
