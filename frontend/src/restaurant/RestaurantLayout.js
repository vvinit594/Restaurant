import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useRestaurantAuth } from './auth/RestaurantAuthContext';

export default function RestaurantLayout() {
  const { user, permissions, logout } = useRestaurantAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const nav = [
    { to: '/restaurant/dashboard', label: 'Dashboard', end: true, show: true },
    { to: '/restaurant/profile', label: 'Restaurant Profile', show: permissions?.manageProfile },
    { to: '/restaurant/settings', label: 'Settings', show: permissions?.manageSettings },
    { to: '/restaurant/menu', label: 'All Dishes', show: permissions?.viewMenu },
    { to: '/restaurant/menu/add', label: 'Add Dish', show: permissions?.addDish },
    { to: '/restaurant/categories', label: 'Categories', show: permissions?.manageCategories },
    { to: '/restaurant/ingredients', label: 'Ingredients', show: permissions?.manageIngredients },
    { to: '/restaurant/tables', label: 'Tables', show: permissions?.manageTables },
    { to: '/restaurant/qr', label: 'QR Codes', show: permissions?.manageQr },
    { to: '/restaurant/analytics', label: 'Analytics', show: permissions?.viewAnalytics },
  ].filter((item) => item.show);

  return (
    <div className={`admin-shell ${sidebarOpen ? 'admin-shell-open' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <span className="admin-pill">DilYum</span>
          <strong>{user?.restaurantName || 'Restaurant'}</strong>
          <span className="rest-role-chip">{formatRole(user?.role)}</span>
        </div>
        <nav className="admin-nav">
          <p className="rest-nav-group">Overview</p>
          {nav
            .filter((n) => n.to === '/restaurant/dashboard')
            .map((item) => (
              <NavItem key={item.to} item={item} onClick={() => setSidebarOpen(false)} />
            ))}

          <p className="rest-nav-group">Restaurant</p>
          {nav
            .filter((n) => n.to.includes('/profile') || n.to.includes('/settings'))
            .map((item) => (
              <NavItem key={item.to} item={item} onClick={() => setSidebarOpen(false)} />
            ))}

          <p className="rest-nav-group">Menu</p>
          {nav
            .filter((n) => n.to.includes('/menu') || n.to.includes('/categories') || n.to.includes('/ingredients'))
            .map((item) => (
              <NavItem key={item.to} item={item} onClick={() => setSidebarOpen(false)} />
            ))}

          <p className="rest-nav-group">Tables & QR</p>
          {nav
            .filter((n) => n.to.includes('/tables') || n.to.includes('/qr'))
            .map((item) => (
              <NavItem key={item.to} item={item} onClick={() => setSidebarOpen(false)} />
            ))}

          {permissions?.viewAnalytics ? (
            <>
              <p className="rest-nav-group">Insights</p>
              <NavItem
                item={{ to: '/restaurant/analytics', label: 'Analytics', end: false }}
                onClick={() => setSidebarOpen(false)}
              />
            </>
          ) : null}
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
          <div className="admin-topbar-title">Restaurant Portal</div>
          <div className="admin-account">
            <div className="admin-account-meta">
              <strong>{user?.name}</strong>
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

function NavItem({ item, onClick }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <span>{item.label}</span>
    </NavLink>
  );
}

function formatRole(role) {
  if (!role) return '';
  return role.replace('RESTAURANT_', '').replace(/_/g, ' ');
}
