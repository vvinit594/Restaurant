import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminDashboardStats } from '../services/adminStats';
import StatCard from './components/StatCard';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getAdminDashboardStats();
        if (alive) setStats(data);
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

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="admin-muted">Platform overview across all restaurants.</p>
        </div>
        <Link to="/admin/restaurants/new" className="admin-btn admin-btn-primary">
          + Add Restaurant
        </Link>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}

      <div className="admin-stats-grid">
        <StatCard label="Total Restaurants" value={stats?.totalRestaurants ?? 0} loading={loading} />
        <StatCard label="Active Restaurants" value={stats?.activeRestaurants ?? 0} loading={loading} />
        <StatCard label="Suspended Restaurants" value={stats?.suspendedRestaurants ?? 0} loading={loading} />
        <StatCard label="Total Menu Items" value={stats?.totalMenuItems ?? 0} loading={loading} />
        <StatCard label="Total QR Codes" value={stats?.totalQrCodes ?? 0} loading={loading} hint="Across all restaurants" />
      </div>

      <section className="admin-panel">
        <h2>Quick actions</h2>
        <div className="admin-quick-actions">
          <Link to="/admin/restaurants" className="admin-btn admin-btn-secondary">
            Manage Restaurants
          </Link>
          <Link to="/admin/restaurants/new" className="admin-btn admin-btn-secondary">
            Create Restaurant
          </Link>
          <Link to="/admin/qr" className="admin-btn admin-btn-ghost">
            QR Management
          </Link>
        </div>
        <p className="admin-muted admin-mt">
          Hierarchy: Super Admin → Restaurants → Menu / Tables / QR Codes
        </p>
      </section>
    </div>
  );
}
