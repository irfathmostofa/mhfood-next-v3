// Opens a print window with a formatted sales report for a date range.
// Handles summary cards, status breakdown, and the order list.

const fmtMoney = (n) => `৳${Number(n || 0).toFixed(2)}`;

export function printSalesReport({ from, to, stats, statusBreakdown, orders, site }) {
  const storeName = site?.store_name || "MHFood";
  const address = site?.store_address || "";
  const phone = site?.store_phone || "";

  const statusLabel = (s) => (s || "").replace(/_/g, " ");

  const dateRangeText =
    from && to
      ? `${new Date(from).toLocaleDateString()} – ${new Date(to).toLocaleDateString()}`
      : "All time";

  const summaryRows = [
    ["Total Orders", String(stats.orders || 0)],
    ["Total Revenue", fmtMoney(stats.revenue)],
    ["Delivered Orders", String(stats.delivered || 0)],
    ["Pending Orders", String(stats.pending || 0)],
    ["Cancelled Orders", String(stats.cancelled || 0)],
    ["Average Order Value", fmtMoney(stats.avgOrderValue)],
  ]
    .map(
      ([l, v]) =>
        `<div class="row"><span>${l}</span><span>${v}</span></div>`,
    )
    .join("\n");

  const breakdownRows = (statusBreakdown || [])
    .map(
      (s) =>
        `<div class="row"><span>${statusLabel(s.status)}</span><span>${s.count} · ${fmtMoney(s.revenue)}</span></div>`,
    )
    .join("\n");

  const orderRows = (orders || [])
    .map((o) => {
      const date = new Date(o.created_at).toLocaleDateString();
      return `<div class="row order"><span>${date}</span><span>${o.tracking_code}</span><span>${o.customer_name}</span><span>${fmtMoney(o.total_amount)}</span><span>${statusLabel(o.status)}</span></div>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Sales Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Courier New", ui-monospace, Menlo, monospace;
    font-size: 12px;
    color: #111;
    max-width: 800px;
    margin: 0 auto;
    padding: 24px 20px;
  }
  .center { text-align: center; }
  h1 { font-size: 20px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px; }
  h2 { font-size: 13px; text-transform: uppercase; margin: 18px 0 8px; border-bottom: 1px dashed #888; padding-bottom: 4px; }
  .muted { color: #555; }
  .hr { border-top: 1px dashed #888; margin: 10px 0; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; }
  .row span:first-child { text-transform: uppercase; color: #444; }
  .row span:last-child { font-weight: bold; }
  .order { border-bottom: 1px dotted #ccc; }
  .order span { text-transform: none !important; color: #111 !important; font-weight: normal !important; }
  .order span:nth-child(2) { width: 130px; }
  .order span:nth-child(3) { width: 200px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #555; }
</style>
</head>
<body>
  <div class="center">
    <h1>${storeName}</h1>
    ${address ? `<div class="muted">${address}</div>` : ""}
    ${phone ? `<div class="muted">${phone}</div>` : ""}
  </div>
  <div class="hr"></div>
  <div class="row"><span>Report</span><span>Sales Report</span></div>
  <div class="row"><span>Period</span><span>${dateRangeText}</span></div>
  <div class="row"><span>Generated</span><span>${new Date().toLocaleString()}</span></div>
  <div class="hr"></div>
  <h2>Summary</h2>
  ${summaryRows}
  <h2>Orders by Status</h2>
  ${breakdownRows || "<div class='muted'>No orders in period</div>"}
  <h2>Orders (${orders?.length || 0})</h2>
  ${orderRows || "<div class='muted'>No orders in period</div>"}
  <div class="footer">
    ${storeName} — generated from the admin sales report.
  </div>
  <script>
    window.onload = function () { window.print(); };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=860,height=640");
  if (!win) {
    alert("Please allow pop-ups to print the sales report.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
