import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useRestaurantAuth } from './auth/RestaurantAuthContext';
import RestaurantBillingBanner from './RestaurantBillingBanner';

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
    { to: '/restaurant/dashboard', label: 'Dashboard', end: true, show: true, group: 'overview' },
    { to: '/restaurant/loyalty', label: 'Loyalty Program', end: true, show: permissions?.viewLoyalty, group: 'overview' },
    { to: '/restaurant/orders', label: 'Live Orders', end: true, show: permissions?.viewOrders, group: 'orders' },
    { to: '/restaurant/orders/history', label: 'Order History', show: permissions?.viewOrders, group: 'orders' },
    { to: '/restaurant/profile', label: 'Restaurant Profile', show: permissions?.manageProfile, group: 'restaurant' },
    { to: '/restaurant/settings', label: 'Settings', show: permissions?.manageSettings, group: 'restaurant' },
    { to: '/restaurant/menu', label: 'All Dishes', end: true, show: permissions?.viewMenu, group: 'menu' },
    { to: '/restaurant/menu/add', label: 'Add Dish', show: permissions?.addDish, group: 'menu' },
    { to: '/restaurant/menu/bulk', label: 'Bulk Dishes Add', show: permissions?.addDish, group: 'menu' },
    { to: '/restaurant/categories', label: 'Categories', show: permissions?.manageCategories, group: 'menu' },
    { to: '/restaurant/ingredients', label: 'Ingredients', show: permissions?.manageIngredients, group: 'menu' },
    { to: '/restaurant/tables', label: 'Tables', show: permissions?.manageTables, group: 'tables' },
    { to: '/restaurant/qr', label: 'QR Codes', show: permissions?.manageQr, group: 'tables' },
    { to: '/restaurant/analytics', label: 'Analytics', show: permissions?.viewAnalytics, group: 'insights' },
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
            .filter((n) => n.group === 'overview')
            .map((item) => (
              <NavItem key={item.to} item={item} onClick={() => setSidebarOpen(false)} />
            ))}

          {nav.some((n) => n.group === 'orders') ? (
            <>
              <p className="rest-nav-group">Orders</p>
              {nav
                .filter((n) => n.group === 'orders')
                .map((item) => (
                  <NavItem key={item.to} item={item} onClick={() => setSidebarOpen(false)} />
                ))}
            </>
          ) : null}

          <p className="rest-nav-group">Restaurant</p>
          {nav
            .filter((n) => n.group === 'restaurant')
            .map((item) => (
              <NavItem key={item.to} item={item} onClick={() => setSidebarOpen(false)} />
            ))}

          <p className="rest-nav-group">Menu</p>
          {nav
            .filter((n) => n.group === 'menu')
            .map((item) => (
              <NavItem key={item.to} item={item} onClick={() => setSidebarOpen(false)} />
            ))}

          <p className="rest-nav-group">Tables & QR</p>
          {nav
            .filter((n) => n.group === 'tables')
            .map((item) => (
              <NavItem key={item.to} item={item} onClick={() => setSidebarOpen(false)} />
            ))}

          {nav.some((n) => n.group === 'insights') ? (
            <>
              <p className="rest-nav-group">Insights</p>
              {nav
                .filter((n) => n.group === 'insights')
                .map((item) => (
                  <NavItem key={item.to} item={item} onClick={() => setSidebarOpen(false)} />
                ))}
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
          <RestaurantBillingBanner />
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
