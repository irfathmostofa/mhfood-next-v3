// Opens a print window containing a POS-style receipt for an order.
// The receipt is designed for 80mm thermal printers but prints fine on
// any A4/Letter printer too.

export function printPOSInvoice({ order, items, site }) {
  const storeName =
    site?.store_name || "MHFood";
  const address = site?.store_address || "";
  const phone = site?.store_phone || "";

  const line = (label, value, strong = false) => {
    const l = String(label);
    const v = String(value);
    const pad = Math.max(1, 42 - l.length - v.length);
    const cls = strong ? 'class="strong"' : "";
    return `<div ${cls}><span>${l}</span>${" ".repeat(pad)}<span>${v}</span></div>`;
  };

  const itemRows = (items || [])
    .map((it) => {
      const name = `${it.product_name}${it.variant_text ? ` (${it.variant_text})` : ""}`;
      const sub = `    ${it.quantity} x ${Number(it.price).toFixed(2)}`;
      const total = (Number(it.price) * Number(it.quantity)).toFixed(2);
      return `<div class="item"><span>${name}</span></div>
<div class="sub"><span>${sub}</span><span>${total}</span></div>`;
    })
    .join("\n");

  const statusLabel = (order?.status || "pending").replace(/_/g, " ");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice ${order?.tracking_code || ""}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Courier New", ui-monospace, Menlo, monospace;
    font-size: 12px;
    color: #111;
    width: 302px;
    margin: 0 auto;
    padding: 16px 12px;
  }
  .center { text-align: center; }
  h1 { font-size: 16px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px; }
  .muted { color: #555; }
  .hr { border-top: 1px dashed #888; margin: 8px 0; }
  .row { display: flex; justify-content: space-between; }
  .row span:first-child { text-transform: uppercase; }
  .row span:last-child { white-space: nowrap; }
  .strong { font-weight: bold; }
  .item { margin-top: 6px; }
  .sub { display: flex; justify-content: space-between; margin-bottom: 2px; color: #333; }
  .total { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 4px; }
  .footer { margin-top: 12px; text-align: center; font-size: 11px; }
  @media print {
    body { width: 302px; }
    @page { margin: 0; size: 80mm auto; }
  }
</style>
</head>
<body>
  <div class="center">
    <h1>${storeName}</h1>
    ${address ? `<div class="muted">${address}</div>` : ""}
    ${phone ? `<div class="muted">${phone}</div>` : ""}
  </div>
  <div class="hr"></div>
  <div class="row"><span>Invoice No.</span><span>${order?.tracking_code || ""}</span></div>
  <div class="row"><span>Date</span><span>${new Date(order?.created_at).toLocaleString()}</span></div>
  <div class="row"><span>Status</span><span>${statusLabel}</span></div>
  <div class="row"><span>Payment</span><span>Cash on Delivery</span></div>
  <div class="hr"></div>
  <div class="strong">Customer</div>
  <div>${order?.customer_name || ""}</div>
  ${order?.phone ? `<div>${order.phone}</div>` : ""}
  ${order?.address ? `<div>${order.address}</div>` : ""}
  <div class="hr"></div>
  <div class="strong">Items</div>
  ${itemRows || "<div>No items</div>"}
  <div class="hr"></div>
  ${line("Subtotal", (Number(order?.total_amount || 0) - Number(order?.delivery_charge || 0) + Number(order?.discount_amount || 0)).toFixed(2))}
  ${Number(order?.discount_amount || 0) > 0 ? line("Discount", `-${Number(order.discount_amount).toFixed(2)}`) : ""}
  ${line("Delivery", Number(order?.delivery_charge || 0) === 0 ? "FREE" : Number(order.delivery_charge).toFixed(2))}
  <div class="total"><span>Total</span><span>BDT ${Number(order?.total_amount || 0).toFixed(2)}</span></div>
  <div class="footer">
    Thank you for shopping with us!
  </div>
  <script>
    window.onload = function () { window.print(); };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) {
    alert("Please allow pop-ups to print the invoice.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
