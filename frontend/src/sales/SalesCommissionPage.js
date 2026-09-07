import React, { useEffect, useState } from 'react';
import Loader from '../components/Loader';
import { getSalesCommission } from '../services/salesApi';

export default function SalesCommissionPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await getSalesCommission();
        if (alive) {
          setData(d);
          setError('');
        }
      } catch (err) {
        if (alive) setError(err.message || 'Failed to load commission.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const s = data?.summary || {};

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Commission</h1>
          <p className="admin-muted">
            Configurable plan-based commission. Rules can be updated without rebuilding the panel.
          </p>
        </div>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
      {loading ? <Loader label="Loading commission…" /> : null}

      {!loading && data ? (
        <>
          {!data.rulesConfigured ? (
            <div className="admin-empty">
              <h3>Commission rules coming soon</h3>
              <p>
                {data.message ||
                  'Once plan commission rules are configured, earnings and history will appear here.'}
              </p>
            </div>
          ) : (
            <div className="sales-metrics-grid">
              <div className="sales-metric-card">
                <span className="sales-metric-label">Total Earned</span>
                <strong className="sales-metric-value">₹{Number(s.totalEarned || 0).toFixed(2)}</strong>
              </div>
              <div className="sales-metric-card">
                <span className="sales-metric-label">Pending</span>
                <strong className="sales-metric-value">₹{Number(s.pending || 0).toFixed(2)}</strong>
              </div>
              <div className="sales-metric-card">
                <span className="sales-metric-label">Paid</span>
                <strong className="sales-metric-value">₹{Number(s.paid || 0).toFixed(2)}</strong>
              </div>
              <div className="sales-metric-card sales-metric-accent">
                <span className="sales-metric-label">This Month</span>
                <strong className="sales-metric-value">₹{Number(s.thisMonth || 0).toFixed(2)}</strong>
              </div>
            </div>
          )}

          {data.rulesConfigured && (data.rules || []).length > 0 ? (
            <section className="sales-panel-card" style={{ marginTop: 16 }}>
              <h2>Active rules</h2>
              <ul className="sales-plan-list">
                {data.rules.map((r) => (
                  <li key={r.planCode}>
                    <span>
                      {r.planCode} ({r.type})
                    </span>
                    <strong>
                      {r.type === 'PERCENT' ? `${r.value}%` : `₹${Number(r.value).toFixed(2)}`}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="sales-panel-card" style={{ marginTop: 16 }}>
            <h2>History</h2>
            {(data.history || []).length === 0 ? (
              <p className="admin-muted">No commission records yet.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Restaurant</th>
                      <th>Plan</th>
                      <th>Commission</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((c) => (
                      <tr key={c.id}>
                        <td>{c.restaurantName}</td>
                        <td>{c.planCode}</td>
                        <td>₹{Number(c.amount).toFixed(2)}</td>
                        <td>{c.status}</td>
                        <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
