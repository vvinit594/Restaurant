/**
 * Kitchen Order Ticket — print-friendly thermal layout (HTML → browser Print / Save as PDF).
 * Matches existing bill approach (no separate PDF library).
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {object} kot — payload from GET /restaurants/me/orders/:id/kot
 */
export function openKotPrintWindow(kot) {
  if (!kot?.kotNumber) {
    throw new Error('KOT is not available for this order.');
  }

  const restaurant = String(kot.restaurantName || 'RESTAURANT').toUpperCase();
  const items = Array.isArray(kot.items) ? kot.items : [];
  const lines = items
    .map(
      (i) =>
        `<tr><td class="qty">${escapeHtml(i.quantity)}</td><td class="item">${escapeHtml(
          String(i.name || '').toUpperCase(),
        )}</td></tr>`,
    )
    .join('');
  const notes = String(kot.notes || '').trim();
  const notesBlock = notes
    ? `<div class="rule"></div><div class="section"><strong>NOTE</strong><div class="note">${escapeHtml(
        notes,
      ).toUpperCase()}</div></div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>KOT #${escapeHtml(kot.kotNumber)}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 8px;
      font-family: "Courier New", Courier, monospace;
      font-size: 13px;
      line-height: 1.35;
      color: #000;
      background: #fff;
    }
    .ticket { max-width: 302px; margin: 0 auto; }
    .center { text-align: center; }
    .brand { font-size: 15px; font-weight: 700; letter-spacing: 0.04em; }
    .kot-id { font-size: 16px; font-weight: 700; margin: 8px 0 6px; }
    .meta { text-align: left; margin: 0 0 6px; }
    .meta div { margin: 2px 0; }
    .status { font-weight: 700; margin-top: 4px; }
    .rule {
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 2px 0; vertical-align: top; }
    th { font-size: 12px; }
    .qty { width: 42px; font-weight: 700; }
    .item { font-weight: 700; }
    .total { text-align: center; font-weight: 700; margin: 6px 0; }
    .rush { text-align: center; font-weight: 700; letter-spacing: 0.08em; margin-top: 8px; }
    .note { margin-top: 4px; white-space: pre-wrap; font-weight: 700; }
    .actions {
      margin-top: 16px;
      display: flex;
      gap: 8px;
      justify-content: center;
    }
    .actions button {
      font-family: inherit;
      font-size: 13px;
      padding: 8px 14px;
      cursor: pointer;
    }
    @media print {
      .actions { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="center brand">** ${escapeHtml(restaurant)} **</div>
    <div class="center kot-id">KOT #${escapeHtml(kot.kotNumber)}</div>
    <div class="meta">
      <div>Date: ${escapeHtml(kot.dateLabel || '')}</div>
      <div>Time: ${escapeHtml(kot.timeLabel || '')}</div>
      <div>Table: ${escapeHtml(kot.tableNumber || '')}</div>
      <div>Order: #${escapeHtml(kot.orderNumber || '')}</div>
      <div class="status">STATUS: ${escapeHtml(String(kot.status || 'ACCEPTED').toUpperCase())}</div>
    </div>
    <div class="rule"></div>
    <table>
      <thead>
        <tr><th class="qty">QTY</th><th class="item">ITEM</th></tr>
      </thead>
      <tbody>
        ${lines || '<tr><td colspan="2">NO ITEMS</td></tr>'}
      </tbody>
    </table>
    <div class="rule"></div>
    <div class="total">TOTAL QTY: ${escapeHtml(kot.totalQty ?? 0)}</div>
    ${notesBlock}
    <div class="rule"></div>
    <div class="rush">PLEASE RUSH</div>
    <div class="actions">
      <button type="button" onclick="window.print()">Print / Save as PDF</button>
      <button type="button" onclick="window.close()">Close</button>
    </div>
  </div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 250);
    });
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer,width=420,height=720');
  if (!win) {
    const err = new Error('Pop-up blocked. Allow pop-ups to download/print the KOT.');
    err.code = 'POPUP_BLOCKED';
    throw err;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  try {
    win.focus();
  } catch {
    /* ignore */
  }
}
