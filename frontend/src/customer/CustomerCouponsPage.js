import React, { useEffect, useState } from 'react';
import Loader from '../components/Loader';
import { getCustomerCoupons } from '../services/customerApi';

export default function CustomerCouponsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getCustomerCoupons({ limit: 50 });
        if (alive) setItems(data.items || []);
      } catch (err) {
        if (alive) setError(err.message || 'Could not load coupons.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      setCopied('');
    }
  };

  const discountLabel = (row) =>
    row.discountType === 'PERCENT'
      ? `${Number(row.discountValue)}% off`
      : `₹${Number(row.discountValue).toFixed(0)} off`;

  return (
    <div className="customer-page">
      <header className="customer-page-head">
        <h1>Coupons & offers</h1>
        <p>Offers sent to this device. Copy a code at checkout.</p>
      </header>
      {error ? <p className="customer-error">{error}</p> : null}
      {loading ? (
        <Loader variant="inline" label="Loading coupons…" />
      ) : items.length === 0 ? (
        <p className="customer-empty">No coupons yet.</p>
      ) : (
        <ul className="customer-coupon-list">
          {items.map((row) => (
            <li key={row.id} className="customer-card">
              <div className="customer-card-head">
                <h2>{row.title}</h2>
                <span className={`customer-pill ${row.status.toLowerCase()}`}>{row.status}</span>
              </div>
              <p className="customer-muted">{row.restaurantName}</p>
              {row.description ? <p>{row.description}</p> : null}
              <p><strong>{discountLabel(row)}</strong></p>
              <p className="customer-code">{row.code}</p>
              {row.expiresAt ? (
                <p className="customer-muted">Expires {new Date(row.expiresAt).toLocaleDateString('en-IN')}</p>
              ) : null}
              {row.status === 'AVAILABLE' ? (
                <button type="button" className="customer-btn" onClick={() => copyCode(row.code)}>
                  {copied === row.code ? 'Copied' : 'Copy code'}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
