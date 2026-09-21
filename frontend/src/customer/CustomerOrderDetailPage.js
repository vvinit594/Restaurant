import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Loader from '../components/Loader';
import { getCustomerOrder } from '../services/customerApi';

export default function CustomerOrderDetailPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getCustomerOrder(orderId);
        if (alive) setOrder(data);
      } catch (err) {
        if (alive) setError(err.message || 'Order not found.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId]);

  if (loading) return <Loader variant="inline" label="Loading order…" />;
  if (error || !order) {
    return (
      <div className="customer-page">
        <p className="customer-error">{error || 'Order not found.'}</p>
        <Link to="/account/orders">Back to orders</Link>
      </div>
    );
  }

  return (
    <div className="customer-page">
      <header className="customer-page-head">
        <p className="customer-muted">
          <Link to="/account/orders">Order history</Link>
        </p>
        <h1>{order.orderNumber}</h1>
        <p>{order.restaurantName} · {order.statusLabel}</p>
      </header>

      <section className="customer-card">
        <ol className="customer-timeline">
          {order.timeline.map((step) => (
            <li key={step.key} className={step.done ? 'done' : ''}>
              <span className="dot" />
              {step.label}
            </li>
          ))}
          {order.cancelled ? <li className="cancelled">Cancelled</li> : null}
        </ol>
      </section>

      <section className="customer-card">
        <h2>Items</h2>
        <ul className="customer-item-preview">
          {order.items.map((item) => (
            <li key={item.id}>
              {item.quantity}× {item.name} — ₹{Number(item.itemTotal).toFixed(2)}
            </li>
          ))}
        </ul>
        <p className="customer-total">Total ₹{Number(order.total).toFixed(2)}</p>
        <p className="customer-muted">{order.paymentStatus}</p>
        <p className="customer-muted">Placed {new Date(order.placedAt).toLocaleString('en-IN')}</p>
      </section>
    </div>
  );
}
