import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPublicRestaurants } from '../services/publicRestaurantsApi';
import { useRestaurantAuth } from '../restaurant/auth/RestaurantAuthContext';

export default function SiteNavbar() {
  const { isAuthenticated, bootstrapping } = useRestaurantAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const panelRef = useRef(null);

  const onRestaurantLogin = () => {
    setOpen(false);
    if (!bootstrapping && isAuthenticated) {
      navigate('/restaurant/dashboard');
      return;
    }
    navigate('/restaurant-login');
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
    if (!open) return;
    const onPointer = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter((r) =>
      [r.name, r.city, r.state].filter(Boolean).some((v) => v.toLowerCase().includes(q))
    );
  }, [restaurants, search]);

  const openRestaurant = (slug) => {
    setOpen(false);
    setSearch('');
    navigate(`/r/${slug}`);
  };

  return (
    <header className="site-navbar">
      <div className="site-navbar-inner">
        <Link to="/" className="site-navbar-brand" onClick={() => setOpen(false)}>
          <span className="site-navbar-logo">DilYum</span>
        </Link>

        <div className="site-navbar-actions" ref={panelRef}>
          <button
            type="button"
            className={`site-navbar-link-btn ${open ? 'active' : ''}`}
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((v) => !v)}
          >
            Restaurants
          </button>

          <button type="button" className="site-navbar-login" onClick={onRestaurantLogin}>
            {isAuthenticated ? 'Restaurant Dashboard' : 'Restaurant Login'}
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
                  <>
                    <div className="restaurants-popup-skeleton" />
                    <div className="restaurants-popup-skeleton" />
                    <div className="restaurants-popup-skeleton" />
                  </>
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
                          <img src={r.logoUrl} alt="" />
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
      </div>
    </header>
  );
}
