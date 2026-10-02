import React, { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';
import { useSalesAuth } from './auth/SalesAuthContext';
import '../admin/admin.css';

const NAV = [
  { to: '/sales/dashboard', label: 'Dashboard', end: true },
  { to: '/sales/restaurants/add', label: 'Add Restaurant' },
  { to: '/sales/leads', label: 'Restaurant Leads' },
  { to: '/sales/restaurants', label: 'My Restaurants', end: true },
  { to: '/sales/qr-management', label: 'QR Management' },
  { to: '/sales/analytics', label: 'Sales Analytics' },
  { to: '/sales/commission', label: 'Commission' },
  { to: '/sales/profile', label: 'Profile' },
];

export default function SalesLayout() {
  const { user, salesPerson, logout } = useSalesAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/sales-login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className={`admin-shell ${sidebarOpen ? 'admin-shell-open' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <span className="admin-pill">DilYum</span>
          <strong>Sales Person</strong>
        </div>
        <div className="sales-sidebar-user">
          <strong>{user?.name || 'Sales'}</strong>
          <span className="sales-code">{salesPerson?.salesCode || '—'}</span>
        </div>
        <nav className="admin-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sales-sidebar-footer">
          <Link to="/" className="admin-nav-link" onClick={() => setSidebarOpen(false)}>
            Back to Site
          </Link>
          <button
            type="button"
            className="admin-nav-link sales-logout-link"
            onClick={onLogout}
            disabled={loggingOut}
          >
            {loggingOut ? '…' : 'Logout'}
          </button>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-icon-btn admin-menu-btn"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <div className="admin-topbar-title">Sales Panel</div>
          <div className="admin-account">
            <div className="admin-account-meta">
              <strong>{user?.name || 'Sales'}</strong>
              <span>{user?.email}</span>
            </div>
          </div>
        </header>
        <main className="admin-content">
          <Suspense fallback={<Loader label="Loading…" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
