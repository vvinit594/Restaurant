import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../components/Loader';
import { getCustomerLiveOrders, getCustomerOrders } from '../services/customerApi';

export default function CustomerOrdersPage({ live = false }) {
  const [items, setItems] = useState([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(page = 1) {
    setLoading(true);
    setError('');
    try {
      const data = live
        ? await getCustomerLiveOrders({ page, limit: 10 })
        : await getCustomerOrders({ page, limit: 10 });
      setItems(data.items || []);
      setPageInfo({
        page: data.page || 1,
        totalPages: data.totalPages || 1,
        total: data.total || 0,
      });
    } catch (err) {
      setError(err.message || 'Could not load orders.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  return (
    <div className="customer-page">
      <header className="customer-page-head">
        <h1>{live ? 'Live orders' : 'Order history'}</h1>
        <p>
          {live
            ? 'Track food that is currently being prepared or served.'
            : 'Previous orders from this device.'}
        </p>
      </header>
      {error ? <p className="customer-error">{error}</p> : null}
      {loading ? (
        <Loader variant="inline" label="Loading orders…" />
      ) : items.length === 0 ? (
        <p className="customer-empty">{live ? 'No active orders' : 'No orders yet.'}</p>
      ) : (
        <ul className="customer-order-list">
          {items.map((order) => (
            <li key={order.id} className="customer-card">
              <Link to={`/account/orders/${order.id}`} className="customer-order-link">
                <div>
                  <strong>{order.restaurantName}</strong>
                  <div className="customer-muted">{order.orderNumber}</div>
                </div>
                <div className="customer-order-meta">
                  <span className="customer-status">{order.statusLabel}</span>
                  <span>₹{Number(order.total).toFixed(2)}</span>
                  <span>{new Date(order.placedAt).toLocaleString('en-IN')}</span>
                </div>
                <ul className="customer-item-preview">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity}× {item.name}
                    </li>
                  ))}
                </ul>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pageInfo.totalPages > 1 ? (
        <div className="customer-pager">
          <button type="button" disabled={pageInfo.page <= 1} onClick={() => load(pageInfo.page - 1)}>
            Previous
          </button>
          <span>
            Page {pageInfo.page} of {pageInfo.totalPages}
          </span>
          <button
            type="button"
            disabled={pageInfo.page >= pageInfo.totalPages}
            onClick={() => load(pageInfo.page + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
