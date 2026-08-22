import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRestaurantDashboardStats } from '../services/restaurantMenuApi';
import { useRestaurantAuth } from './auth/RestaurantAuthContext';
import StatCard from '../admin/components/StatCard';

export default function RestaurantDashboard() {
  const { user, permissions } = useRestaurantAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getRestaurantDashboardStats();
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
          <p className="admin-muted">
            {user?.restaurantName} · {user?.role?.replace('RESTAURANT_', '')}
          </p>
        </div>
        {permissions?.addDish ? (
          <Link to="/restaurant/menu/add" className="admin-btn admin-btn-primary">
            + Add Dish
          </Link>
        ) : null}
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}

      <div className="admin-stats-grid">
        <StatCard label="Total Dishes" value={stats?.totalDishes ?? 0} loading={loading} />
        <StatCard label="Available" value={stats?.availableDishes ?? 0} loading={loading} />
        <StatCard label="Unavailable" value={stats?.unavailableDishes ?? 0} loading={loading} />
        <StatCard label="Categories" value={stats?.categories ?? 0} loading={loading} />
        <StatCard label="Tables" value={stats?.tables ?? 0} loading={loading} />
        <StatCard label="Active QR Codes" value={stats?.activeQrCodes ?? 0} loading={loading} />
      </div>

      <section className="admin-panel">
        <h2>Quick actions</h2>
        <div className="admin-quick-actions">
          {permissions?.viewMenu ? (
            <Link to="/restaurant/menu" className="admin-btn admin-btn-secondary">
              Manage Menu
            </Link>
          ) : null}
          {permissions?.addDish ? (
            <Link to="/restaurant/menu/add" className="admin-btn admin-btn-secondary">
              Add Dish
            </Link>
          ) : null}
          {permissions?.manageQr ? (
            <Link to="/restaurant/qr" className="admin-btn admin-btn-ghost">
              QR Codes
            </Link>
          ) : null}
        </div>
        <p className="admin-muted admin-mt">
          All menu changes apply only to <strong>{user?.restaurantName}</strong>.
        </p>
      </section>
    </div>
  );
}
