import React, { useEffect, useState } from 'react';
import Loader from '../components/Loader';
import { getSalesAnalytics } from '../services/salesApi';

const RANGES = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: '3m', label: 'Last 3 Months' },
  { id: '6m', label: 'Last 6 Months' },
  { id: 'all', label: 'All Time' },
];

export default function SalesAnalyticsPage() {
  const [range, setRange] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await getSalesAnalytics(range);
        if (alive) {
          setData(d);
          setError('');
        }
      } catch (err) {
        if (alive) setError(err.message || 'Failed to load analytics.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [range]);

  const t = data?.totals || {};

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Sales Analytics</h1>
          <p className="admin-muted">Onboarding and subscription performance for your restaurants.</p>
        </div>
        <div className="sales-range-tabs">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`admin-btn ${range === r.id ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
      {loading ? <Loader label="Loading analytics…" /> : null}

      {!loading && data ? (
        <>
          <div className="sales-metrics-grid">
            <div className="sales-metric-card">
              <span className="sales-metric-label">Total Added</span>
              <strong className="sales-metric-value">{t.restaurantsAdded ?? 0}</strong>
            </div>
            <div className="sales-metric-card">
              <span className="sales-metric-label">Active</span>
              <strong className="sales-metric-value">{t.activeRestaurants ?? 0}</strong>
            </div>
            <div className="sales-metric-card">
              <span className="sales-metric-label">Inactive</span>
              <strong className="sales-metric-value">{t.inactiveRestaurants ?? 0}</strong>
            </div>
            <div className="sales-metric-card">
              <span className="sales-metric-label">Subscription Revenue</span>
              <strong className="sales-metric-value">
                ₹{Number(t.subscriptionRevenue || 0).toFixed(2)}
              </strong>
            </div>
            <div className="sales-metric-card sales-metric-accent">
              <span className="sales-metric-label">Avg / Restaurant</span>
              <strong className="sales-metric-value">
                ₹{Number(t.averageRevenuePerRestaurant || 0).toFixed(2)}
              </strong>
            </div>
          </div>

          <div className="sales-dash-grid">
            <section className="sales-panel-card">
              <h2>Plan distribution</h2>
              {(data.planBreakdown || []).length === 0 ? (
                <p className="admin-muted">No plan data yet.</p>
              ) : (
                <ul className="sales-plan-list">
                  {data.planBreakdown.map((p) => (
                    <li key={p.plan}>
                      <span>{p.plan}</span>
                      <strong>{p.count}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="sales-panel-card">
              <h2>Restaurants added over time</h2>
              {(data.restaurantsAddedOverTime || []).length === 0 ? (
                <p className="admin-muted">No activity in this range.</p>
              ) : (
                <ul className="sales-plan-list">
                  {data.restaurantsAddedOverTime.map((d) => (
                    <li key={d.date}>
                      <span>{d.date}</span>
                      <strong>{d.count}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="sales-panel-card" style={{ marginTop: 16 }}>
            <h2>Subscriptions</h2>
            {(data.subscriptions || []).length === 0 ? (
              <p className="admin-muted">No subscriptions in this range.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Restaurant</th>
                      <th>Plan</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subscriptions.map((s) => (
                      <tr key={s.restaurantId}>
                        <td>{s.restaurantName}</td>
                        <td>{s.planName || '—'}</td>
                        <td>{s.priceLabel || '—'}</td>
                        <td>{s.status || '—'}</td>
                        <td>
                          {s.startedAt ? new Date(s.startedAt).toLocaleDateString() : '—'}
                        </td>
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
