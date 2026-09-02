import React, { useCallback, useEffect, useState } from 'react';
import Loader from '../components/Loader';
import { getRestaurantOrder, getRestaurantOrders } from '../services/ordersApi';

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || '';
  }
}

export default function RestaurantOrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bill, setBill] = useState(null);
  const [billLoading, setBillLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await getRestaurantOrders({ history: true, take: 100 });
      setOrders(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message || 'Failed to load order history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openBill = async (orderId) => {
    setBillLoading(true);
    try {
      const full = await getRestaurantOrder(orderId);
      setBill(full);
    } catch (err) {
      setError(err.message || 'Could not load bill.');
    } finally {
      setBillLoading(false);
    }
  };

  const printBill = () => {
    window.print();
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Order History</h1>
          <p className="admin-muted">Completed and cancelled orders with bills.</p>
        </div>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
      {loading ? <Loader label="Loading history…" /> : null}

      {!loading && orders.length === 0 ? (
        <div className="admin-empty">
          <h3>No history yet</h3>
          <p>Completed orders will show up here.</p>
        </div>
      ) : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Table</th>
              <th>Status</th>
              <th>Total</th>
              <th>When</th>
              <th>Bill</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>#{o.orderNumber}</td>
                <td>{o.tableNumber}</td>
                <td>{o.status}</td>
                <td>₹{o.total}</td>
                <td>{formatWhen(o.completedAt || o.cancelledAt || o.createdAt)}</td>
                <td>
                  <button
                    type="button"
                    className="admin-link-btn"
                    onClick={() => openBill(o.id)}
                    disabled={billLoading}
                  >
                    View bill
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bill ? (
        <div className="order-cart-overlay" onClick={() => setBill(null)} role="presentation">
          <div
            className="order-checkout-modal order-bill-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button type="button" className="dish-modal-close" onClick={() => setBill(null)}>
              ×
            </button>
            <div className="order-bill-print">
              <h3>{bill.restaurantName}</h3>
              {(bill.restaurantAddress || bill.restaurantCity) ? (
                <p className="admin-muted">
                  {[bill.restaurantAddress, bill.restaurantCity].filter(Boolean).join(', ')}
                </p>
              ) : null}
              {bill.restaurantPhone ? (
                <p className="admin-muted">{bill.restaurantPhone}</p>
              ) : null}
              <hr />
              <p>
                Order #{bill.orderNumber}
                <br />
                Table {bill.tableNumber}
                <br />
                {formatWhen(bill.placedAt)}
              </p>
              <table className="order-bill-table">
                <thead>
                  <tr>
                    <th>Dish</th>
                    <th>Qty</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {(bill.bill?.lines || bill.items).map((line) => (
                    <tr key={line.id || `${line.name}-${line.quantity}`}>
                      <td>{line.name || line.dishNameSnapshot}</td>
                      <td>{line.quantity}</td>
                      <td>₹{line.lineTotal ?? line.itemTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="order-cart-total">
                <span>Subtotal</span>
                <strong>₹{bill.subtotal}</strong>
              </div>
              <div className="order-cart-total">
                <span>Total</span>
                <strong>₹{bill.total}</strong>
              </div>
            </div>
            <div className="order-checkout-actions">
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setBill(null)}>
                Close
              </button>
              <button type="button" className="admin-btn admin-btn-primary" onClick={printBill}>
                Print bill
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
