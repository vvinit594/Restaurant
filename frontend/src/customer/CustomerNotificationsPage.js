import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../components/Loader';
import { useCustomerDevice } from './CustomerDeviceContext';
import {
  getCustomerNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/customerApi';

export default function CustomerNotificationsPage() {
  const { setUnreadCount, refreshUnread } = useCustomerDevice();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageInfo, setPageInfo] = useState({ page: 1, totalPages: 1, unreadCount: 0 });

  async function load(page = 1, nextFilter = filter) {
    setLoading(true);
    setError('');
    try {
      const data = await getCustomerNotifications({ page, limit: 20, filter: nextFilter });
      setItems(data.items || []);
      setPageInfo({
        page: data.page || 1,
        totalPages: data.totalPages || 1,
        unreadCount: data.unreadCount || 0,
      });
      setUnreadCount(Number(data.unreadCount || 0));
    } catch (err) {
      setError(err.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const onRead = async (id) => {
    try {
      const result = await markNotificationRead(id);
      setItems((rows) => rows.map((row) => (row.id === id ? { ...row, read: true } : row)));
      setUnreadCount(Number(result.unreadCount || 0));
    } catch {
      /* ignore */
    }
  };

  const onReadAll = async () => {
    const result = await markAllNotificationsRead();
    setItems((rows) => rows.map((row) => ({ ...row, read: true })));
    setUnreadCount(Number(result.unreadCount || 0));
    await refreshUnread();
  };

  return (
    <div className="customer-page">
      <header className="customer-page-head">
        <h1>Notifications</h1>
        <p>Order updates and restaurant offers for this device.</p>
      </header>
      <div className="customer-toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter notifications">
          <option value="all">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
        <button type="button" className="customer-btn ghost" onClick={onReadAll}>
          Mark all as read
        </button>
      </div>
      {error ? <p className="customer-error">{error}</p> : null}
      {loading ? (
        <Loader variant="inline" label="Loading notifications…" />
      ) : items.length === 0 ? (
        <p className="customer-empty">No notifications yet.</p>
      ) : (
        <ul className="customer-note-list">
          {items.map((row) => (
            <li key={row.id} className={`customer-card ${row.read ? '' : 'unread'}`}>
              <button type="button" className="customer-note-btn" onClick={() => onRead(row.id)}>
                <strong>{row.title}</strong>
                <span className="customer-muted">{row.restaurantName}</span>
                <p>{row.message}</p>
                <span className="customer-muted">{new Date(row.createdAt).toLocaleString('en-IN')}</span>
              </button>
              {row.couponId ? <Link to="/account/coupons">View coupon</Link> : null}
              {row.orderId ? <Link to={`/account/orders/${row.orderId}`}>View order</Link> : null}
            </li>
          ))}
        </ul>
      )}
      {pageInfo.totalPages > 1 ? (
        <div className="customer-pager">
          <button type="button" disabled={pageInfo.page <= 1} onClick={() => load(pageInfo.page - 1)}>
            Previous
          </button>
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
