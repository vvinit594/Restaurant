/**
 * Dedicated restaurant bill / tax invoice print helpers.
 * Prints ONLY the bill via a hidden iframe — never the Order History page.
 * Uses authoritative order totals from the API (no invented tax/payment).
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format currency consistently for the receipt. */
export function formatBillMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₹0.00';
  return `₹${n.toFixed(2)}`;
}

function formatBillDateTime(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso || '';
  }
}

function buildAddressLines(order) {
  const lines = [];
  const address = String(order.restaurantAddress || '').trim();
  if (address) lines.push(address);

  const cityLine = [order.restaurantCity, order.restaurantState, order.restaurantPincode]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(', ');
  if (cityLine) lines.push(cityLine);

  return lines;
}

function getBillLines(order) {
  if (Array.isArray(order?.bill?.lines) && order.bill.lines.length) {
    return order.bill.lines.map((line) => ({
      name: line.name || line.dishNameSnapshot || '',
      quantity: Number(line.quantity) || 0,
      unitPrice: Number(line.unitPrice ?? line.unitPriceSnapshot) || 0,
      lineTotal: Number(line.lineTotal ?? line.itemTotal) || 0,
    }));
  }
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.map((i) => ({
    name: i.name || i.dishNameSnapshot || '',
    quantity: Number(i.quantity) || 0,
    unitPrice: Number(i.unitPrice ?? i.unitPriceSnapshot) || 0,
    lineTotal: Number(i.itemTotal ?? i.lineTotal) || 0,
  }));
}

/**
 * Build a standalone printable HTML tax invoice for one order.
 * @param {object} order — restaurant order DTO from getRestaurantOrder
 */
export function buildBillDocumentHtml(order) {
  const restaurantName = String(order.restaurantName || 'Restaurant').trim();
  const phone = String(order.restaurantPhone || '').trim();
  const logoUrl = String(order.restaurantLogoUrl || '').trim();
  const addressLines = buildAddressLines(order);
  const lines = getBillLines(order);

  const subtotal = Number(order.subtotal ?? order.bill?.subtotal) || 0;
  const taxAmount = Number(order.taxAmount ?? order.bill?.taxAmount) || 0;
  const discountAmount = Number(order.discountAmount ?? order.bill?.discountAmount) || 0;
  const serviceCharge = Number(order.serviceCharge ?? order.bill?.serviceCharge) || 0;
  const total = Number(order.total ?? order.bill?.total) || 0;

  const itemRows = lines
    .map((line) => {
      const amount =
        Number.isFinite(line.lineTotal) && line.lineTotal > 0
          ? line.lineTotal
          : line.quantity * line.unitPrice;
      return `<tr>
        <td class="item">${escapeHtml(line.name)}</td>
        <td class="num">${escapeHtml(line.quantity)}</td>
        <td class="num">${escapeHtml(formatBillMoney(line.unitPrice))}</td>
        <td class="num">${escapeHtml(formatBillMoney(amount))}</td>
      </tr>`;
    })
    .join('');

  const addressHtml = addressLines
    .map((l) => `<div class="addr">${escapeHtml(l)}</div>`)
    .join('');

  const restaurantLogoHtml = logoUrl
    ? `<div class="center"><img class="rest-logo" src="${escapeHtml(logoUrl)}" alt="" /></div>`
    : '';

  // Platform branding already used in the product (hero logo + alt tagline).
  const platformLogoSrc =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/dilyum-logo.png`
      : '/dilyum-logo.png';

  const taxBlock =
    taxAmount > 0
      ? `<div class="totals-row"><span>Tax</span><span>${escapeHtml(
          formatBillMoney(taxAmount),
        )}</span></div>`
      : '';

  const discountBlock =
    discountAmount > 0
      ? `<div class="totals-row"><span>Discount</span><span>-${escapeHtml(
          formatBillMoney(discountAmount),
        )}</span></div>`
      : '';

  const serviceBlock =
    serviceCharge > 0
      ? `<div class="totals-row"><span>Service Charge</span><span>${escapeHtml(
          formatBillMoney(serviceCharge),
        )}</span></div>`
      : '';

  // Payment fields: omit — no payment model/fields in current schema.
  // GSTIN / FSSAI / Bill No: omit — not stored on Restaurant/Order.

  const dateTime = formatBillDateTime(order.placedAt || order.bill?.placedAt || order.createdAt);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Tax Invoice — Order #${escapeHtml(order.orderNumber)}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 8px;
      font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt { max-width: 302px; margin: 0 auto; }
    .center { text-align: center; }
    .platform-logo {
      max-width: 120px;
      max-height: 48px;
      object-fit: contain;
      margin: 0 auto 2px;
      display: block;
    }
    .tagline {
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin: 0 0 10px;
      color: #333;
    }
    .rest-logo {
      max-width: 72px;
      max-height: 72px;
      object-fit: contain;
      margin: 0 auto 6px;
      display: block;
    }
    .rest-name {
      font-size: 15px;
      font-weight: 700;
      margin: 0 0 4px;
    }
    .addr, .phone { margin: 1px 0; color: #222; font-size: 11px; }
    .rule {
      border: none;
      border-top: 1px dashed #000;
      margin: 10px 0;
    }
    .title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin: 0;
    }
    .meta { width: 100%; border-collapse: collapse; margin: 4px 0; }
    .meta td { padding: 2px 0; vertical-align: top; font-size: 11px; }
    .meta td.label { width: 42%; white-space: nowrap; }
    .meta td.sep { width: 12px; text-align: center; }
    .meta td.val { word-break: break-word; }
    table.items { width: 100%; border-collapse: collapse; }
    table.items th, table.items td {
      padding: 3px 0;
      vertical-align: top;
      font-size: 11px;
    }
    table.items th {
      font-weight: 700;
      border-bottom: 1px dashed #000;
      padding-bottom: 4px;
    }
    table.items th.item, table.items td.item { text-align: left; }
    table.items th.num, table.items td.num { text-align: right; padding-left: 6px; white-space: nowrap; }
    table.items td.item { word-break: break-word; padding-right: 4px; }
    .totals { margin-top: 8px; }
    .totals-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 11px;
      margin: 2px 0;
    }
    .grand {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      font-weight: 700;
      font-size: 14px;
      margin: 4px 0;
    }
    .thanks {
      margin: 12px 0 2px;
      font-size: 16px;
      font-weight: 700;
      font-style: italic;
    }
    .visit { margin: 0 0 8px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="center">
      <img class="platform-logo" src="${escapeHtml(platformLogoSrc)}" alt="DilYum" />
      <div class="tagline">Dil Bole Yum</div>
    </div>

    ${restaurantLogoHtml}
    <div class="center rest-name">${escapeHtml(restaurantName)}</div>
    <div class="center">
      ${addressHtml}
      ${phone ? `<div class="phone">${escapeHtml(phone)}</div>` : ''}
    </div>

    <div class="rule"></div>
    <div class="center title">Tax Invoice</div>
    <div class="rule"></div>

    <table class="meta">
      <tr>
        <td class="label">Order No</td>
        <td class="sep">:</td>
        <td class="val">#${escapeHtml(order.orderNumber)}</td>
      </tr>
      <tr>
        <td class="label">Date &amp; Time</td>
        <td class="sep">:</td>
        <td class="val">${escapeHtml(dateTime)}</td>
      </tr>
      <tr>
        <td class="label">Table No.</td>
        <td class="sep">:</td>
        <td class="val">${escapeHtml(order.tableNumber || order.tableLabel || '')}</td>
      </tr>
      <tr>
        <td class="label">Dine In</td>
        <td class="sep">:</td>
        <td class="val">Yes</td>
      </tr>
    </table>

    <div class="rule"></div>

    <table class="items">
      <thead>
        <tr>
          <th class="item">Item</th>
          <th class="num">Qty</th>
          <th class="num">Rate</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || '<tr><td colspan="4">No items</td></tr>'}
      </tbody>
    </table>

    <div class="rule"></div>

    <div class="totals">
      <div class="totals-row"><span>Sub Total</span><span>${escapeHtml(
        formatBillMoney(subtotal),
      )}</span></div>
      ${discountBlock}
      ${serviceBlock}
      ${taxBlock}
    </div>

    <div class="rule"></div>

    <div class="grand">
      <span>TOTAL AMOUNT</span>
      <span>${escapeHtml(formatBillMoney(total))}</span>
    </div>

    <div class="rule"></div>

    <div class="center thanks">Thank You!</div>
    <div class="center visit">Visit Again!</div>
  </div>
</body>
</html>`;
}

/**
 * Open the browser print dialog for ONLY the bill (hidden iframe).
 * @param {object} order
 */
export function printBillDocument(order) {
  if (!order?.orderNumber) {
    throw new Error('Bill data is not available for this order.');
  }

  const html = buildBillDocumentHtml(order);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', `Bill ${order.orderNumber}`);
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
    throw new Error('Could not open print preview for bill.');
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
    }, 800);
  };

  const trigger = () => {
    try {
      win.focus();
      win.print();
    } finally {
      cleanup();
    }
  };

  // Wait briefly so images (platform/restaurant logos) can start loading.
  window.setTimeout(trigger, 350);
}
