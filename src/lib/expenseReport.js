// Opens a print window with a formatted expense report for a date range.
// Shows a type-wise breakdown plus the expense ledger.

const fmtMoney = (n) => `৳${Number(n || 0).toFixed(2)}`;

export function printExpenseReport({
  from,
  to,
  typeLabel,
  expenses,
  typeBreakdown,
  site,
}) {
  const storeName = site?.store_name || "MHFood";
  const address = site?.store_address || "";
  const phone = site?.store_phone || "";

  const dateRangeText =
    from && to
      ? `${new Date(from).toLocaleDateString()} – ${new Date(to).toLocaleDateString()}`
      : "All time";
  const typeFilterText = typeLabel || "All Types";

  const total = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);

  const breakdownRows = (typeBreakdown || [])
    .map(
      (t) =>
        `<div class="row"><span>${t.name}</span><span>${t.count} · ${fmtMoney(t.total)}</span></div>`,
    )
    .join("\n");

  const expenseRows = (expenses || [])
    .map((e) => {
      const date = new Date(e.expense_date).toLocaleDateString();
      return `<div class="row order"><span>${date}</span><span>${e.expense_types?.name || "Uncategorized"}</span><span>${e.title}</span><span>${fmtMoney(e.amount)}</span></div>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Expense Report</title>
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
  .order span:nth-child(2) { width: 160px; }
  .order span:nth-child(3) { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; padding: 0 8px; }
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
  <div class="row"><span>Report</span><span>Expense Report</span></div>
  <div class="row"><span>Period</span><span>${dateRangeText}</span></div>
  <div class="row"><span>Type</span><span>${typeFilterText}</span></div>
  <div class="row"><span>Generated</span><span>${new Date().toLocaleString()}</span></div>
  <div class="hr"></div>
  <h2>Expenses by Type</h2>
  ${breakdownRows || "<div class='muted'>No expenses in period</div>"}
  <div class="total"><span>Total Expenses</span><span>${fmtMoney(total)}</span></div>
  <h2>Expenses (${expenses?.length || 0})</h2>
  ${expenseRows || "<div class='muted'>No expenses in period</div>"}
  <div class="footer">
    ${storeName} — generated from the admin expenses report.
  </div>
  <script>
    window.onload = function () { window.print(); };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=860,height=640");
  if (!win) {
    alert("Please allow pop-ups to print the expense report.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
