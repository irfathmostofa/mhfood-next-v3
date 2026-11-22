// Admin assistant tools. READ-ONLY. `sb` must be the authenticated client
// from createAdminClient(), created after requireAdmin() succeeded.
// Dates are resolved here (Asia/Dhaka, UTC+6, no DST) — the model never
// does date maths, it only picks a `period` or explicit from/to.

const DHAKA_OFFSET_MS = 6 * 3600 * 1000;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function today() {
  return new Date(Date.now() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function resolveRange({ period, from, to } = {}) {
  const t = today();
  let f = from;
  let e = to;
  switch (period) {
    case "today":
      f = e = t;
      break;
    case "yesterday":
      f = e = addDays(t, -1);
      break;
    case "last_7_days":
      f = addDays(t, -6);
      e = t;
      break;
    case "last_30_days":
      f = addDays(t, -29);
      e = t;
      break;
    case "this_month":
      f = `${t.slice(0, 8)}01`;
      e = t;
      break;
    case "last_month": {
      e = addDays(`${t.slice(0, 8)}01`, -1);
      f = `${e.slice(0, 8)}01`;
      break;
    }
    case "this_year":
      f = `${t.slice(0, 5)}01-01`;
      e = t;
      break;
    case "all_time":
      f = "2000-01-01";
      e = t;
      break;
    default:
      break;
  }
  if (!f && !e) f = e = t;
  if (!f) f = e;
  if (!e) e = f;
  if (!DATE_RE.test(f) || !DATE_RE.test(e)) {
    throw new Error("Dates must be YYYY-MM-DD.");
  }
  if (f > e) [f, e] = [e, f];
  return {
    from: f,
    to: e,
    startISO: new Date(`${f}T00:00:00+06:00`).toISOString(),
    endISO: new Date(`${e}T23:59:59.999+06:00`).toISOString(),
  };
}

// Supabase caps each response (default 1000 rows), so page through.
async function fetchAll(buildQuery, pageSize = 1000, maxPages = 10) {
  const rows = [];
  for (let p = 0; p < maxPages; p++) {
    const { data, error } = await buildQuery().range(
      p * pageSize,
      (p + 1) * pageSize - 1,
    );
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function cleanTerm(value) {
  return String(value ?? "")
    .replace(/[%*(),\\"'`]/g, " ")
    .trim();
}

const PERIODS = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
  "this_year",
  "all_time",
];

const RANGE_PROPS = {
  period: { type: "string", enum: PERIODS },
  from: { type: "string", description: "YYYY-MM-DD (use with `to`)." },
  to: { type: "string", description: "YYYY-MM-DD" },
};

export const ADMIN_TOOLS = [
  {
    name: "sales_summary",
    description:
      "Sales report for a date range: order counts by status, revenue, average order value, product cost, gross profit, expenses and net profit.",
    parameters: { type: "object", properties: RANGE_PROPS },
  },
  {
    name: "top_products",
    description:
      "Best-selling products in a date range (cancelled orders excluded).",
    parameters: {
      type: "object",
      properties: {
        ...RANGE_PROPS,
        by: { type: "string", enum: ["quantity", "revenue"] },
        limit: { type: "integer", description: "1-20, default 5." },
      },
    },
  },
  {
    name: "stock_report",
    description:
      "Stock levels. mode=low lists products at/below threshold, out lists out-of-stock, search finds products by name, summary gives counts only.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["low", "out", "search", "summary"] },
        query: { type: "string", description: "Product name (mode=search)." },
        threshold: {
          type: "integer",
          description: "Low-stock limit, default 10.",
        },
        limit: { type: "integer", description: "1-50, default 20." },
      },
    },
  },
  {
    name: "order_lookup",
    description:
      "Find orders by tracking code, customer phone, or status within a date range.",
    parameters: {
      type: "object",
      properties: {
        ...RANGE_PROPS,
        tracking_code: { type: "string" },
        phone: { type: "string" },
        status: {
          type: "string",
          enum: [
            "pending",
            "confirmed",
            "out_for_delivery",
            "delivered",
            "cancelled",
          ],
        },
        limit: { type: "integer", description: "1-25, default 10." },
      },
    },
  },
  {
    name: "expenses_summary",
    description: "Expenses in a date range, grouped by expense type.",
    parameters: { type: "object", properties: RANGE_PROPS },
  },
  {
    name: "attention_summary",
    description:
      "What needs attention now: pending orders, new enquiries, new custom orders, low and out-of-stock counts.",
  },
];

export function createAdminHandlers(sb) {
  async function sales_summary(args) {
    const r = resolveRange(args);

    const orders = await fetchAll(() =>
      sb
        .from("orders")
        .select("id, total_amount, status, order_type")
        .gte("created_at", r.startISO)
        .lte("created_at", r.endISO)
        .order("created_at", { ascending: false })
        .order("id"),
    );

    const byStatus = {};
    for (const o of orders) {
      const s = (byStatus[o.status] ||= { orders: 0, amount: 0 });
      s.orders += 1;
      s.amount += Number(o.total_amount || 0);
    }
    const valid = orders.filter((o) => o.status !== "cancelled");
    const revenue = valid.reduce((s, o) => s + Number(o.total_amount || 0), 0);

    const items = await fetchAll(() =>
      sb
        .from("order_items")
        .select("product_id, quantity, orders!inner(status, created_at)")
        .gte("orders.created_at", r.startISO)
        .lte("orders.created_at", r.endISO)
        .neq("orders.status", "cancelled")
        .order("id"),
    );
    const products = await fetchAll(() =>
      sb.from("products").select("id, cost").order("id"),
    );
    const costMap = Object.fromEntries(
      products.map((p) => [p.id, Number(p.cost) || 0]),
    );

    let productCost = 0;
    const noCost = new Set();
    for (const i of items) {
      const c = costMap[i.product_id] || 0;
      if (!c && i.product_id) noCost.add(i.product_id);
      productCost += c * Number(i.quantity || 0);
    }

    const expenseRows = await fetchAll(() =>
      sb
        .from("expenses")
        .select("amount")
        .gte("expense_date", r.startISO)
        .lte("expense_date", r.endISO)
        .order("id"),
    );
    const expenses = expenseRows.reduce((s, e) => s + Number(e.amount || 0), 0);

    const grossProfit = revenue - productCost;
    return {
      range: { from: r.from, to: r.to },
      total_orders: orders.length,
      valid_orders: valid.length,
      by_status: Object.fromEntries(
        Object.entries(byStatus).map(([k, v]) => [
          k,
          { orders: v.orders, amount: round2(v.amount) },
        ]),
      ),
      manual_orders: valid.filter((o) => o.order_type === "manual").length,
      revenue: round2(revenue),
      average_order_value: valid.length ? round2(revenue / valid.length) : 0,
      product_cost: round2(productCost),
      gross_profit: round2(grossProfit),
      expenses: round2(expenses),
      net_profit: round2(grossProfit - expenses),
      sold_products_with_no_cost_set: noCost.size,
    };
  }

  async function top_products(args) {
    const r = resolveRange(args);
    const limit = clamp(Math.floor(Number(args.limit)) || 5, 1, 20);
    const by = args.by === "revenue" ? "revenue" : "quantity";

    const items = await fetchAll(() =>
      sb
        .from("order_items")
        .select(
          "product_id, product_name, quantity, price, orders!inner(status, created_at)",
        )
        .gte("orders.created_at", r.startISO)
        .lte("orders.created_at", r.endISO)
        .neq("orders.status", "cancelled")
        .order("id"),
    );

    const map = {};
    for (const i of items) {
      const key = i.product_id || i.product_name;
      const row = (map[key] ||= {
        name: i.product_name,
        quantity: 0,
        revenue: 0,
      });
      row.quantity += Number(i.quantity || 0);
      row.revenue += Number(i.price || 0) * Number(i.quantity || 0);
    }
    const ranked = Object.values(map)
      .sort((a, b) => b[by] - a[by])
      .slice(0, limit)
      .map((p) => ({ ...p, revenue: round2(p.revenue) }));

    return {
      range: { from: r.from, to: r.to },
      ranked_by: by,
      products: ranked,
    };
  }

  async function countOf(query) {
    const { count, error } = await query;
    if (error) {
      console.error("[assistant] count failed:", error.message);
      return null;
    }
    return count ?? 0;
  }

  async function stock_report(args) {
    const mode = ["low", "out", "search", "summary"].includes(args.mode)
      ? args.mode
      : "low";
    const th = clamp(Math.floor(Number(args.threshold)) || 10, 1, 1000);
    const limit = clamp(Math.floor(Number(args.limit)) || 20, 1, 50);

    const head = () =>
      sb
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
    const [active, out, low] = await Promise.all([
      countOf(head()),
      countOf(head().lte("stock", 0)),
      countOf(head().gt("stock", 0).lte("stock", th)),
    ]);
    const counts = {
      active_products: active,
      out_of_stock: out,
      low_stock: low,
      low_stock_threshold: th,
    };
    if (mode === "summary") return { counts };

    let q = sb
      .from("products")
      .select(
        "id, name, stock, unit, product_variants(name, value, stock, is_active)",
      )
      .eq("is_active", true);
    if (mode === "out") q = q.lte("stock", 0).order("name");
    else if (mode === "low")
      q = q.gt("stock", 0).lte("stock", th).order("stock");
    else {
      const term = cleanTerm(args.query);
      if (!term) return { counts, error: "Provide a product name to search." };
      q = q.ilike("name", `%${term}%`).order("name");
    }
    const { data, error } = await q.limit(limit);
    if (error) throw new Error(error.message);

    const products = (data || []).map((p) => ({
      name: p.name,
      stock: Number(p.stock),
      unit: p.unit || null,
      variants: (p.product_variants || [])
        .filter((v) => v.is_active !== false)
        .map((v) => ({
          option: `${v.name}: ${v.value}`,
          stock: Number(v.stock),
        })),
    }));

    let variantAlerts;
    if (mode === "low" || mode === "out") {
      const { data: vrows, error: verr } = await sb
        .from("product_variants")
        .select("name, value, stock, products!inner(name, is_active)")
        .eq("is_active", true)
        .eq("products.is_active", true)
        .lte("stock", mode === "out" ? 0 : th)
        .limit(30);
      if (!verr) {
        variantAlerts = (vrows || []).map((v) => ({
          product: v.products?.name,
          option: `${v.name}: ${v.value}`,
          stock: Number(v.stock),
        }));
      }
    }

    return {
      counts,
      shown: products.length,
      products,
      variant_alerts: variantAlerts,
    };
  }

  async function order_lookup(args) {
    const limit = clamp(Math.floor(Number(args.limit)) || 10, 1, 25);
    let q = sb
      .from("orders")
      .select(
        "id, tracking_code, customer_name, phone, status, total_amount, fulfillment_method, order_type, courier_status, created_at",
      )
      .order("created_at", { ascending: false });

    const code = cleanTerm(args.tracking_code).toUpperCase();
    const phone = String(args.phone || "").replace(/\D/g, "");
    if (code) q = q.eq("tracking_code", code);
    if (phone) q = q.ilike("phone", `%${phone.slice(-10)}%`);
    if (args.status) q = q.eq("status", args.status);
    let range;
    if (args.period || args.from || args.to) {
      range = resolveRange(args);
      q = q.gte("created_at", range.startISO).lte("created_at", range.endISO);
    }

    const { data, error } = await q.limit(limit);
    if (error) throw new Error(error.message);

    const orders = (data || []).map((o) => ({
      tracking_code: o.tracking_code,
      customer: o.customer_name,
      phone: o.phone,
      status: o.status,
      total: Number(o.total_amount),
      type: o.order_type === "manual" ? "manual" : "online",
      fulfillment: o.fulfillment_method,
      courier_status: o.courier_status || null,
      placed_at: o.created_at,
    }));

    let items;
    if (code && data?.length === 1) {
      const { data: rows } = await sb
        .from("order_items")
        .select("product_name, variant_text, quantity, price")
        .eq("order_id", data[0].id);
      items = (rows || []).map((i) => ({
        name: i.product_name,
        options: i.variant_text,
        quantity: i.quantity,
        price: Number(i.price),
      }));
    }
    return { count: orders.length, range, orders, items };
  }

  async function expenses_summary(args) {
    const r = resolveRange(args);
    const rows = await fetchAll(() =>
      sb
        .from("expenses")
        .select("amount, title, expense_types(name)")
        .gte("expense_date", r.startISO)
        .lte("expense_date", r.endISO)
        .order("id"),
    );
    const byType = {};
    for (const e of rows) {
      const name = e.expense_types?.name || "Uncategorized";
      const row = (byType[name] ||= { entries: 0, total: 0 });
      row.entries += 1;
      row.total += Number(e.amount || 0);
    }
    return {
      range: { from: r.from, to: r.to },
      total: round2(rows.reduce((s, e) => s + Number(e.amount || 0), 0)),
      by_type: Object.entries(byType)
        .map(([type, v]) => ({
          type,
          entries: v.entries,
          total: round2(v.total),
        }))
        .sort((a, b) => b.total - a.total),
    };
  }

  async function attention_summary() {
    const exact = { count: "exact", head: true };
    const [pending, enquiries, custom, low, out] = await Promise.all([
      countOf(sb.from("orders").select("id", exact).eq("status", "pending")),
      countOf(
        sb.from("product_enquiries").select("id", exact).eq("status", "new"),
      ),
      countOf(sb.from("custom_orders").select("id", exact).eq("status", "new")),
      countOf(
        sb
          .from("products")
          .select("id", exact)
          .eq("is_active", true)
          .gt("stock", 0)
          .lte("stock", 5),
      ),
      countOf(
        sb
          .from("products")
          .select("id", exact)
          .eq("is_active", true)
          .lte("stock", 0),
      ),
    ]);
    return {
      pending_orders: pending,
      new_enquiries: enquiries,
      new_custom_orders: custom,
      low_stock_products_5_or_less: low,
      out_of_stock_products: out,
      note: "null means that count could not be loaded.",
    };
  }

  return {
    sales_summary,
    top_products,
    stock_report,
    order_lookup,
    expenses_summary,
    attention_summary,
  };
}
