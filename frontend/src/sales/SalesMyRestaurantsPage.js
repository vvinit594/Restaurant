import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../components/Loader';
import { getSalesRestaurants } from '../services/salesApi';

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso || '';
  }
}

export default function SalesMyRestaurantsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getSalesRestaurants();
        if (alive) {
          setRows(Array.isArray(data) ? data : []);
          setError('');
        }
      } catch (err) {
        if (alive) setError(err.message || 'Failed to load restaurants.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>My Restaurants</h1>
          <p className="admin-muted">Restaurants you onboarded — view only.</p>
        </div>
        <Link to="/sales/restaurants/add" className="admin-btn admin-btn-primary">
          Add Restaurant
        </Link>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
      {loading ? <Loader label="Loading restaurants…" /> : null}

      {!loading && rows.length === 0 ? (
        <div className="admin-empty">
          <h3>No restaurants added yet</h3>
          <p>Add your first restaurant to start tracking sales.</p>
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                    <div className="admin-muted">{r.city}</div>
                  </td>
                  <td>
                    {r.subscription?.planName || '—'}
                    {r.subscription?.priceLabel ? (
                      <div className="admin-muted">{r.subscription.priceLabel}</div>
                    ) : null}
                  </td>
                  <td>
                    <span className="admin-badge">{r.status}</span>
                  </td>
                  <td>{formatWhen(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
