import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminAuth } from './auth/AdminAuthContext';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/restaurants', label: 'Restaurants' },
  { to: '/admin/restaurants/new', label: 'Add Restaurant' },
  { to: '/admin/qr', label: 'QR Management' },
  { to: '/admin/analytics', label: 'Analytics', soon: true },
  { to: '/admin/subscriptions', label: 'Subscriptions', soon: true },
  { to: '/admin/settings', label: 'Settings', soon: true },
];

export default function AdminLayout() {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/admin-login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className={`admin-shell ${sidebarOpen ? 'admin-shell-open' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <span className="admin-pill">DILYUM</span>
          <strong>Super Admin</strong>
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
              {item.soon ? <em>Soon</em> : null}
            </NavLink>
          ))}
        </nav>
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
          <div className="admin-topbar-title">Platform Control</div>
          <div className="admin-account">
            <div className="admin-account-meta">
              <strong>{user?.name || 'Admin'}</strong>
              <span>{user?.email}</span>
            </div>
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={onLogout}
              disabled={loggingOut}
            >
              {loggingOut ? '…' : 'Logout'}
            </button>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
