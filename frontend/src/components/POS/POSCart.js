import React, { useState, useEffect, useRef } from 'react';
import './POSCart.css';

const POSCart = ({ cart, onUpdateQuantity, onRemoveItem, discount, tax, onDiscountChange, onTaxChange, totals, onCheckout }) => {
  const [selectedCartIndex, setSelectedCartIndex] = useState(-1);
  const cartContainerRef = useRef(null);
  const itemRefs = useRef({});
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(price);
  };

  // Keyboard navigation for cart
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't interfere with input fields
      const isInputFocused = e.target.tagName === 'INPUT' || 
                            e.target.tagName === 'TEXTAREA';
      
      if (isInputFocused) {
        // Allow Enter in quantity inputs to move to next item
        if (e.key === 'Enter' && e.target.classList.contains('qty-input')) {
          e.preventDefault();
          const currentIndex = Array.from(document.querySelectorAll('.qty-input')).indexOf(e.target);
          if (currentIndex < cart.length - 1) {
            const nextInput = document.querySelectorAll('.qty-input')[currentIndex + 1];
            if (nextInput) {
              nextInput.focus();
              nextInput.select();
            }
          } else {
            // Focus checkout button
            const checkoutBtn = document.querySelector('.checkout-btn');
            if (checkoutBtn) checkoutBtn.focus();
          }
        }
        return;
      }

      if (cart.length === 0) return;

      // Arrow keys - Navigate cart items
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCartIndex(prev => {
          const newIndex = prev < cart.length - 1 ? prev + 1 : 0;
          scrollToCartItem(newIndex);
          return newIndex;
        });
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCartIndex(prev => {
          const newIndex = prev > 0 ? prev - 1 : cart.length - 1;
          scrollToCartItem(newIndex);
          return newIndex;
        });
      }

      // Delete/Backspace - Remove selected item
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCartIndex >= 0) {
        e.preventDefault();
        const item = cart[selectedCartIndex];
        if (item) {
          onRemoveItem(item.reg_number);
          setSelectedCartIndex(prev => {
            const newIndex = prev >= cart.length - 1 ? Math.max(0, cart.length - 2) : prev;
            return newIndex;
          });
        }
      }

      // + key - Increase quantity of selected item
      if (e.key === '+' && selectedCartIndex >= 0) {
        e.preventDefault();
        const item = cart[selectedCartIndex];
        if (item) {
          onUpdateQuantity(item.reg_number, item.quantity + 1);
        }
      }

      // - key - Decrease quantity of selected item
      if (e.key === '-' && selectedCartIndex >= 0) {
        e.preventDefault();
        const item = cart[selectedCartIndex];
        if (item) {
          onUpdateQuantity(item.reg_number, Math.max(1, item.quantity - 1));
        }
      }

      // Enter - Focus quantity input of selected item
      if (e.key === 'Enter' && selectedCartIndex >= 0) {
        e.preventDefault();
        const qtyInput = itemRefs.current[`qty-${selectedCartIndex}`];
        if (qtyInput) {
          qtyInput.focus();
          qtyInput.select();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedCartIndex, onUpdateQuantity, onRemoveItem]);

  const scrollToCartItem = (index) => {
    const itemElement = itemRefs.current[`item-${index}`];
    if (itemElement) {
      itemElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
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
      
      <div 
        className="cart-items"
        ref={cartContainerRef}
        tabIndex={0}
        style={{ outline: 'none' }}
        onFocus={() => {
          if (cart.length > 0 && selectedCartIndex === -1) {
            setSelectedCartIndex(0);
          }
        }}
      >
        {cart.map((item, index) => (
          <div 
            key={item.reg_number} 
            className={`cart-item ${index === selectedCartIndex ? 'selected-cart-item' : ''}`}
            ref={el => itemRefs.current[`item-${index}`] = el}
            onClick={() => setSelectedCartIndex(index)}
          >
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
                  ref={el => itemRefs.current[`qty-${index}`] = el}
                  value={item.quantity}
                  onChange={(e) => onUpdateQuantity(item.reg_number, parseInt(e.target.value) || 0)}
                  onKeyDown={(e) => {
                    // Arrow up/down to navigate items
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      if (index > 0) {
                        const prevInput = itemRefs.current[`qty-${index - 1}`];
                        if (prevInput) {
                          prevInput.focus();
                          prevInput.select();
                          setSelectedCartIndex(index - 1);
                        }
                      }
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      if (index < cart.length - 1) {
                        const nextInput = itemRefs.current[`qty-${index + 1}`];
                        if (nextInput) {
                          nextInput.focus();
                          nextInput.select();
                          setSelectedCartIndex(index + 1);
                        }
                      } else {
                        const checkoutBtn = document.querySelector('.checkout-btn');
                        if (checkoutBtn) checkoutBtn.focus();
                      }
                    }
                  }}
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

        <button 
          className="checkout-btn" 
          onClick={onCheckout}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' && cart.length > 0) {
              e.preventDefault();
              const lastInput = itemRefs.current[`qty-${cart.length - 1}`];
              if (lastInput) {
                lastInput.focus();
                lastInput.select();
                setSelectedCartIndex(cart.length - 1);
              }
            }
          }}
        >
          Proceed to Checkout (F2)
        </button>
      </div>
    </div>
  );
};

export default POSCart;

