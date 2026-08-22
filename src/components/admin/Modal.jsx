"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

const SIZES = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
};

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = "md",
}) {
  useEffect(() => {
    if (!open) return;

    function onKey(e) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="min-h-full flex items-start justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          className={`relative w-full ${SIZES[size] || SIZES.md} bg-surface border border-line rounded-2xl shadow-2xl my-6 sm:my-10`}
        >
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-line">
            <div>
              <h2 className="text-base font-semibold text-ink">{title}</h2>
              {subtitle && (
                <p className="text-xs text-muted mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-full text-muted hover:text-ink hover:bg-primary/5 shrink-0"
            >
              <X size={18} />
            </button>
          </div>
          <div className="px-6 py-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
