import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import Fuse from 'fuse.js';
import SiteNavbar from '../components/SiteNavbar';
import { getPublicRestaurantBySlug } from '../services/publicRestaurantsApi';
import { resolvePublicQr } from '../services/qrApi';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=500&q=80';

export default function PublicRestaurantPage() {
  const { restaurantSlug, token } = useParams();
  const location = useLocation();
  const fromQr = Boolean(token) || location.hash === '#menu';
  const [data, setData] = useState(null);
  const [unavailable, setUnavailable] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setUnavailable('');
    setData(null);
    setSearchText('');
    setSelectedCategory('all');

    (async () => {
      try {
        if (token) {
          const payload = await resolvePublicQr(token, restaurantSlug);
          if (!alive) return;
          if (!payload.available) {
            setUnavailable(
              payload.message || 'This restaurant is currently unavailable.',
            );
            return;
          }
          setData(payload);
        } else {
          const payload = await getPublicRestaurantBySlug(restaurantSlug);
          if (alive) setData(payload);
        }
      } catch (err) {
        if (alive) setError(err.message || 'Restaurant not found.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantSlug, token]);

  useEffect(() => {
    if (loading || !fromQr || unavailable || error) return;
    const t = window.setTimeout(() => {
      const el =
        document.getElementById('menu') ||
        document.getElementById('restaurant-menu-search');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, [loading, fromQr, unavailable, error, data]);

  const filteredDishes = useMemo(() => {
    if (!data?.dishes) return [];
    let list = data.dishes;

    if (selectedCategory !== 'all') {
      list = list.filter((d) => d.category === selectedCategory);
    }

    const q = searchText.trim();
    if (!q) return list;

    const fuse = new Fuse(list, {
      keys: ['name', 'category', 'description', 'ingredients'],
      threshold: 0.35,
      ignoreLocation: true,
    });
    return fuse.search(q).map((r) => r.item);
  }, [data, searchText, selectedCategory]);

  const dishesByCategory = useMemo(() => {
    const map = new Map();
    filteredDishes.forEach((dish) => {
      const key = dish.category || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(dish);
    });
    return [...map.entries()];
  }, [filteredDishes]);

  if (loading) {
    return (
      <div className="app public-restaurant-page">
        <SiteNavbar />
        <div className="public-rest-loading">
          <div className="restaurants-popup-skeleton" />
          <div className="restaurants-popup-skeleton" />
        </div>
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="app public-restaurant-page">
        <SiteNavbar />
        <section className="public-rest-not-found">
          <h1>Restaurant Unavailable</h1>
          <p>{unavailable}</p>
          <Link to="/" className="hero-cta public-rest-back-cta">
            Back to DilYum
          </Link>
        </section>
      </div>
    );
  }

  if (error || !data?.restaurant) {
    return (
      <div className="app public-restaurant-page">
        <SiteNavbar />
        <section className="public-rest-not-found">
          <h1>Restaurant Not Found</h1>
          <p>This restaurant is unavailable or the link is invalid.</p>
          <Link to="/" className="hero-cta public-rest-back-cta">
            Back to DilYum
          </Link>
        </section>
      </div>
    );
  }

  const { restaurant, categories, dishes } = data;
  const locationLabel = [restaurant.city, restaurant.state].filter(Boolean).join(', ');

  return (
    <div className="app public-restaurant-page">
      <SiteNavbar />

      <section
        className="public-rest-hero"
        style={
          restaurant.coverUrl
            ? {
                backgroundImage: `linear-gradient(135deg, rgba(28,25,23,0.92), rgba(49,27,13,0.88)), url(${restaurant.coverUrl})`,
              }
            : undefined
        }
      >
        <div className="public-rest-hero-inner">
          {restaurant.logoUrl ? (
            <img className="public-rest-logo" src={restaurant.logoUrl} alt="" />
          ) : (
            <span className="public-rest-logo-fallback" aria-hidden="true">
              🍽
            </span>
          )}
          <div>
            <h1>{restaurant.name}</h1>
            {locationLabel ? (
              <p className="public-rest-location">{locationLabel}</p>
            ) : null}
            {restaurant.address ? (
              <p className="public-rest-location">{restaurant.address}</p>
            ) : null}
            {restaurant.description ? (
              <p className="public-rest-desc">{restaurant.description}</p>
            ) : null}
          </div>
        </div>
      </section>

      <div id="menu" />

      {dishes.length === 0 ? (
        <section className="public-rest-empty">
          <h2>Menu coming soon.</h2>
          <p>This restaurant hasn&apos;t published its menu yet.</p>
          <Link to="/" className="site-navbar-login">
            Back to DilYum
          </Link>
        </section>
      ) : (
        <>
          <div className="search-filter-section" id="restaurant-menu-search">
            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder={`🔍 Search dishes in ${restaurant.name}…`}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
          </div>

          <div className="category-filter">
            <div className="category-scroll">
              <button
                type="button"
                className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="result-info">
            <p className="result-count">
              Found <span className="count-number">{filteredDishes.length}</span>{' '}
              dish{filteredDishes.length === 1 ? '' : 'es'}
            </p>
          </div>

          {filteredDishes.length === 0 ? (
            <div className="empty-state">
              <p className="empty-icon">🔍</p>
              <p className="empty-text">No dishes found matching your criteria.</p>
              <p className="empty-subtext">Try another search within this restaurant.</p>
            </div>
          ) : (
            dishesByCategory.map(([category, items]) => (
              <section key={category} className="public-rest-category-block">
                <h2 className="public-rest-category-title">{category}</h2>
                <div className="grid">
                  {items.map((item) => (
                    <PublicDishCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}

function PublicDishCard({ item }) {
  const [isOpen, setIsOpen] = useState(false);
  const ingredients = item.ingredients ?? [];
  const allergens = item.allergens ?? [];
  const image = item.imageUrl || item.image || FALLBACK_IMAGE;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  return (
    <>
      <div className="dish-card" onClick={() => setIsOpen(true)}>
        <img
          src={image}
          alt={item.name}
          className="dish-img"
          onError={(e) => {
            e.target.src = FALLBACK_IMAGE;
          }}
        />
        <div className="card-header">
          <h3 className="card-name">{item.name}</h3>
          <div className="card-price">₹{item.price}</div>
        </div>
        {item.description ? (
          <p className="public-dish-desc">{item.description}</p>
        ) : null}
        <div className="card-ingredients-preview">
          {item.isVeg ? (
            <span className="ingredient-tag">Veg</span>
          ) : (
            <span className="ingredient-tag more">Non-Veg</span>
          )}
          {item.isVegan ? <span className="ingredient-tag">Vegan</span> : null}
          {item.calories != null ? (
            <span className="ingredient-tag more">{item.calories} cal</span>
          ) : null}
          {ingredients.slice(0, 1).map((ing) => (
            <span key={ing} className="ingredient-tag">
              {ing}
            </span>
          ))}
        </div>
        <div className="card-footer">
          <p className="click-hint">Click for details</p>
        </div>
      </div>

      {isOpen ? (
        <div
          className="dish-modal-overlay"
          onClick={() => setIsOpen(false)}
          role="presentation"
        >
          <div
            className="dish-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={item.name}
          >
            <button
              type="button"
              className="dish-modal-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <img
              src={image}
              alt={item.name}
              className="dish-modal-img"
              onError={(e) => {
                e.target.src = FALLBACK_IMAGE;
              }}
            />
            <div className="dish-modal-body">
              <div className="dish-modal-header">
                <h3 className="dish-modal-name">{item.name}</h3>
                <div className="card-price">₹{item.price}</div>
              </div>
              {item.description ? (
                <p className="public-dish-desc modal">{item.description}</p>
              ) : null}

              <div className="public-dish-flags">
                {item.isVeg ? <span className="ingredient-tag">Veg</span> : null}
                {!item.isVeg ? (
                  <span className="ingredient-tag more">Non-Veg</span>
                ) : null}
                {item.isVegan ? <span className="ingredient-tag">Vegan</span> : null}
                {item.isJain ? <span className="ingredient-tag">Jain</span> : null}
              </div>

              {ingredients.length > 0 ? (
                <>
                  <p className="ingredients-label">Ingredients:</p>
                  <div className="ingredients-list">
                    {ingredients.map((ing) => (
                      <span key={ing} className="ingredient-full">
                        {ing}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}

              {allergens.length > 0 ? (
                <>
                  <p className="ingredients-label" style={{ marginTop: 14 }}>
                    Allergens:
                  </p>
                  <div className="ingredients-list">
                    {allergens.map((a) => (
                      <span key={a} className="ingredient-full">
                        {a}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}

              {item.calories != null ||
              item.protein != null ||
              item.carbohydrates != null ||
              item.fat != null ? (
                <>
                  <p className="ingredients-label" style={{ marginTop: 14 }}>
                    Nutrition:
                  </p>
                  <div className="ingredients-list">
                    {item.calories != null ? (
                      <span className="ingredient-full">{item.calories} kcal</span>
                    ) : null}
                    {item.protein != null ? (
                      <span className="ingredient-full">Protein {item.protein}g</span>
                    ) : null}
                    {item.carbohydrates != null ? (
                      <span className="ingredient-full">
                        Carbs {item.carbohydrates}g
                      </span>
                    ) : null}
                    {item.fat != null ? (
                      <span className="ingredient-full">Fat {item.fat}g</span>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
