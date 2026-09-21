import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Loader from './Loader';
import { getPublicRestaurantTables, placePublicOrder } from '../services/ordersApi';

/**
 * Checkout flow: select table → confirm summary → place order.
 */
export default function OrderCheckoutModal({
  open,
  restaurantName,
  restaurantSlug,
  items,
  onClose,
  onSuccess,
}) {
  const [step, setStep] = useState('table'); // table | confirm | success
  const [tables, setTables] = useState([]);
  const [tableId, setTableId] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [loadingTables, setLoadingTables] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState(null);

  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.price) * Number(i.quantity),
    0,
  );
  const selectedTable = tables.find((t) => t.id === tableId);

  useEffect(() => {
    if (!open) return undefined;
    setStep('table');
    setError('');
    setPlaced(null);
    setTableId('');
    setCouponCode('');
    let alive = true;
    (async () => {
      setLoadingTables(true);
      try {
        const data = await getPublicRestaurantTables(restaurantSlug);
        if (alive) setTables(data.tables || []);
      } catch (err) {
        if (alive) setError(err.message || 'Could not load tables.');
      } finally {
        if (alive) setLoadingTables(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, restaurantSlug]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, submitting]);

  if (!open) return null;

  const goConfirm = () => {
    if (!tableId) {
      setError('Please select a table number.');
      return;
    }
    setError('');
    setStep('confirm');
  };

  const confirmOrder = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `ord_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const order = await placePublicOrder(restaurantSlug, {
        tableId,
        idempotencyKey,
        couponCode: couponCode.trim() || undefined,
        items: items.map((i) => ({
          dishId: i.dishId,
          quantity: i.quantity,
        })),
      });
      setPlaced(order);
      setStep('success');
      onSuccess?.(order);
    } catch (err) {
      setError(err.message || 'Could not place order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="order-cart-overlay" onClick={() => !submitting && onClose()} role="presentation">
      <div
        className="order-checkout-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Checkout"
      >
        <button
          type="button"
          className="dish-modal-close"
          onClick={() => !submitting && onClose()}
          aria-label="Close"
          disabled={submitting}
        >
          ×
        </button>

        {step === 'table' ? (
          <>
            <h3>Select Table</h3>
            <p className="order-cart-rest">{restaurantName}</p>
            {loadingTables ? <Loader variant="inline" label="Loading tables…" /> : null}
            {error ? <div className="order-error">{error}</div> : null}
            <div className="order-table-grid">
              {tables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`order-table-chip ${tableId === t.id ? 'active' : ''}`}
                  onClick={() => setTableId(t.id)}
                >
                  Table {t.label}
                </button>
              ))}
            </div>
            <div className="order-checkout-actions">
              <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>
                Back
              </button>
              <button type="button" className="admin-btn admin-btn-primary" onClick={goConfirm} disabled={!tableId}>
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === 'confirm' ? (
          <>
            <h3>Confirm Order</h3>
            <p className="order-cart-rest">
              Restaurant: <strong>{restaurantName}</strong>
              <br />
              Table: <strong>{selectedTable?.label}</strong>
            </p>
            <ul className="order-summary-list">
              {items.map((i) => (
                <li key={i.dishId}>
                  <span>
                    {i.name} × {i.quantity}
                  </span>
                  <strong>₹{Number(i.price) * i.quantity}</strong>
                </li>
              ))}
            </ul>
            <div className="order-cart-total">
              <span>Total</span>
              <strong>₹{subtotal}</strong>
            </div>
            <label className="order-coupon-field">
              Coupon code
              <input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Optional"
                disabled={submitting}
              />
            </label>
            {error ? <div className="order-error">{error}</div> : null}
            <div className="order-checkout-actions">
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => setStep('table')}
                disabled={submitting}
              >
                Back
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={confirmOrder}
                disabled={submitting}
              >
                {submitting ? 'Placing…' : 'Confirm Order'}
              </button>
            </div>
          </>
        ) : null}

        {step === 'success' && placed ? (
          <>
            <h3>Order placed successfully</h3>
            <div className="order-success-card">
              <p>
                Order <strong>#{placed.orderNumber}</strong>
              </p>
              <p>Table {placed.tableNumber || placed.tableLabel}</p>
              <p className="order-cart-rest">Your order has been sent to the restaurant.</p>
            </div>
            <div className="order-checkout-actions">
              <Link to="/account/orders/live" className="admin-btn admin-btn-ghost">
                Track order
              </Link>
              <button type="button" className="admin-btn admin-btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
