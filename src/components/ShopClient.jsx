"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import ProductCard from "@/components/ProductCard";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
];

export default function ShopClient({ categories = [], products = [] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Free-text filters are kept local and debounced into the URL.
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [minPrice, setMinPrice] = useState(searchParams.get("min") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("max") || "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const inputTimer = useRef(null);

  // Instant filters are derived directly from the URL.
  const category = searchParams.get("category") || "all";
  const sort = searchParams.get("sort") || "newest";
  const inStockOnly = searchParams.get("instock") === "1";

  // Keep local input state in sync when navigating from the header search.
  useEffect(() => {
    setQuery(searchParams.get("q") || "");
    setMinPrice(searchParams.get("min") || "");
    setMaxPrice(searchParams.get("max") || "");
  }, [searchParams]);

  function updateParams(changes) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === "" || value === null || value === undefined) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const newUrl = `/shop${params.toString() ? `?${params.toString()}` : ""}`;
    startTransition(() => {
      router.replace(newUrl, { scroll: false });
    });
  }

  // Debounce free-text filters (query + price range) into the URL.
  useEffect(() => {
    clearTimeout(inputTimer.current);
    inputTimer.current = setTimeout(() => {
      const cur = new URLSearchParams(searchParams.toString());
      if (
        query === (cur.get("q") || "") &&
        minPrice === (cur.get("min") || "") &&
        maxPrice === (cur.get("max") || "")
      ) {
        return;
      }
      updateParams({ q: query, min: minPrice, max: maxPrice });
    }, 400);
    return () => clearTimeout(inputTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, minPrice, maxPrice]);

  function resetFilters() {
    setQuery("");
    setMinPrice("");
    setMaxPrice("");
    updateParams({
      q: "",
      category: "",
      sort: "",
      min: "",
      max: "",
      instock: "",
    });
  }

  const activeFilterCount = [
    category !== "all",
    !!minPrice,
    !!maxPrice,
    inStockOnly,
  ].filter(Boolean).length;

  const filterPanel = useMemo(
    () => (
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-ink mb-3">
            Price Range (৳)
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              placeholder="Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="input"
            />
            <span className="text-muted">–</span>
            <input
              type="number"
              min="0"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="input"
            />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink mb-3">Category</h3>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => updateParams({ category: "" })}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                category === "all"
                  ? "bg-primary text-white"
                  : "text-ink hover:bg-primary/5"
              }`}
            >
              All Products
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => updateParams({ category: cat.id })}
                className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  category === cat.id
                    ? "bg-primary text-white"
                    : "text-ink hover:bg-primary/5"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) =>
              updateParams({ instock: e.target.checked ? "1" : "" })
            }
            className="w-4 h-4 rounded accent-[#C77B4C]"
          />
          In stock only
        </label>

        {activeFilterCount > 0 && (
          <button
            onClick={resetFilters}
            className="text-sm text-accent hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minPrice, maxPrice, inStockOnly, category, activeFilterCount, categories],
  );

  return (
    <div className="max-w-8xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
        <h1 className="font-display text-2xl sm:text-3xl text-ink">Shop</h1>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltersOpen(true)}
            className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-full border border-line text-sm text-ink hover:border-primary transition-colors"
          >
            <SlidersHorizontal size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 flex items-center justify-center text-[10px] rounded-full bg-accent text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          <select
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value })}
            className="px-3 py-2 rounded-full border border-line text-sm text-ink outline-none focus:border-primary bg-surface transition-colors"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {query && (
        <p className="text-sm text-muted mb-6">
          Search results for &ldquo;
          <span className="text-ink font-medium">{query}</span>
          &rdquo;
          <button
            onClick={() => {
              setQuery("");
              updateParams({ q: "" });
            }}
            className="ml-2 text-accent hover:underline"
          >
            Clear
          </button>
        </p>
      )}

      <div className="flex gap-8 mt-6">
        <aside className="hidden lg:block w-60 shrink-0">
          <div className="sticky top-24 card p-5">{filterPanel}</div>
        </aside>

        <div className="flex-1 min-w-0">
          {isPending ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-4 sm:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] bg-primary/5 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-muted mb-2">
                No products match your filters.
              </p>
              <button
                onClick={resetFilters}
                className="text-sm text-accent hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      <div
        onClick={() => setFiltersOpen(false)}
        className={`fixed inset-0 bg-black/40 z-[60] transition-opacity duration-300 lg:hidden ${
          filtersOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        className={`fixed top-0 left-0 h-full w-full sm:w-96 bg-background z-[70] shadow-2xl flex flex-col transform transition-transform duration-300 lg:hidden ${
          filtersOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-line shrink-0">
          <h2 className="font-display text-lg text-ink">Filters</h2>
          <button
            onClick={() => setFiltersOpen(false)}
            aria-label="Close filters"
            className="p-1.5 rounded-full hover:bg-primary/5 text-ink"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{filterPanel}</div>
        <div className="border-t border-line px-5 py-4 shrink-0">
          <button
            onClick={() => setFiltersOpen(false)}
            className="btn btn-primary w-full"
          >
            Show {products.length} result{products.length !== 1 ? "s" : ""}
          </button>
        </div>
      </aside>
    </div>
  );
}
