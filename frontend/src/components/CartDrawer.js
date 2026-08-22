import React from 'react';

function CartDrawer({ cartOpen, cartItems, onClose, onQuantityChange }) {
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cartItems.reduce((sum, item) => sum + item.quantity * item.price, 0).toFixed(2);

  return (
    <div className={`cart-drawer ${cartOpen ? 'open' : ''}`} id="cart">
      <div className="cart-drawer-header">
        <div>
          <h3>Your Order</h3>
          <p>{totalItems} items • ${totalPrice}</p>
        </div>
        <button className="close-drawer" onClick={onClose}>×</button>
      </div>

      <div className="cart-items-list">
        {cartItems.length === 0 ? (
          <p className="empty-cart">No items added yet. Browse the menu to start.</p>
        ) : (
          cartItems.map((item) => (
            <div key={item.id} className="cart-item">
              <div>
                <h4>{item.title}</h4>
                <p>{item.price.toFixed(2)} × {item.quantity}</p>
              </div>
              <div className="quantity-controls">
                <button onClick={() => onQuantityChange(item.id, -1)}>-</button>
                <span>{item.quantity}</span>
                <button onClick={() => onQuantityChange(item.id, 1)}>+</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="cart-drawer-footer">
        <button className="checkout-button" disabled={cartItems.length === 0}>
          Checkout
        </button>
      </div>
    </div>
  );
}

export default CartDrawer;
