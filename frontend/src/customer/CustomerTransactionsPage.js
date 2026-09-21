import React, { useEffect, useState } from 'react';
import Loader from '../components/Loader';
import { getCustomerTransactions } from '../services/customerApi';

export default function CustomerTransactionsPage() {
  const [items, setItems] = useState([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(page = 1) {
    setLoading(true);
    setError('');
    try {
      const data = await getCustomerTransactions({ page, limit: 15 });
      setItems(data.items || []);
      setPageInfo({ page: data.page || 1, totalPages: data.totalPages || 1 });
    } catch (err) {
      setError(err.message || 'Could not load transactions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
  }, []);

  return (
    <div className="customer-page">
      <header className="customer-page-head">
        <h1>Transactions</h1>
        <p>Food order payments recorded for this device. Card and UPI secrets are never stored.</p>
      </header>
      {error ? <p className="customer-error">{error}</p> : null}
      {loading ? (
        <Loader variant="inline" label="Loading transactions…" />
      ) : items.length === 0 ? (
        <p className="customer-empty">No transactions yet.</p>
      ) : (
        <div className="customer-table-wrap">
          <table className="customer-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Restaurant</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>{row.orderNumber}</td>
                  <td>{row.restaurantName}</td>
                  <td>₹{Number(row.amount).toFixed(2)}</td>
                  <td>{row.paymentStatus}</td>
                  <td>{new Date(row.date).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
