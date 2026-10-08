import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { placePublicOrder } from '../services/ordersApi';

/**
 * A table number is a positive integer. Leading zeros are ignored.
 * Returns the normalized number when valid.
 */
export function parseTableNumber(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return { valid: false, empty: true, number: '' };
  if (!/^\d+$/.test(value)) return { valid: false, empty: false, number: '' };
  const number = String(Number(value));
  if (!/^[1-9]\d{0,11}$/.test(number)) return { valid: false, empty: false, number: '' };
  return { valid: true, empty: false, number };
}

/**
 * Checkout flow: enter table number → confirm summary → place order.
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
  const [tableInput, setTableInput] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState(null);

  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.price) * Number(i.quantity),
    0,
  );
  const parsedTable = parseTableNumber(tableInput);

  useEffect(() => {
    if (!open) return undefined;
    setStep('table');
    setError('');
    setPlaced(null);
    setTableInput('');
    setTableNumber('');
    setCouponCode('');
    return undefined;
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
    if (!parsedTable.valid) return;
    setTableNumber(parsedTable.number);
    setError('');
    setStep('confirm');
  };

  const confirmOrder = async () => {
    if (submitting || !tableNumber) return;
    setSubmitting(true);
    setError('');
    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `ord_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const order = await placePublicOrder(restaurantSlug, {
        tableNumber,
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
    <div
      className="order-cart-overlay order-checkout-overlay"
      onClick={() => !submitting && onClose()}
      role="presentation"
    >
      <div
        className="order-checkout-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
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
            <h3 id="checkout-title">Select Table</h3>
            <p className="order-cart-rest">{restaurantName}</p>
            <label className="order-table-field" htmlFor="table-number">
              Table Number
              <input
                id="table-number"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                enterKeyHint="done"
                placeholder="Enter table number"
                value={tableInput}
                onChange={(e) => setTableInput(e.target.value)}
                aria-invalid={parsedTable.empty ? undefined : !parsedTable.valid}
                aria-describedby={
                  !parsedTable.empty && !parsedTable.valid ? 'table-number-error' : undefined
                }
              />
            </label>
            {!parsedTable.empty && !parsedTable.valid ? (
              <p id="table-number-error" className="order-table-hint" role="alert">
                Please enter a valid table number.
              </p>
            ) : null}
            {error ? <div className="order-error">{error}</div> : null}
            <div className="order-checkout-actions">
              <button type="button" className="order-btn order-btn-secondary" onClick={onClose}>
                Back
              </button>
              <button
                type="button"
                className="order-btn order-btn-primary"
                onClick={goConfirm}
                disabled={!parsedTable.valid}
              >
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === 'confirm' ? (
          <>
            <h3 id="checkout-title">Confirm Order</h3>
            <p className="order-cart-rest">
              Restaurant: <strong>{restaurantName}</strong>
              <br />
              Table: <strong>{tableNumber}</strong>
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
                className="order-btn order-btn-secondary"
                onClick={() => setStep('table')}
                disabled={submitting}
              >
                Back
              </button>
              <button
                type="button"
                className="order-btn order-btn-primary"
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
            <h3 id="checkout-title">Order placed successfully</h3>
            <div className="order-success-card">
              <p>
                Order <strong>#{placed.orderNumber}</strong>
              </p>
              <p>Table {placed.tableNumber || placed.tableLabel}</p>
              <p className="order-cart-rest">Your order has been sent to the restaurant.</p>
            </div>
            <div className="order-checkout-actions">
              <Link to="/account/orders/live" className="order-btn order-btn-secondary">
                Track order
              </Link>
              <button type="button" className="order-btn order-btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
