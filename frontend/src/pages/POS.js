import React, { useState, useEffect } from 'react';
import './POS.css';
import Navigation from '../components/Navigation';
import POSProductSearch from '../components/POS/POSProductSearch';
import POSCart from '../components/POS/POSCart';
import POSCheckout from '../components/POS/POSCheckout';
import POSReceipt from '../components/POS/POSReceipt';
import API_BASE_URL from '../config/api';
import { addToSyncQueue } from '../services/dataSync';

const POS = ({ onNavigate, user, token, onLogout, isElectron = false }) => {
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);

  // Get token from localStorage if not provided
  const authToken = token || localStorage.getItem('pharmacyToken');

  // Keyboard shortcuts for sales management
  useEffect(() => {
    if (!isElectron) return; // Only enable in Electron mode

    const handleKeyPress = (e) => {
      // Ignore if typing in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // ESC - Close checkout/receipt
      if (e.key === 'Escape') {
        if (showCheckout) setShowCheckout(false);
        if (receipt) setReceipt(null);
      }

      // F1 - Focus search
      if (e.key === 'F1') {
        e.preventDefault();
        const searchInput = document.querySelector('.product-search-input');
        if (searchInput) searchInput.focus();
      }

      // F2 - Open checkout
      if (e.key === 'F2') {
        e.preventDefault();
        if (cart.length > 0) setShowCheckout(true);
      }

      // F3 - Clear cart
      if (e.key === 'F3') {
        e.preventDefault();
        if (cart.length > 0 && window.confirm('Clear cart?')) {
          clearCart();
        }
      }

      // Ctrl+Enter - Quick checkout (if checkout is open)
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        const checkoutBtn = document.querySelector('.checkout-button');
        if (checkoutBtn) checkoutBtn.click();
      }

      // Number keys - Quick quantity selection (when product selected)
      if (e.key >= '1' && e.key <= '9' && e.ctrlKey) {
        // Could be used for quick quantity entry
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [cart, showCheckout, receipt, isElectron]);

  const addToCart = (medicine) => {
    const existingItem = cart.find(item => item.reg_number === medicine.reg_number);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.reg_number === medicine.reg_number
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        ...medicine,
        quantity: 1
      }]);
    }
  };

  const updateQuantity = (regNumber, quantity) => {
    if (quantity <= 0) {
      removeFromCart(regNumber);
      return;
    }
    setCart(cart.map(item =>
      item.reg_number === regNumber
        ? { ...item, quantity: quantity }
        : item
    ));
  };

  const removeFromCart = (regNumber) => {
    setCart(cart.filter(item => item.reg_number !== regNumber));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setTax(0);
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price_rs * item.quantity), 0);
    const discountAmount = (subtotal * discount) / 100;
    const taxAmount = (subtotal * tax) / 100;
    const total = subtotal - discountAmount + taxAmount;
    
    return { subtotal, discountAmount, taxAmount, total };
  };

  const handleCheckout = async (customerInfo, paymentMethod) => {
    try {
      const { subtotal, discountAmount, taxAmount, total } = calculateTotals();
      
      const checkoutData = {
        items: cart.map(item => ({
          reg_number: item.reg_number,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price_rs
        })),
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        paymentMethod: paymentMethod,
        discount: discount,
        tax: tax
      };

      // Check if online
      if (navigator.onLine) {
        // Try to process immediately
        try {
          const response = await fetch(`${API_BASE_URL}/api/sales/checkout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authToken ? `Bearer ${authToken}` : ''
            },
            body: JSON.stringify(checkoutData)
          });
          
          if (response.ok) {
            const data = await response.json();
            setReceipt(data.transaction);
            setShowCheckout(false);
            clearCart();
            return;
          }
        } catch (error) {
          console.error('Checkout error (online):', error);
          // Fall through to offline queue
        }
      }

      // Offline or network error - queue for sync
      const queueSuccess = await addToSyncQueue('sale', checkoutData, '/api/sales/checkout', 'POST');
      
      if (queueSuccess) {
        // Generate local receipt for offline sale
        const localTransaction = {
          id: `local-${Date.now()}`,
          transactionId: `TXN-${Date.now()}`,
          date: new Date().toISOString(),
          customer: {
            name: customerInfo.name,
            phone: customerInfo.phone
          },
          items: cart.map(item => ({
            product_name: item.product_name,
            quantity: item.quantity,
            price: item.price_rs
          })),
          payment: {
            method: paymentMethod,
            subtotal: subtotal,
            discount: discountAmount,
            tax: taxAmount,
            total: total
          },
          offline: true
        };

        setReceipt(localTransaction);
        setShowCheckout(false);
        clearCart();
        
        if (!navigator.onLine) {
          alert('Sale saved offline. It will sync when internet is available.');
        }
      } else {
        alert('Failed to save sale. Please try again.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Checkout failed. Please try again.');
    }
  };

  const closeReceipt = () => {
    setReceipt(null);
    // Clear cart only after user closes receipt (after printing)
    clearCart();
  };

  if (receipt) {
    return (
      <POSReceipt 
        transaction={receipt} 
        onClose={closeReceipt}
        pharmacyName={user?.pharmacyName || user?.username}
        isElectron={isElectron}
      />
    );
  }

  return (
    <div className="pos-container">
      {!isElectron && onNavigate && (
        <Navigation currentPage="pos" onNavigate={onNavigate} />
      )}
      {user && (
        <div className="pos-user-info">
          <span>🏥 {user.pharmacyName || user.username}</span>
          {onLogout && <button className="logout-btn" onClick={onLogout}>Logout</button>}
        </div>
      )}
      <div className="pos-header">
        <h1>💊 Point of Sale (POS)</h1>
        <div className="pos-header-actions">
          <button className="btn-secondary" onClick={clearCart} disabled={cart.length === 0}>
            Clear Cart
          </button>
        </div>
      </div>

      <div className="pos-main">
        <div className="pos-left">
          <POSProductSearch onAddToCart={addToCart} token={authToken} />
        </div>

        <div className="pos-right">
          <POSCart
            cart={cart}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeFromCart}
            discount={discount}
            tax={tax}
            onDiscountChange={setDiscount}
            onTaxChange={setTax}
            totals={calculateTotals()}
            onCheckout={() => setShowCheckout(true)}
          />
        </div>
      </div>

      {showCheckout && (
        <POSCheckout
          totals={calculateTotals()}
          onCheckout={handleCheckout}
          onCancel={() => setShowCheckout(false)}
        />
      )}
    </div>
  );
};

export default POS;

