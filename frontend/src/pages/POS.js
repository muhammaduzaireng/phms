import React, { useState, useEffect } from 'react';
import './POS.css';
import Navigation from '../components/Navigation';
import POSProductSearch from '../components/POS/POSProductSearch';
import POSCart from '../components/POS/POSCart';
import POSCheckout from '../components/POS/POSCheckout';
import POSReceipt from '../components/POS/POSReceipt';
import API_BASE_URL from '../config/api';

const POS = ({ onNavigate }) => {
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);

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

      const response = await fetch(`${API_BASE_URL}/api/pos/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(checkoutData)
      });

      if (!response.ok) throw new Error('Checkout failed');

      const data = await response.json();
      setReceipt(data.transaction);
      setShowCheckout(false);
      clearCart();
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Checkout failed. Please try again.');
    }
  };

  const closeReceipt = () => {
    setReceipt(null);
  };

  if (receipt) {
    return <POSReceipt transaction={receipt} onClose={closeReceipt} />;
  }

  return (
    <div className="pos-container">
      <Navigation currentPage="pos" onNavigate={onNavigate} />
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
          <POSProductSearch onAddToCart={addToCart} />
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

