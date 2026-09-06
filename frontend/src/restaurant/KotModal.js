import React from 'react';
import { downloadKotFile, printKotDocument } from './kotPrint';

/**
 * In-app KOT preview modal — mirrors View bill UX (overlay + modal + actions).
 */
export default function KotModal({ kot, onClose, busy = false }) {
  if (!kot) return null;

  const items = Array.isArray(kot.items) ? kot.items : [];
  const notes = String(kot.notes || '').trim();

  const onDownload = () => {
    downloadKotFile(kot);
  };

  const onPrint = () => {
    printKotDocument(kot);
  };

  return (
    <div className="order-cart-overlay" onClick={onClose} role="presentation">
      <div
        className="order-checkout-modal order-bill-modal order-kot-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`KOT ${kot.kotNumber}`}
      >
        <button type="button" className="dish-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="order-kot-preview">
          <h3>{kot.restaurantName || 'Restaurant'}</h3>
          <p className="order-kot-id">
            <strong>KOT #{kot.kotNumber}</strong>
          </p>
          <p>
            Order #{kot.orderNumber}
            <br />
            Table: {kot.tableNumber}
            <br />
            Date: {kot.dateLabel}
            <br />
            Time: {kot.timeLabel}
            <br />
            Status: {String(kot.status || '').toUpperCase()}
          </p>

          <hr className="order-kot-rule" />

          <table className="order-bill-table order-kot-table">
            <thead>
              <tr>
                <th>Qty</th>
                <th>Item</th>
              </tr>
            </thead>
            <tbody>
              {items.map((line, idx) => (
                <tr key={`${line.name}-${idx}`}>
                  <td>{line.quantity}</td>
                  <td>{line.name}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <hr className="order-kot-rule" />

          <div className="order-kot-total">TOTAL QTY: {kot.totalQty ?? 0}</div>

          {notes ? (
            <div className="order-kot-notes">
              <strong>NOTE</strong>
              <div>{notes}</div>
            </div>
          ) : null}

          <div className="order-kot-rush">PLEASE RUSH</div>
        </div>

        <div className="order-checkout-actions">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={onDownload}
            disabled={busy}
          >
            Download KOT
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={onPrint}
            disabled={busy}
          >
            Print KOT
          </button>
        </div>
      </div>
    </div>
  );
}
