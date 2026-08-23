import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SiteNavbar from '../components/SiteNavbar';
import { getPublicRestaurants } from '../services/publicRestaurantsApi';

function RestaurantCard({ restaurant }) {
  const navigate = useNavigate();
  const [coverFailed, setCoverFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const cover = restaurant.coverUrl || '';
  const logo = restaurant.logoUrl || '';
  const location = [restaurant.city, restaurant.state].filter(Boolean).join(', ');
  const initial = restaurant.name?.charAt(0)?.toUpperCase() || 'R';

  return (
    <article
      className="restaurant-card"
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/r/${restaurant.slug}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/r/${restaurant.slug}`);
        }
      }}
      aria-label={`Open ${restaurant.name}`}
    >
      <div className="restaurant-card-cover">
        {cover && !coverFailed ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <div className="restaurant-card-cover-fallback" aria-hidden="true">
            {initial}
          </div>
        )}
      </div>

      <div className="restaurant-card-body">
        <div className="restaurant-card-header">
          <h2 className="restaurant-card-name">{restaurant.name}</h2>
          <div className="restaurant-card-logo">
            {logo && !logoFailed ? (
              <img
                src={logo}
                alt=""
                loading="lazy"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span className="restaurant-card-logo-fallback" aria-hidden="true">
                {initial}
              </span>
            )}
          </div>
        </div>

        {location ? (
          <p className="restaurant-card-meta">{location}</p>
        ) : null}

        <p className="restaurant-card-desc">
          {restaurant.description?.trim() ||
            'Discover authentic flavors and a carefully crafted menu.'}
        </p>
      </div>
    </article>
  );
}

function RestaurantCardSkeleton() {
  return (
    <div className="restaurant-card restaurant-card-skeleton" aria-hidden="true">
      <div className="restaurant-card-cover skeleton-block" />
      <div className="restaurant-card-body">
        <div className="restaurant-card-header">
          <div className="skeleton-line skeleton-line-lg" />
          <div className="skeleton-avatar" />
        </div>
        <div className="skeleton-line skeleton-line-sm" />
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-line-md" />
      </div>
    </div>
  );
}

export default function RestaurantsListingPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getPublicRestaurants();
      setRestaurants(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load restaurants.');
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="app restaurants-listing-page">
      <SiteNavbar />
      <main className="restaurants-listing">
        <header className="restaurants-listing-header">
          <p className="restaurants-listing-eyebrow">DilYum</p>
          <h1>Restaurants</h1>
          <p className="restaurants-listing-sub">
            Discover kitchens on DilYum — tap a restaurant to explore its menu.
          </p>
        </header>

        {loading ? (
          <div className="restaurant-grid" aria-busy="true" aria-label="Loading restaurants">
            <RestaurantCardSkeleton />
            <RestaurantCardSkeleton />
            <RestaurantCardSkeleton />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="restaurants-state restaurants-state-error">
            <h2>Unable to load restaurants</h2>
            <p>{error}</p>
            <button type="button" className="hero-explore-btn" onClick={load}>
              Retry
            </button>
          </div>
        ) : null}

        {!loading && !error && restaurants.length === 0 ? (
          <div className="restaurants-state">
            <h2>No restaurants available yet</h2>
            <p>Check back soon — new kitchens are joining DilYum.</p>
            <Link to="/" className="hero-explore-btn" style={{ display: 'inline-flex' }}>
              Back to Home
            </Link>
          </div>
        ) : null}

        {!loading && !error && restaurants.length > 0 ? (
          <>
            <p className="results-info">
              Showing <strong>{restaurants.length}</strong> restaurant
              {restaurants.length === 1 ? '' : 's'}
            </p>
            <div className="restaurant-grid">
              {restaurants.map((r) => (
                <RestaurantCard key={r.id || r.slug} restaurant={r} />
              ))}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
