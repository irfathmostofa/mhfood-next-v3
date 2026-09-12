"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { slugify } from "@/lib/slugify";
import Modal from "./Modal";
import Pagination from "./Pagination";
import ProductFormFields, { calcMargin } from "./ProductFormFields";
import {
  saveProductVariants,
  hasActiveVariants,
  variantStockTotal,
} from "./VariantsEditor";

const PAGE_SIZES = [10, 25, 50];

const LOW_STOCK_THRESHOLD = 10;

const EMPTY_PRODUCT = {
  name: "",
  slug: "",
  category_id: "",
  cost: "",
  regular_price: "",
  price: "",
  stock: 0,
  unit: "",
  short_description: "",
  description: "",
  is_featured: false,
  is_active: true,
};

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [featuredFilter, setFeaturedFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: productsData }, { data: categoryData }] = await Promise.all([
      supabase
        .from("products")
        .select("*, product_images(image_url, sort_order), categories(name)")
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("name"),
    ]);
    setProducts(productsData || []);
    setCategories(categoryData || []);
    setLoading(false);
  }

  function showFlash(msg) {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  }

  function openNew() {
    setError("");
    setEditing({
      ...EMPTY_PRODUCT,
      id: null,
      variants: [],
      images: [],
    });
  }

  async function openEdit(product) {
    setError("");
    const [variants, images] = await Promise.all([
      loadVariants(product.id),
      loadImages(product.id),
    ]);
    setEditing({ ...product, variants, images });
  }

  async function saveProduct(e) {
    e.preventDefault();
    if (!editing?.name) return;
    setSaving(true);
    setError("");

    const payload = {
      name: editing.name,
      slug:
        editing.slug ||
        slugify(editing.name) +
          (editing.id ? "" : `-${Date.now().toString(36).slice(-4)}`),
      category_id: editing.category_id || null,
      cost: Number(editing.cost) || 0,
      regular_price: Number(editing.regular_price) || 0,
      price: Number(editing.price) || 0,
      stock: hasActiveVariants(editing.variants)
        ? variantStockTotal(editing.variants)
        : Number(editing.stock) || 0,
      unit: (editing.unit || "").trim(),
      short_description: (editing.short_description || "").trim(),
      description: editing.description || "",
      is_featured: editing.is_featured,
      is_active: editing.is_active,
    };

    const { data: savedProduct, error: productError } = editing.id
      ? await supabase
          .from("products")
          .update(payload)
          .eq("id", editing.id)
          .select()
          .single()
      : await supabase.from("products").insert(payload).select().single();

    if (productError) {
      setError(productError.message);
      setSaving(false);
      return;
    }

    await saveProductVariants(supabase, savedProduct.id, editing.variants);

    // Sync product images.
    const imageRows = editing.images || [];
    const removedImageIds = imageRows
      .filter((im) => im._removed && im.id)
      .map((im) => im.id);
    const existingImageRows = imageRows
      .filter((im) => !im._removed && im.id)
      .map((im) => ({
        id: im.id,
        image_url: im.image_url,
        sort_order: im.sort_order,
      }));
    const newImageRows = imageRows
      .filter((im) => !im._removed && !im.id && im.image_url)
      .map((im, i) => ({
        product_id: savedProduct.id,
        image_url: im.image_url,
        sort_order: im.sort_order || i + 1,
      }));
    if (removedImageIds.length > 0) {
      await supabase.from("product_images").delete().in("id", removedImageIds);
    }
    if (existingImageRows.length > 0) {
      await Promise.all(
        existingImageRows.map((im) =>
          supabase
            .from("product_images")
            .update({ image_url: im.image_url, sort_order: im.sort_order })
            .eq("id", im.id),
        ),
      );
    }
    if (newImageRows.length > 0) {
      await supabase.from("product_images").insert(newImageRows);
    }

    setEditing(null);
    showFlash(editing.id ? "Product updated." : "Product added.");
    await loadAll();
    setSaving(false);
  }

  async function loadVariants(productId) {
    if (!productId) return [];
    const { data } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });
    return data || [];
  }

  async function loadImages(productId) {
    if (!productId) return [];
    const { data } = await supabase
      .from("product_images")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });
    return data || [];
  }

  async function toggleActive(product) {
    await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, is_active: !p.is_active } : p,
      ),
    );
  }

  async function deleteProduct(product) {
    if (!confirm(`Delete product "${product.name}"? This cannot be undone.`))
      return;
    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    showFlash("Product deleted.");
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(product.id);
      return next;
    });
    await loadAll();
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    const pagedIds = paged.map((p) => p.id);
    if (pagedIds.length === 0) return;
    const allSelected = pagedIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      pagedIds.forEach((id) => {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
  }

  async function deleteSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const label = ids.length === 1 ? "product" : "products";
    if (
      !confirm(`Delete ${ids.length} selected ${label}? This cannot be undone.`)
    )
      return;
    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .in("id", ids);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    showFlash(`${ids.length} ${label} deleted.`);
    setSelected(new Set());
    await loadAll();
  }

  const filtered = useMemo(() => {
    const matchesStatus = (p) =>
      statusFilter === "all"
        ? true
        : statusFilter === "active"
          ? !!p.is_active
          : !p.is_active;
    const matchesFeatured = (p) =>
      featuredFilter === "all"
        ? true
        : featuredFilter === "featured"
          ? !!p.is_featured
          : !p.is_featured;
    const matchesStock = (p) => {
      const stock = Number(p.stock) || 0;
      if (stockFilter === "all") return true;
      if (stockFilter === "low")
        return stock > 0 && stock <= LOW_STOCK_THRESHOLD;
      return stock === 0;
    };
    return products.filter(
      (p) =>
        (p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.slug.toLowerCase().includes(search.toLowerCase())) &&
        matchesStatus(p) &&
        matchesFeatured(p) &&
        matchesStock(p),
    );
  }, [products, search, statusFilter, featuredFilter, stockFilter]);

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
          <h1 className="text-2xl font-display text-ink">Products</h1>
          <p className="text-sm text-muted mt-1">
            {products.length} product{products.length === 1 ? "" : "s"} in your
            catalog.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/products/new" className="btn btn-outline">
            <Sparkles size={16} /> Create with AI
          </Link>
          <button onClick={openNew} className="btn btn-primary">
            <Plus size={16} /> Add Product
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
      
      {/* Fixed: Mobile-responsive filter section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="relative w-full sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
              setSelected(new Set());
            }}
            placeholder="Search products..."
            className="input pl-9 w-full"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
              setSelected(new Set());
            }}
            className="input input-sm w-auto min-w-[120px]"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="hidden">Hidden</option>
          </select>

          <select
            value={featuredFilter}
            onChange={(e) => {
              setFeaturedFilter(e.target.value);
              setPage(1);
              setSelected(new Set());
            }}
            className="input input-sm w-auto min-w-[120px]"
            aria-label="Filter by featured"
          >
            <option value="all">All featured</option>
            <option value="featured">Featured</option>
            <option value="standard">Not featured</option>
          </select>

          <select
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value);
              setPage(1);
              setSelected(new Set());
            }}
            className="input input-sm w-auto min-w-[120px]"
            aria-label="Filter by stock"
          >
            <option value="all">All stock</option>
            <option value="low">Low stock (≤{LOW_STOCK_THRESHOLD})</option>
            <option value="out">Out of stock</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted py-10 text-center">
          Loading products...
        </p>
      ) : (
        <div className="card overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted py-12 text-center">
              {search ||
              statusFilter !== "all" ||
              featuredFilter !== "all" ||
              stockFilter !== "all"
                ? "No products match your search or filters."
                : "No products yet — click “Add Product” to create one."}
            </p>
          ) : (
            <div className="divide-y divide-line">
              <div className="flex items-center gap-4 px-5 py-2.5 bg-surface/50">
                <input
                  type="checkbox"
                  checked={
                    paged.length > 0 && paged.every((p) => selected.has(p.id))
                  }
                  onChange={toggleSelectAll}
                  aria-label="Select all products on this page"
                  className="shrink-0 w-4 h-4 accent-[color:var(--accent)]"
                />
                <p className="text-xs text-muted">
                  {selected.size > 0
                    ? `${selected.size} selected`
                    : "Select products to delete"}
                </p>
                {selected.size > 0 && (
                  <button
                    onClick={deleteSelected}
                    className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700"
                  >
                    <Trash2 size={13} /> Delete Selected
                  </button>
                )}
              </div>
              {paged.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-4 px-5 py-3.5"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(product.id)}
                    onChange={() => toggleSelect(product.id)}
                    aria-label={`Select ${product.name}`}
                    className="shrink-0 w-4 h-4 accent-[color:var(--accent)]"
                  />
                  <div className="w-12 h-12 rounded-lg bg-primary/5 overflow-hidden shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        [...(product.product_images || [])].sort(
                          (a, b) => a.sort_order - b.sort_order,
                        )[0]?.image_url ||
                        "https://placehold.co/100x100?text=No+Image"
                      }
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {product.categories?.name || "Uncategorized"} · ৳
                      {Number(product.price).toFixed(2)} · {product.stock} in
                      stock
                      {Number(product.cost) > 0 && (
                        <>
                          {" "}
                          · Profit ৳
                          {(
                            Number(product.price) - Number(product.cost)
                          ).toFixed(2)}{" "}
                          (
                          {calcMargin(
                            Number(product.cost),
                            Number(product.price),
                          ).toFixed(1)}
                          %)
                        </>
                      )}
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    {product.is_featured && (
                      <span className="chip bg-accent/10 text-accent">
                        Featured
                      </span>
                    )}
                    <button
                      onClick={() => toggleActive(product)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        product.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-muted border-line"
                      }`}
                    >
                      {product.is_active ? "Active" : "Hidden"}
                    </button>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(product)}
                      aria-label="Edit product"
                      className="p-2 text-muted hover:text-ink"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => deleteProduct(product)}
                      aria-label="Delete product"
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
        title={editing?.id ? "Edit Product" : "New Product"}
        subtitle={
          editing?.id ? editing.name : "Add a new product to your catalog."
        }
        size="lg"
      >
        {editing && (
          <form onSubmit={saveProduct} className="space-y-4">
            <ProductFormFields
              product={editing}
              onChange={setEditing}
              categories={categories}
              variants={editing.variants || []}
              onVariantsChange={(variants) =>
                setEditing({
                  ...editing,
                  variants,
                  stock: hasActiveVariants(variants)
                    ? variantStockTotal(variants)
                    : editing.stock,
                })
              }
              images={editing.images || []}
              onImagesChange={(images) => setEditing({ ...editing, images })}
              showImages
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
                    {editing.id ? "Save Changes" : "Add Product"}
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