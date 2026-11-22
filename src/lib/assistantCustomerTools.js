// Customer assistant tools. All READ-ONLY: the assistant can search and
// prepare an order draft, but the order itself is only created when the
// customer presses "Confirm order" in the UI, which calls /api/orders
// (that route re-prices everything server-side).

import { supabase } from "@/lib/supabase";
import {
  decorateProductsWithSale,
  getLiveSaleUnitPrices,
} from "@/lib/discountSessions";
import { computeSalePrice } from "@/lib/salePricing";
import {
  pickBestDiscount,
  couponDiscount,
  validateCoupon,
} from "@/lib/pricing";
import { getSiteSettings, getCategories, getPickupPoints } from "@/lib/site";
import {
  searchLocations,
  formatLocation,
  getLocationByKey,
} from "@/lib/bangladeshLocations";
import { chargeForLocation } from "@/lib/deliveryCharge";

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function toLatinDigits(value) {
  return String(value ?? "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
}

function normalizePhone(value) {
  let digits = toLatinDigits(value).replace(/\D/g, "");
  if (digits.startsWith("880")) digits = `0${digits.slice(3)}`;
  return /^01\d{9}$/.test(digits) ? digits : "";
}

function cleanTerm(value) {
  return toLatinDigits(value)
    .replace(/[%*(),\\"'`]/g, " ")
    .trim();
}

async function fetchDeliveryExtras() {
  const { data, error } = await supabase
    .from("delivery_locations")
    .select("*")
    .eq("is_active", true);
  return error ? [] : data || [];
}

const PRODUCT_SELECT =
  "id, name, slug, short_description, price, regular_price, stock, unit, categories(name), brands(name), product_images(image_url, sort_order), product_variants(id, name, value, price_adjustment, stock, is_active, sort_order)";

function activeVariants(p) {
  return [...(p.product_variants || [])]
    .filter((v) => v.is_active !== false)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function firstImage(p) {
  return (
    [...(p.product_images || [])].sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
    )[0]?.image_url || null
  );
}

export const CUSTOMER_TOOLS = [
  {
    name: "search_products",
    description:
      "Search the store catalogue. Use for any request about finding, comparing or recommending products. Returns real prices, stock and options.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Keywords in Bangla or English, e.g. 'mustard oil' or 'সরিষার তেল'. Omit to browse.",
        },
        category: { type: "string", description: "Category name (optional)." },
        min_price: { type: "number" },
        max_price: { type: "number" },
        in_stock_only: { type: "boolean", description: "Default true." },
        on_sale_only: {
          type: "boolean",
          description: "Only discounted items.",
        },
        limit: { type: "integer", description: "1-10, default 6." },
      },
    },
  },
  {
    name: "list_categories",
    description:
      "List the store's product categories (top level with children).",
  },
  {
    name: "find_delivery_area",
    description:
      "Find delivery areas matching text (upazila / area / district, Bangla or English) and return the delivery charge for each.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "get_pickup_points",
    description: "List store pickup points (free pickup).",
  },
  {
    name: "prepare_order",
    description:
      "Validate an order and compute the real total. Does NOT place the order; the customer confirms with a button. Call only after you have every required detail.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string" },
              quantity: { type: "integer" },
              variant_ids: {
                type: "array",
                items: { type: "string" },
                description:
                  "One variant id per option group (e.g. Size and Color) when the product has options.",
              },
            },
            required: ["product_id", "quantity"],
          },
        },
        fulfillment: { type: "string", enum: ["delivery", "pickup"] },
        location_key: {
          type: "string",
          description: "location_key from find_delivery_area (delivery only).",
        },
        pickup_point_id: { type: "string", description: "Pickup only." },
        coupon_code: { type: "string" },
        customer: {
          type: "object",
          properties: {
            name: { type: "string" },
            phone: { type: "string" },
            email: { type: "string" },
            address: { type: "string", description: "House, road, landmark." },
          },
        },
      },
      required: ["items", "fulfillment", "customer"],
    },
  },
];

export function createCustomerHandlers() {
  async function search_products(args, artifacts) {
    const limit = clamp(Math.floor(Number(args.limit)) || 6, 1, 10);
    const inStockOnly = args.in_stock_only !== false;

    let q = supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("is_active", true);

    if (args.category) {
      const { data: cats } = await supabase
        .from("categories")
        .select("id, name, slug, parent_id")
        .eq("is_active", true);
      const needle = cleanTerm(args.category).toLowerCase();
      const matched = (cats || []).filter((c) => {
        const name = String(c.name || "").toLowerCase();
        return name.includes(needle) || (needle && needle.includes(name));
      });
      if (matched.length === 0) {
        return {
          count: 0,
          products: [],
          note: `No category matches "${args.category}". Call list_categories.`,
        };
      }
      const ids = new Set(matched.map((c) => c.id));
      (cats || []).forEach(
        (c) => c.parent_id && ids.has(c.parent_id) && ids.add(c.id),
      );
      q = q.in("category_id", [...ids]);
    }

    const tokens = cleanTerm(args.query)
      .split(/\s+/)
      .filter((t) => t.length >= 2)
      .slice(0, 5);
    if (tokens.length) {
      q = q.or(
        tokens
          .flatMap((t) => [
            `name.ilike.%${t}%`,
            `short_description.ilike.%${t}%`,
          ])
          .join(","),
      );
    }
    if (inStockOnly) q = q.gt("stock", 0);

    const { data, error } = await q.limit(60);
    if (error) throw new Error(error.message);

    const base = (data || []).map((p) => ({
      ...p,
      product_variants: activeVariants(p),
    }));
    let products = await decorateProductsWithSale(base);

    if (tokens.length) {
      const score = (p) => {
        const name = String(p.name || "").toLowerCase();
        const desc = String(p.short_description || "").toLowerCase();
        return tokens.reduce(
          (s, t) =>
            s +
            (name.includes(t.toLowerCase()) ? 2 : 0) +
            (desc.includes(t.toLowerCase()) ? 1 : 0),
          0,
        );
      };
      products.sort((a, b) => score(b) - score(a));
    }

    const min = Number(args.min_price);
    const max = Number(args.max_price);
    products = products.filter(
      (p) =>
        (!Number.isFinite(min) || !args.min_price || Number(p.price) >= min) &&
        (!Number.isFinite(max) || !args.max_price || Number(p.price) <= max) &&
        (!args.on_sale_only || p.sale_price != null),
    );
    products = products.slice(0, limit);

    for (const p of products) {
      if (artifacts.products.length >= 8) break;
      if (artifacts.products.some((x) => x.id === p.id)) continue;
      const variants = (p.product_variants || []).map((v) => ({
        id: v.id,
        name: v.name,
        value: v.value,
        price_adjustment: Number(v.price_adjustment || 0),
        stock: Number(v.stock),
      }));
      const image = firstImage(p);
      artifacts.products.push({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        regular_price: Number(p.regular_price) || 0,
        stock: Number(p.stock),
        unit: p.unit || "",
        image_url: image,
        product_images: image ? [{ image_url: image }] : [],
        variants,
      });
    }

    return {
      count: products.length,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        regular_price: Number(p.regular_price) || null,
        on_sale: p.sale_price != null,
        stock: Number(p.stock),
        unit: p.unit || null,
        category: p.categories?.name || null,
        brand: p.brands?.name || null,
        summary: String(p.short_description || "").slice(0, 140) || null,
        options: (p.product_variants || []).map((v) => ({
          variant_id: v.id,
          group: v.name,
          value: v.value,
          price_adjustment: Number(v.price_adjustment || 0),
          stock: Number(v.stock),
        })),
      })),
      note:
        products.length === 0
          ? "No match. Try a Bangla/English synonym, or relax filters."
          : undefined,
    };
  }

  async function list_categories() {
    const cats = await getCategories();
    const parents = cats.filter((c) => !c.parent_id);
    return {
      categories: parents.map((p) => ({
        name: p.name,
        children: cats.filter((c) => c.parent_id === p.id).map((c) => c.name),
      })),
    };
  }

  async function find_delivery_area({ query }) {
    const tokens = cleanTerm(query).toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0)
      return { areas: [], note: "Ask for an area name." };

    const [settings, extras] = await Promise.all([
      getSiteSettings(),
      fetchDeliveryExtras(),
    ]);
    const all = searchLocations("", { extras });
    const matches = all
      .filter((l) => {
        const hay = `${l.division} ${l.district} ${l.area}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      })
      .slice(0, 6);

    return {
      areas: matches.map((l) => ({
        location_key: l.key,
        label: formatLocation(l),
        delivery_charge: chargeForLocation(l, settings, extras),
      })),
      free_delivery_over: settings?.free_delivery_enabled
        ? Number(settings.free_delivery_threshold || 0)
        : null,
      note:
        matches.length === 0
          ? "No area matched. Ask for upazila/district."
          : undefined,
    };
  }

  async function get_pickup_points() {
    const points = await getPickupPoints();
    return {
      pickup_points: points.map((p) => ({
        pickup_point_id: p.id,
        name: p.name,
        address: p.address,
        hours: p.hours || null,
        phone: p.phone || null,
      })),
    };
  }

  async function prepare_order(args, artifacts) {
    const c = args.customer || {};
    const name = String(c.name || "").trim();
    const phone = normalizePhone(c.phone);
    const email = String(c.email || "").trim();
    const address = String(c.address || "").trim();
    const fulfillment = args.fulfillment === "pickup" ? "pickup" : "delivery";
    const rawItems = Array.isArray(args.items) ? args.items.slice(0, 20) : [];

    const missing = [];
    if (rawItems.length === 0) missing.push("items");
    if (!name) missing.push("customer.name");
    if (!phone)
      missing.push("customer.phone (valid 11-digit mobile, 01XXXXXXXXX)");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      missing.push("customer.email");
    if (fulfillment === "delivery") {
      if (!address) missing.push("customer.address");
      if (!args.location_key)
        missing.push("location_key (use find_delivery_area)");
    } else if (!args.pickup_point_id) {
      missing.push("pickup_point_id (use get_pickup_points)");
    }
    if (missing.length) return { ok: false, missing };

    const [settings, extras, pickupPoints, rulesRes] = await Promise.all([
      getSiteSettings(),
      fetchDeliveryExtras(),
      getPickupPoints(),
      supabase.from("discount_rules").select("*").eq("is_active", true),
    ]);

    const location =
      fulfillment === "delivery"
        ? getLocationByKey(args.location_key, extras)
        : null;
    if (fulfillment === "delivery" && !location) {
      return {
        ok: false,
        error: "Unknown location_key. Call find_delivery_area again.",
      };
    }
    const pickup =
      fulfillment === "pickup"
        ? pickupPoints.find((p) => p.id === args.pickup_point_id)
        : null;
    if (fulfillment === "pickup" && !pickup) {
      return {
        ok: false,
        error: "Unknown pickup_point_id. Call get_pickup_points.",
      };
    }

    const ids = [
      ...new Set(rawItems.map((i) => String(i.product_id || ""))),
    ].filter(Boolean);
    const [{ data: prodRows }, { data: variantRows }, sales] =
      await Promise.all([
        supabase
          .from("products")
          .select(
            "id, name, price, stock, product_images(image_url, sort_order)",
          )
          .eq("is_active", true)
          .in("id", ids),
        supabase
          .from("product_variants")
          .select("id, product_id, name, value, price_adjustment, stock")
          .eq("is_active", true)
          .in("product_id", ids),
        getLiveSaleUnitPrices(ids),
      ]);
    const productMap = Object.fromEntries(
      (prodRows || []).map((p) => [p.id, p]),
    );
    const variantsByProduct = {};
    for (const v of variantRows || []) {
      (variantsByProduct[v.product_id] ||= []).push(v);
    }

    const items = [];
    let subtotal = 0;
    for (const raw of rawItems) {
      const product = productMap[raw.product_id];
      if (!product) {
        return {
          ok: false,
          error: `A product is no longer available. Search again.`,
        };
      }
      const qty = clamp(Math.floor(Number(raw.quantity)) || 1, 1, 50);
      const options = variantsByProduct[product.id] || [];
      const groups = new Set(options.map((v) => v.name));
      const chosen = (
        Array.isArray(raw.variant_ids) ? raw.variant_ids : []
      ).map((id) => options.find((v) => v.id === id));
      if (chosen.some((v) => !v)) {
        return {
          ok: false,
          error: `Invalid option for "${product.name}". Use variant_id values from search_products.`,
        };
      }
      const chosenGroups = new Set(chosen.map((v) => v.name));
      if (chosenGroups.size !== chosen.length) {
        return {
          ok: false,
          error: `Pick only one option per group for "${product.name}".`,
        };
      }
      if (groups.size && chosenGroups.size !== groups.size) {
        const need = [...groups].filter((g) => !chosenGroups.has(g)).join(", ");
        return {
          ok: false,
          error: `"${product.name}" needs a choice for: ${need}.`,
        };
      }

      const stock = chosen.length
        ? Math.min(...chosen.map((v) => Number(v.stock)))
        : Number(product.stock);
      if (stock < qty) {
        return {
          ok: false,
          error: `Only ${stock} of "${product.name}" in stock.`,
        };
      }

      const sale = sales[product.id];
      const basePrice = sale
        ? computeSalePrice(
            product.price,
            sale.discount_type,
            sale.discount_value,
          )
        : Number(product.price);
      const unit = round2(
        basePrice +
          chosen.reduce((s, v) => s + Number(v.price_adjustment || 0), 0),
      );
      subtotal += unit * qty;
      items.push({
        product_id: product.id,
        product_name: product.name,
        variant_ids: chosen.map((v) => v.id),
        variant_text:
          chosen.map((v) => `${v.name}: ${v.value}`).join(" · ") || null,
        quantity: qty,
        price: unit,
        image_url:
          [...(product.product_images || [])].sort(
            (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
          )[0]?.image_url || null,
      });
    }
    subtotal = round2(subtotal);

    const auto = pickBestDiscount(rulesRes.data || [], subtotal);
    const autoDiscount = auto ? auto.amount : 0;

    let couponCode = null;
    let couponAmount = 0;
    let couponNote;
    if (args.coupon_code) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", String(args.coupon_code).trim().toUpperCase())
        .maybeSingle();
      const check = validateCoupon(coupon, subtotal);
      if (check.ok) {
        couponCode = coupon.code;
        couponAmount = couponDiscount(coupon, subtotal);
      } else {
        couponNote = check.reason;
      }
    }

    const discount = round2(Math.min(autoDiscount + couponAmount, subtotal));
    const freeDelivery =
      fulfillment === "delivery" &&
      Boolean(settings?.free_delivery_enabled) &&
      subtotal >= Number(settings.free_delivery_threshold || 0);
    const deliveryCharge =
      fulfillment === "pickup" || freeDelivery
        ? 0
        : chargeForLocation(location, settings, extras);
    const total = round2(subtotal - discount + deliveryCharge);

    const draft = {
      items,
      customer: {
        name,
        phone,
        email,
        address: fulfillment === "delivery" ? address : "",
      },
      fulfillment,
      locationKey: location?.key || null,
      pickupPointId: pickup?.id || null,
      couponCode,
      deliveryLabel: pickup
        ? `Pickup: ${pickup.name}`
        : `Delivery: ${formatLocation(location)}`,
      subtotal,
      discount,
      discountLabel: couponCode || (auto ? auto.rule.label : null),
      deliveryCharge,
      freeDelivery,
      total,
    };
    artifacts.orderDraft = draft;

    return {
      ok: true,
      summary: {
        items: items.map((i) => ({
          name: i.product_name,
          options: i.variant_text,
          quantity: i.quantity,
          unit_price: i.price,
        })),
        subtotal,
        discount,
        delivery_charge: deliveryCharge,
        total,
        fulfillment: draft.deliveryLabel,
        coupon_note: couponNote,
      },
      instruction:
        "Summarise this for the customer and tell them to press the Confirm order button below. The order is NOT placed yet.",
    };
  }

  return {
    search_products,
    list_categories,
    find_delivery_area,
    get_pickup_points,
    prepare_order,
  };
}
