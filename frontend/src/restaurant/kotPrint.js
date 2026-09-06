/**
 * KOT helpers — preview/download/print without opening about:blank tabs.
 * Reuses authenticated GET /orders/:id/kot JSON payload.
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Whether View KOT should be shown for this order. */
export function canViewKot(order) {
  if (!order) return false;
  // Backend rejects KOT for NEW and CANCELLED — match that lifecycle.
  if (order.status === 'NEW' || order.status === 'CANCELLED') return false;
  if (order.kotNumber) return true;
  return ['ACCEPTED', 'PREPARING', 'READY', 'SERVED'].includes(order.status);
}

/**
 * Build a standalone printable HTML document for the KOT.
 * @param {object} kot
 */
export function buildKotDocumentHtml(kot) {
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
    ? `<div class="rule"></div><div><strong>NOTE</strong><div class="note">${escapeHtml(
        notes,
      ).toUpperCase()}</div></div>`
    : '';

  return `<!DOCTYPE html>
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
    .rule { border-top: 1px dashed #000; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 2px 0; vertical-align: top; }
    th { font-size: 12px; }
    .qty { width: 42px; font-weight: 700; }
    .item { font-weight: 700; word-break: break-word; }
    .total { text-align: center; font-weight: 700; margin: 6px 0; }
    .rush { text-align: center; font-weight: 700; letter-spacing: 0.08em; margin-top: 8px; }
    .note { margin-top: 4px; white-space: pre-wrap; font-weight: 700; }
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
  </div>
</body>
</html>`;
}

/**
 * Trigger a real file download (no new tab / about:blank).
 * @param {object} kot
 */
export function downloadKotFile(kot) {
  if (!kot?.kotNumber) {
    throw new Error('KOT is not available for this order.');
  }
  const html = buildKotDocumentHtml(kot);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `KOT-${kot.kotNumber}.html`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Print only the KOT via a hidden iframe (does not print the portal UI).
 * @param {object} kot
 */
export function printKotDocument(kot) {
  if (!kot?.kotNumber) {
    throw new Error('KOT is not available for this order.');
  }
  const html = buildKotDocumentHtml(kot);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', `KOT ${kot.kotNumber}`);
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!doc || !win) {
    iframe.remove();
    throw new Error('Could not open print preview for KOT.');
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    window.setTimeout(() => {
      try {
        iframe.remove();
      } catch {
        /* ignore */
      }
    }, 500);
  };

  const trigger = () => {
    try {
      win.focus();
      win.print();
    } finally {
      cleanup();
    }
  };

  // Allow layout to settle before print.
  window.setTimeout(trigger, 200);
}
