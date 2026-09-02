import React, { useCallback, useEffect, useState } from 'react';
import Loader from '../components/Loader';
import ConfirmDialog from '../admin/components/ConfirmDialog';
import { useToast } from '../admin/components/Toast';
import {
  getRestaurantOrders,
  updateRestaurantOrderStatus,
} from '../services/ordersApi';

const NEXT = {
  NEW: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'SERVED',
  SERVED: 'COMPLETED',
};

const NEXT_LABEL = {
  NEW: 'Accept Order',
  ACCEPTED: 'Start Preparing',
  PREPARING: 'Mark Ready',
  READY: 'Mark Served',
  SERVED: 'Complete',
};

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function RestaurantLiveOrdersPage() {
  const { push } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const rows = await getRestaurantOrders({ active: true, take: 80 });
      setOrders(Array.isArray(rows) ? rows : []);
      setError('');
    } catch (err) {
      if (!silent) setError(err.message || 'Failed to load orders.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const id = window.setInterval(() => load(true), 4000);
    return () => window.clearInterval(id);
  }, [load]);

  const advance = async (order) => {
    const next = NEXT[order.status];
    if (!next) return;
    setBusyId(order.id);
    try {
      const updated = await updateRestaurantOrderStatus(order.id, next);
      setOrders((prev) =>
        prev
          .map((o) => (o.id === updated.id ? updated : o))
          .filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status)),
      );
      push(`Order #${updated.orderNumber} → ${updated.status}`);
    } catch (err) {
      push(err.message || 'Status update failed.', 'error');
    } finally {
      setBusyId('');
    }
  };

  const cancel = async () => {
    if (!cancelTarget) return;
    setBusyId(cancelTarget.id);
    try {
      await updateRestaurantOrderStatus(cancelTarget.id, 'CANCELLED');
      setOrders((prev) => prev.filter((o) => o.id !== cancelTarget.id));
      push(`Order #${cancelTarget.orderNumber} cancelled.`);
      setCancelTarget(null);
    } catch (err) {
      push(err.message || 'Cancel failed.', 'error');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Live Orders</h1>
          <p className="admin-muted">Updates every few seconds — no refresh needed.</p>
        </div>
        <button type="button" className="admin-btn admin-btn-secondary" onClick={() => load(false)}>
          Refresh
        </button>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
      {loading ? <Loader label="Loading live orders…" /> : null}

      {!loading && orders.length === 0 ? (
        <div className="admin-empty">
          <h3>No active orders</h3>
          <p>New customer orders will appear here automatically.</p>
        </div>
      ) : null}

      <div className="order-portal-grid">
        {orders.map((order) => (
          <article key={order.id} className="order-portal-card">
            <header>
              <div>
                <strong>Order #{order.orderNumber}</strong>
                <div className="admin-muted">
                  Table {order.tableNumber} · {formatTime(order.placedAt || order.createdAt)}
                </div>
              </div>
              <span className={`admin-badge ${order.status === 'NEW' ? 'admin-badge-active' : 'admin-badge-suspended'}`}>
                {order.status}
              </span>
            </header>
            <ul>
              {order.items.map((i) => (
                <li key={i.id}>
                  {i.quantity} × {i.name}
                </li>
              ))}
            </ul>
            <div className="order-portal-total">Total: ₹{order.total}</div>
            <div className="order-portal-actions">
              {NEXT[order.status] ? (
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  disabled={busyId === order.id}
                  onClick={() => advance(order)}
                >
                  {busyId === order.id ? 'Updating…' : NEXT_LABEL[order.status]}
                </button>
              ) : null}
              {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' ? (
                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  disabled={busyId === order.id}
                  onClick={() => setCancelTarget(order)}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel order?"
        message={
          cancelTarget
            ? `Cancel order #${cancelTarget.orderNumber} for table ${cancelTarget.tableNumber}?`
            : ''
        }
        confirmLabel="Cancel Order"
        danger
        loading={Boolean(busyId)}
        onCancel={() => setCancelTarget(null)}
        onConfirm={cancel}
      />
    </div>
  );
}
