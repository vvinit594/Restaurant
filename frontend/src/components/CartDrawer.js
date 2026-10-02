import React from 'react';

/**
 * Cart drawer for public restaurant menus (DilYum styling).
 */
export default function CartDrawer({
  open,
  restaurantName,
  items,
  onClose,
  onQuantityChange,
  onRemove,
  onProceed,
}) {
  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.price) * Number(i.quantity),
    0,
  );

  if (!open) return null;

  return (
    <div className="order-cart-overlay" onClick={onClose} role="presentation">
      <aside
        className="order-cart-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
      >
        <div className="order-cart-header">
          <div>
            <h3>Your Cart</h3>
            <p className="order-cart-rest">{restaurantName}</p>
          </div>
          <button type="button" className="dish-modal-close" onClick={onClose} aria-label="Close cart">
            ×
          </button>
        </div>

        <div className="order-cart-body">
          {items.length === 0 ? (
            <p className="order-cart-empty">Your cart is empty. Add dishes from the menu.</p>
          ) : (
            items.map((item) => (
              <div key={item.dishId} className="order-cart-item">
                <div className="order-cart-item-media">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" width="56" height="56" loading="lazy" decoding="async" />
                  ) : (
                    <span className="order-cart-item-ph">🍽</span>
                  )}
                </div>
                <div className="order-cart-item-meta">
                  <strong>{item.name}</strong>
                  <span>₹{Number(item.price)} × {item.quantity} = ₹{Number(item.price) * item.quantity}</span>
                  <div className="order-qty" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => onQuantityChange(item.dishId, -1)} aria-label="Decrease">−</button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => onQuantityChange(item.dishId, 1)} aria-label="Increase">+</button>
                  </div>
                </div>
                <button
                  type="button"
                  className="order-cart-remove"
                  onClick={() => onRemove(item.dishId)}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        <div className="order-cart-footer">
          <div className="order-cart-total">
            <span>Total</span>
            <strong>₹{subtotal}</strong>
          </div>
          <button
            type="button"
            className="hero-explore-btn order-cart-cta"
            disabled={items.length === 0}
            onClick={onProceed}
          >
            Proceed to Order
          </button>
        </div>
      </aside>
    </div>
  );
}
