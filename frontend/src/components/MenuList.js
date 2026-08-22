import React from 'react';

function MenuList({ items, activeCategory, onCategoryChange, searchQuery, onSearchChange, onAddToOrder }) {
  const categories = ['All', 'Starters', 'Mains', 'Desserts', 'Drinks'];

  return (
    <section className="menu-section" id="menu">
      <div className="menu-header">
        <div>
          <p className="eyebrow">Sample Menu</p>
          <h2>Delicious dishes ready to order.</h2>
        </div>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by name or dietary need"
            value={searchQuery}
            onChange={onSearchChange}
          />
        </div>
      </div>

      <div className="tabs-wrapper">
        {categories.map((category) => (
          <button
            key={category}
            className={`tab-button ${activeCategory === category ? 'active' : ''}`}
            onClick={() => onCategoryChange(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="menu-grid">
        {items.map((item) => (
          <article key={item.id} className="menu-card">
            <div className="menu-image">{item.image || '🍛'}</div>
            <div className="menu-card-body">
              <div className="menu-card-title">
                <h3>{item.title}</h3>
                <span>{item.price}</span>
              </div>
              <p>{item.description}</p>
              <div className="badge-row">
                {item.badges.map((badge) => (
                  <span key={badge} className="badge">
                    {badge}
                  </span>
                ))}
              </div>
              <button className="order-button" onClick={() => onAddToOrder(item)}>
                Add to Order
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default MenuList;
