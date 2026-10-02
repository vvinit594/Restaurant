import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Loader from './Loader';
import { getPublicRestaurants } from '../services/publicRestaurantsApi';
import { useRestaurantAuth } from '../restaurant/auth/RestaurantAuthContext';
import { useCustomerDevice } from '../customer/CustomerDeviceContext';

export default function SiteNavbar({ cartCount = 0, onCartClick }) {
  const { isAuthenticated, bootstrapping } = useRestaurantAuth();
  const { unreadCount } = useCustomerDevice();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loginMenuOpen, setLoginMenuOpen] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const panelRef = useRef(null);
  const loginMenuRef = useRef(null);
  const loginMenuBtnRef = useRef(null);

  const closeAll = () => {
    setOpen(false);
    setLoginMenuOpen(false);
  };

  const onRestaurantLogin = () => {
    closeAll();
    if (!bootstrapping && isAuthenticated) {
      navigate('/restaurant/dashboard');
      return;
    }
    navigate('/restaurant-login');
  };

  const toggleLoginMenu = () => {
    setOpen(false);
    setLoginMenuOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getPublicRestaurants();
        if (alive) setRestaurants(data);
      } catch (err) {
        if (alive) setError(err.message || 'Could not load restaurants.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open && !loginMenuOpen) return;
    const onPointer = (e) => {
      const target = e.target;
      if (open && panelRef.current && !panelRef.current.contains(target)) {
        setOpen(false);
      }
      if (
        loginMenuOpen &&
        loginMenuRef.current &&
        !loginMenuRef.current.contains(target) &&
        loginMenuBtnRef.current &&
        !loginMenuBtnRef.current.contains(target)
      ) {
        setLoginMenuOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (loginMenuOpen) {
        setLoginMenuOpen(false);
        loginMenuBtnRef.current?.focus();
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, loginMenuOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter((r) =>
      [r.name, r.city, r.state].filter(Boolean).some((v) => v.toLowerCase().includes(q))
    );
  }, [restaurants, search]);

  const openRestaurant = (slug) => {
    closeAll();
    setSearch('');
    navigate(`/r/${slug}`);
  };

  return (
    <header className="site-navbar">
      <div className="site-navbar-inner">
        <Link to="/" className="site-navbar-brand" onClick={closeAll}>
          <span className="site-navbar-logo">DilYum</span>
        </Link>

        <div className="site-navbar-actions">
          <div ref={panelRef}>
            <button
              type="button"
              className={`site-navbar-link-btn ${open ? 'active' : ''}`}
              aria-expanded={open}
              aria-haspopup="dialog"
              onClick={() => {
                setLoginMenuOpen(false);
                setOpen((v) => !v);
              }}
            >
              Restaurants
            </button>

            {open ? (
              <div className="restaurants-popup" role="dialog" aria-label="Restaurants">
                <div className="restaurants-popup-head">
                  <div>
                    <h2>Restaurants</h2>
                    <p>Discover restaurants on DilYum</p>
                  </div>
                  <button
                    type="button"
                    className="restaurants-popup-close"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                  >
                    ×
                  </button>
                </div>

                {(restaurants.length > 5 || search) && (
                  <input
                    className="restaurants-popup-search"
                    type="search"
                    placeholder="🔍 Search restaurants…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                )}

                <div className="restaurants-popup-list">
                  {loading ? (
                    <Loader variant="inline" label="Loading restaurants…" />
                  ) : error ? (
                    <p className="restaurants-popup-empty">{error}</p>
                  ) : filtered.length === 0 ? (
                    <p className="restaurants-popup-empty">
                      {search ? 'No restaurants match your search.' : 'No active restaurants yet.'}
                    </p>
                  ) : (
                    filtered.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="restaurants-popup-item"
                        onClick={() => openRestaurant(r.slug)}
                      >
                        <span className="restaurants-popup-avatar" aria-hidden="true">
                          {r.logoUrl ? (
                            <img src={r.logoUrl} alt="" width="42" height="42" loading="lazy" decoding="async" />
                          ) : (
                            '🍽'
                          )}
                        </span>
                        <span className="restaurants-popup-meta">
                          <strong>{r.name}</strong>
                          <em>{[r.city, r.state].filter(Boolean).join(', ') || 'Location coming soon'}</em>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {typeof onCartClick === 'function' ? (
            <button
              type="button"
              className="site-navbar-cart"
              onClick={onCartClick}
              aria-label={`Cart, ${cartCount} items`}
            >
              <svg
                className="site-navbar-cart-icon"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="9" cy="20" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="18" cy="20" r="1.5" fill="currentColor" stroke="none" />
                <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L21 8H7" />
              </svg>
              <span className="site-navbar-cart-label">Cart</span>
              <span className="site-navbar-cart-badge">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            </button>
          ) : null}

          <Link
            to="/account"
            className="site-navbar-icon-btn"
            aria-label="Account"
            onClick={closeAll}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="3.2" />
              <path d="M5 19c1.6-3.2 4.1-4.8 7-4.8s5.4 1.6 7 4.8" />
            </svg>
          </Link>
          <Link
            to="/account/notifications"
            className="site-navbar-icon-btn"
            aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            onClick={closeAll}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 16v-5a6 6 0 1 0-12 0v5" />
              <path d="M5 16h14" />
              <path d="M10 19a2 2 0 0 0 4 0" />
            </svg>
            {unreadCount > 0 ? (
              <span className="site-navbar-icon-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            ) : null}
          </Link>

          <div className="site-navbar-login-wrap">
            <button
              ref={loginMenuBtnRef}
              type="button"
              className={`site-navbar-menu-btn ${loginMenuOpen ? 'active' : ''}`}
              aria-label={loginMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={loginMenuOpen}
              aria-haspopup="menu"
              aria-controls="site-navbar-login-menu"
              onClick={toggleLoginMenu}
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>

            {loginMenuOpen ? (
              <nav
                id="site-navbar-login-menu"
                className="site-navbar-login-menu"
                ref={loginMenuRef}
                role="menu"
                aria-label="Login options"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="site-navbar-login-menu-item"
                  onClick={onRestaurantLogin}
                >
                  Restaurant Login
                </button>
                <Link
                  role="menuitem"
                  className="site-navbar-login-menu-item"
                  to="/sales-login"
                  onClick={closeAll}
                >
                  Sales Login
                </Link>
                <Link
                  role="menuitem"
                  className="site-navbar-login-menu-item"
                  to="/admin-login"
                  onClick={closeAll}
                >
                  Admin Login
                </Link>
              </nav>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
