import React from 'react';
import './POSCart.css';

const POSCart = ({ cart, onUpdateQuantity, onRemoveItem, discount, tax, onDiscountChange, onTaxChange, totals, onCheckout }) => {
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(price);
  };

  if (cart.length === 0) {
    return (
      <div className="pos-cart">
        <h2>Shopping Cart</h2>
        <div className="empty-cart">
          <p>🛒</p>
          <p>Your cart is empty</p>
          <p className="empty-cart-hint">Search and add medicines to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pos-cart">
      <h2>Shopping Cart ({cart.length})</h2>
      
      <div className="cart-items">
        {cart.map((item) => (
          <div key={item.reg_number} className="cart-item">
            <div className="cart-item-info">
              <h4>{item.product_name}</h4>
              <p className="cart-item-generic">{item.generic_name}</p>
              <p className="cart-item-price">{formatPrice(item.price_rs)} each</p>
            </div>
            <div className="cart-item-controls">
              <div className="quantity-controls">
                <button
                  className="qty-btn"
                  onClick={() => onUpdateQuantity(item.reg_number, item.quantity - 1)}
                >
                  −
                </button>
                <input
                  type="number"
                  className="qty-input"
                  value={item.quantity}
                  onChange={(e) => onUpdateQuantity(item.reg_number, parseInt(e.target.value) || 0)}
                  min="1"
                />
                <button
                  className="qty-btn"
                  onClick={() => onUpdateQuantity(item.reg_number, item.quantity + 1)}
                >
                  +
                </button>
              </div>
              <div className="cart-item-total">
                {formatPrice(item.price_rs * item.quantity)}
              </div>
              <button
                className="remove-btn"
                onClick={() => onRemoveItem(item.reg_number)}
                title="Remove item"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-totals">
        <div className="totals-section">
          <div className="total-row">
            <span>Subtotal:</span>
            <span>{formatPrice(totals.subtotal)}</span>
          </div>
          
          <div className="discount-tax-section">
            <div className="discount-control">
              <label>Discount (%):</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
                step="0.1"
                className="discount-input"
              />
            </div>
            {totals.discountAmount > 0 && (
              <div className="total-row discount-row">
                <span>Discount:</span>
                <span className="discount-amount">-{formatPrice(totals.discountAmount)}</span>
              </div>
            )}
            
            <div className="tax-control">
              <label>Tax (%):</label>
              <input
                type="number"
                value={tax}
                onChange={(e) => onTaxChange(parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
                step="0.1"
                className="tax-input"
              />
            </div>
            {totals.taxAmount > 0 && (
              <div className="total-row tax-row">
                <span>Tax:</span>
                <span>{formatPrice(totals.taxAmount)}</span>
              </div>
            )}
          </div>

          <div className="total-row final-total">
            <span>Total:</span>
            <span>{formatPrice(totals.total)}</span>
          </div>
        </div>

        <button className="checkout-btn" onClick={onCheckout}>
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
};

export default POSCart;

