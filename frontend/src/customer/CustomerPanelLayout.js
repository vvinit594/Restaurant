import React, { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import Loader from '../components/Loader';
import SiteNavbar from '../components/SiteNavbar';
import './customer.css';

const NAV = [
  { to: '/account', label: 'Overview', end: true },
  { to: '/account/orders/live', label: 'Live Orders' },
  { to: '/account/orders', label: 'Order History', end: true },
  { to: '/account/transactions', label: 'Transactions' },
  { to: '/account/coupons', label: 'Coupons & Offers' },
  { to: '/account/notifications', label: 'Notifications' },
];

export default function CustomerPanelLayout() {
  return (
    <div className="customer-shell">
      <SiteNavbar />
      <div className="customer-panel">
        <aside className="customer-sidenav" aria-label="Account">
          <p className="customer-sidenav-kicker">Account</p>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `customer-sidenav-link ${isActive ? 'active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </aside>
        <div className="customer-main">
          <nav className="customer-mobile-nav" aria-label="Account sections">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `customer-mobile-chip ${isActive ? 'active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Suspense fallback={<Loader label="Loading…" />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
