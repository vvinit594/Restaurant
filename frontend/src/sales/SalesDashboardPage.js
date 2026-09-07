import React, { useEffect, useState } from 'react';
import Loader from '../components/Loader';
import { getSalesDashboard } from '../services/salesApi';

function MetricCard({ label, value, accent }) {
  return (
    <div className={`sales-metric-card ${accent ? 'sales-metric-accent' : ''}`}>
      <span className="sales-metric-label">{label}</span>
      <strong className="sales-metric-value">{value}</strong>
    </div>
  );
}

function WeeklyChart({ data }) {
  const rows = Array.isArray(data) ? data : [];
  const max = Math.max(1, ...rows.map((d) => d.count || 0));
  if (!rows.length || rows.every((d) => !d.count)) {
    return (
      <div className="admin-empty sales-chart-empty">
        <p>No restaurants onboarded this week yet.</p>
      </div>
    );
  }
  return (
    <div className="sales-week-chart" role="img" aria-label="Weekly onboarding chart">
      {rows.map((d) => (
        <div key={d.day} className="sales-week-bar-wrap">
          <div
            className="sales-week-bar"
            style={{ height: `${Math.max(6, ((d.count || 0) / max) * 100)}%` }}
            title={`${d.day}: ${d.count}`}
          />
          <span>{d.day}</span>
          <em>{d.count}</em>
        </div>
      ))}
    </div>
  );
}

function formatMoney(n) {
  const v = Number(n) || 0;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toFixed(2)}`;
}

export default function SalesDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await getSalesDashboard();
        if (alive) {
          setData(d);
          setError('');
        }
      } catch (err) {
        if (alive) setError(err.message || 'Failed to load dashboard.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const m = data?.metrics || {};

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Sales Dashboard</h1>
          <p className="admin-muted">Track onboarding, commissions and referrals in one place.</p>
        </div>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
      {loading ? <Loader label="Loading dashboard…" /> : null}

      {!loading && data ? (
        <>
          <div className="sales-metrics-grid">
            <MetricCard label="Restaurants Added" value={m.restaurantsAdded ?? 0} />
            <MetricCard label="Restaurants Active" value={m.restaurantsActive ?? 0} />
            <MetricCard label="QR Codes Generated" value={m.qrCodesGenerated ?? 0} />
            <MetricCard label="Monthly Revenue" value={formatMoney(m.subscriptionRevenue)} />
            <MetricCard
              label="Commission Earned"
              value={formatMoney(m.commissionEarned)}
              accent
            />
          </div>

          <div className="sales-secondary-metrics">
            <span>This week: <strong>{m.restaurantsAddedThisWeek ?? 0}</strong></span>
            <span>This month: <strong>{m.restaurantsAddedThisMonth ?? 0}</strong></span>
            <span>Active subscriptions: <strong>{m.activeSubscriptions ?? 0}</strong></span>
            <span>Pending: <strong>{m.restaurantsPending ?? 0}</strong></span>
          </div>

          <div className="sales-dash-grid">
            <section className="admin-panel">
              <h2>Weekly Performance</h2>
              <p className="admin-muted">Restaurants onboarded per day.</p>
              <WeeklyChart data={data.weeklyPerformance} />
            </section>

            <section className="admin-panel">
              <h2>Commission</h2>
              {data.commissionRulesConfigured ? (
                <>
                  <p className="admin-muted">Earned from configured plan rules.</p>
                  <div className="sales-commission-hero">{formatMoney(m.commissionEarned)}</div>
                  <p className="admin-muted">Total commission (non-cancelled).</p>
                </>
              ) : (
                <div className="admin-empty">
                  <h3>Commission rules coming soon</h3>
                  <p>Slot tiers and plan commissions will appear here once configured.</p>
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
