/**
 * PDF Report Generator for Ledgr Transactions
 * Uses a hidden iframe with print-optimized HTML — no external library needed,
 * produces a genuine structured report (not a page screenshot).
 *
 * Security: all data is passed in from the calling component which already
 * fetched it with authenticated Supabase queries (RLS-enforced).
 */

export function formatINRForPdf(amount) {
  if (amount == null || isNaN(amount)) return '₹0'
  const num = Math.abs(Number(amount))
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(num)
}

function formatDateForPdf(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}

function typeLabel(type) {
  return { expense: 'Expense', income: 'Income', transfer: 'Transfer' }[type] || type
}

function typeColor(type) {
  return { expense: '#dc2626', income: '#16a34a', transfer: '#2563eb' }[type] || '#374151'
}

/**
 * @param {Object} opts
 * @param {Array}  opts.transactions  — full list matching current filters
 * @param {string} opts.userName
 * @param {string} opts.monthLabel    — e.g. "August 2026"
 * @param {string} opts.dateRangeLabel — e.g. "01 Aug – 31 Aug 2026"
 * @param {Object} opts.summary       — { totalIncome, totalExpense, totalTransfer, count }
 * @param {string} opts.fileName      — e.g. "Ledgr-Transactions-August-2026.pdf"
 */
export function downloadTransactionPdf(opts) {
  const {
    transactions = [],
    userName = 'User',
    monthLabel = '',
    dateRangeLabel = '',
    summary = {},
    fileName = 'Ledgr-Transactions.pdf',
  } = opts

  const now = new Date()
  const generatedOn = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    + ' at ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const net = (summary.totalIncome || 0) - (summary.totalExpense || 0)

  /* ── Build transaction rows ── */
  const rows = transactions.map((tx, i) => {
    const bgColor = i % 2 === 0 ? '#ffffff' : '#f9fafb'
    const catName = tx.categories?.name || tx.category_name || '—'
    const party = tx.party || '—'
    const note = tx.notes || '—'
    const amount = Number(tx.amount || 0)
    const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''
    const color = typeColor(tx.type)

    return `
      <tr style="background:${bgColor}">
        <td>${formatDateForPdf(tx.transaction_date)}</td>
        <td><span style="color:${color};font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">${typeLabel(tx.type)}</span></td>
        <td>${catName}</td>
        <td>${party}</td>
        <td style="font-size:11px;color:#6b7280;max-width:120px;word-break:break-word">${note !== '—' ? note : ''}</td>
        <td style="text-align:right;font-weight:600;color:${color};white-space:nowrap">${sign}${formatINRForPdf(amount)}</td>
      </tr>`
  }).join('')

  /* ── HTML report ── */
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${fileName.replace('.pdf', '')}</title>
<style>
  @page { size: A4; margin: 20mm 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111827; line-height: 1.5; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #0f1729; }
  .logo { font-size: 24px; font-weight: 800; color: #0f1729; letter-spacing: -0.5px; }
  .logo span { color: #d4a853; }
  .report-meta { text-align: right; }
  .report-title { font-size: 16px; font-weight: 700; color: #0f1729; }
  .report-sub { font-size: 11px; color: #6b7280; margin-top: 3px; }

  /* Summary cards */
  .summary { display: flex; gap: 12px; margin-bottom: 24px; }
  .summary-card { flex: 1; padding: 12px 14px; border: 1px solid #e5e7eb; border-radius: 8px; }
  .summary-card .label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; margin-bottom: 4px; }
  .summary-card .value { font-size: 18px; font-weight: 800; letter-spacing: -0.5px; }
  .income-val { color: #16a34a; }
  .expense-val { color: #dc2626; }
  .net-val { color: ${net >= 0 ? '#16a34a' : '#dc2626'}; }
  .neutral-val { color: #374151; }

  /* Table */
  .section-title { font-size: 13px; font-weight: 700; color: #0f1729; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  thead { background: #0f1729; color: #fff; display: table-header-group; }
  thead th { padding: 9px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  thead th:last-child { text-align: right; }
  tbody tr { border-bottom: 1px solid #f3f4f6; page-break-inside: avoid; }
  tbody td { padding: 8px 10px; vertical-align: top; }
  tbody td:last-child { text-align: right; }

  /* Totals row */
  .totals-row td { font-weight: 700; border-top: 2px solid #0f1729; padding-top: 10px; background: #f9fafb; }
  
  /* Footer */
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #9ca3af; }

  /* Empty state */
  .empty { text-align: center; padding: 40px; color: #6b7280; font-size: 14px; }

  @media print {
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="logo">Le<span>d</span>gr</div>
    <div style="font-size:11px;color:#6b7280;margin-top:3px">Personal Finance</div>
  </div>
  <div class="report-meta">
    <div class="report-title">Transaction Report</div>
    <div class="report-sub">${dateRangeLabel || monthLabel}</div>
    <div class="report-sub">${userName}</div>
    <div class="report-sub">Generated ${generatedOn}</div>
  </div>
</div>

${transactions.length === 0 ? '<div class="empty">No transactions available for the selected period.</div>' : `
<div class="summary">
  <div class="summary-card">
    <div class="label">Income</div>
    <div class="value income-val">${formatINRForPdf(summary.totalIncome)}</div>
  </div>
  <div class="summary-card">
    <div class="label">Expenses</div>
    <div class="value expense-val">${formatINRForPdf(summary.totalExpense)}</div>
  </div>
  <div class="summary-card">
    <div class="label">Net Cash Flow</div>
    <div class="value net-val">${net >= 0 ? '+' : '-'}${formatINRForPdf(Math.abs(net))}</div>
  </div>
  <div class="summary-card">
    <div class="label">Transactions</div>
    <div class="value neutral-val">${summary.count || transactions.length}</div>
  </div>
</div>

<div class="section-title">Transactions (${transactions.length})</div>
<table>
  <thead>
    <tr>
      <th style="width:90px">Date</th>
      <th style="width:70px">Type</th>
      <th style="width:100px">Category</th>
      <th style="width:120px">Merchant</th>
      <th>Note</th>
      <th style="width:90px;text-align:right">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="totals-row">
      <td colspan="5" style="text-align:right;padding-right:12px">Total (${transactions.length} transactions)</td>
      <td style="text-align:right">${formatINRForPdf(summary.totalIncome - summary.totalExpense >= 0 ? summary.totalIncome - summary.totalExpense : -(summary.totalExpense - summary.totalIncome))}</td>
    </tr>
  </tbody>
</table>
`}

<div class="footer">
  <span>Ledgr · Personal Finance</span>
  <span>Confidential — ${userName}</span>
</div>

</body>
</html>`

  /* ── Open a new window and trigger print-to-PDF ── */
  const win = window.open('', '_blank', 'width=900,height=700,scrollbars=yes')
  if (!win) { alert('Please allow popups to download the PDF report.'); return }

  win.document.open()
  win.document.write(html)
  win.document.close()

  // Wait for images/fonts then print
  win.onload = () => {
    // Suggest the filename via document.title (some browsers use it)
    win.document.title = fileName.replace('.pdf', '')
    setTimeout(() => {
      win.focus()
      win.print()
    }, 400)
  }
}
