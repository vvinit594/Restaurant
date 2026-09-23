import React, { useEffect, useState } from 'react';
import Loader from '../components/Loader';
import { getSalesCommission } from '../services/salesApi';
import { formatInr } from './formatInr';

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

  const rows = Array.isArray(data?.breakdown) ? data.breakdown : [];
  const rules = Array.isArray(data?.rules) ? data.rules : [];

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Commission</h1>
          <p className="admin-muted">
            Earned from the restaurants you have added. Totals are calculated on the server.
          </p>
        </div>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
      {loading ? <Loader label="Loading commission…" /> : null}

      {!loading && data ? (
        <>
          <div className="sales-metrics-grid">
            <div className="sales-metric-card sales-metric-accent">
              <span className="sales-metric-label">Commission Earned</span>
              <strong className="sales-metric-value">{formatInr(data.totalCommission)}</strong>
            </div>
            <div className="sales-metric-card">
              <span className="sales-metric-label">Restaurants Added</span>
              <strong className="sales-metric-value">{data.restaurantCount ?? 0}</strong>
            </div>
            <div className="sales-metric-card">
              <span className="sales-metric-label">Current Tier</span>
              <strong className="sales-metric-value sales-metric-text">{data.currentTier}</strong>
            </div>
            <div className="sales-metric-card">
              <span className="sales-metric-label">Additional Restaurant Rate</span>
              <strong className="sales-metric-value sales-metric-text">
                {formatInr(data.additionalRestaurantRate)} / restaurant
              </strong>
            </div>
          </div>

          <div className="sales-dash-grid">
            <section className="admin-panel">
              <h2>Commission rules</h2>
              <ul className="sales-plan-list">
                {rules.map((rule) => (
                  <li key={rule.label}>
                    <span>{rule.label}</span>
                    <strong>
                      {rule.additionalRate != null
                        ? `+${formatInr(rule.additionalRate)} per additional restaurant`
                        : formatInr(rule.totalCommission)}
                    </strong>
                  </li>
                ))}
              </ul>
              <p className="admin-muted" style={{ marginTop: 12 }}>
                After the 5th restaurant, each additional restaurant adds{' '}
                {formatInr(data.additionalRestaurantRate)}. These amounts are totals, not a
                multiple of the 5-restaurant tier.
              </p>
            </section>

            <section className="admin-panel">
              <h2>Commission breakdown</h2>
              {rows.length === 0 ? (
                <p className="admin-muted">No restaurants added yet. Commission earned is {formatInr(0)}.</p>
              ) : (
                <>
                  <ul className="sales-commission-breakdown">
                    {rows.map((row) => (
                      <li key={row.restaurantNumber}>
                        <span>{row.label}</span>
                        <strong>{formatInr(row.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                  <div className="sales-commission-total">
                    <span>Total earned</span>
                    <strong>{formatInr(data.totalCommission)}</strong>
                  </div>
                </>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
