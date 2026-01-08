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

      // Helper function to create transaction object
      const createTransaction = (id, txId, isOffline = false) => ({
        id: id || `local-${Date.now()}`,
        transactionId: txId || `TXN-${Date.now()}`,
        date: new Date().toISOString(),
        customer: {
          name: customerInfo.name,
          phone: customerInfo.phone
        },
        items: cart.map(item => ({
          product_name: item.product_name,
          reg_number: item.reg_number,
          quantity: item.quantity,
          price: item.price_rs,
          total: (item.quantity * item.price_rs)
        })),
        payment: {
          method: paymentMethod,
          subtotal: subtotal,
          discount: discountAmount,
          discountPercent: discount > 0 && subtotal > 0 ? ((discountAmount / subtotal) * 100).toFixed(1) : 0,
          tax: taxAmount,
          taxPercent: tax > 0 && subtotal > 0 ? ((taxAmount / subtotal) * 100).toFixed(1) : 0,
          total: total
        },
        offline: isOffline
      });

      // Check if online and try to process immediately
      if (navigator.onLine) {
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
            
            // Verify that the sale was actually saved
            if (!data.success) {
              throw new Error(data.error || 'Sale was not saved successfully. Please try again.');
            }
            
            if (!data.transaction) {
              throw new Error('Transaction data not received from server. Sale may not have been saved.');
            }
            
            // Ensure transaction has all required fields
            const transaction = data.transaction;
            
            // Verify transaction has required fields
            if (!transaction.id && !transaction.transaction_id && !transaction.transactionId) {
              console.error('Transaction missing ID:', transaction);
              throw new Error('Transaction ID missing. Sale may not have been saved correctly.');
            }
            
            if (transaction && transaction.items) {
              // Ensure items have required fields
              transaction.items = transaction.items.map(item => ({
                ...item,
                product_name: item.product_name || item.item_name || item.name,
                reg_number: item.reg_number || item.regNumber,
                quantity: item.quantity || item.qty || 1,
                price: item.price || item.unit_price || item.price_rs || 0,
                total: item.total || item.subtotal || ((item.quantity || item.qty || 1) * (item.price || item.unit_price || item.price_rs || 0))
              }));
            }
            
            // Ensure payment structure exists
            if (!transaction.payment) {
              transaction.payment = {
                method: paymentMethod,
                subtotal: subtotal,
                discount: discountAmount,
                tax: taxAmount,
                total: total
              };
            }
            
            // Mark transaction as saved (not offline)
            transaction.offline = false;
            transaction.saved = true;
            
            // Ensure transaction has an ID for tracking
            if (!transaction.id) {
              transaction.id = transaction.transaction_id || transaction.transactionId || `TXN-${Date.now()}`;
            }
            
            // Show low stock alerts if any (but don't block the receipt)
            if (data.low_stock_alerts && data.low_stock_alerts.length > 0) {
              const alertMessages = data.low_stock_alerts.map(alert => 
                `⚠️ Low Stock Alert!\n${alert.product_name}\nCurrent: ${alert.current_quantity}, Minimum: ${alert.min_stock_level}`
              ).join('\n\n');
              // Show alert but continue to show receipt
              setTimeout(() => alert(alertMessages), 100);
            }
            
            // Sale successfully saved - show receipt
            setReceipt(transaction);
            setShowCheckout(false);
            // Don't clear cart immediately - let user print receipt first
            // Cart will be cleared when receipt is closed
            return;
          } else {
            // Server error - get error details
            let errorMessage = `Server error: ${response.status}`;
            try {
              const errorData = await response.json();
              errorMessage = errorData.error || errorData.message || errorMessage;
            } catch (e) {
              // Could not parse error response
            }
            throw new Error(errorMessage);
          }
        } catch (error) {
          console.error('Checkout error (online):', error);
          // Show error to user
          const errorMessage = error.message || 'Failed to save sale. Please check your connection and try again.';
          if (window.confirm(`${errorMessage}\n\nWould you like to save this sale offline and sync later?`)) {
            // User wants to save offline
            try {
              // Try to queue for sync
              await addToSyncQueue('sale', checkoutData, '/api/sales/checkout', 'POST');
              
              // Show local receipt (will sync when online)
              const localTransaction = createTransaction(null, null, true);
              localTransaction.offline = true;
              localTransaction.saved = false;
              setReceipt(localTransaction);
              setShowCheckout(false);
              alert('Sale saved offline. It will sync when internet is available.');
            } catch (queueError) {
              console.error('Failed to queue for sync:', queueError);
              alert('Failed to save sale. Please check your connection and try again.');
              // Don't show receipt if we can't save it at all
              return;
            }
          } else {
            // User cancelled - don't proceed with sale
            return;
          }
        }
      } else {
        // Offline mode - queue for sync
        try {
          await addToSyncQueue('sale', checkoutData, '/api/sales/checkout', 'POST');
          
          // Show local receipt (will sync when online)
          const localTransaction = createTransaction(null, null, true);
          localTransaction.offline = true;
          localTransaction.saved = false;
          setReceipt(localTransaction);
          setShowCheckout(false);
          alert('Sale saved offline. It will sync when internet is available.');
        } catch (queueError) {
          console.error('Failed to queue for sync:', queueError);
          alert('Failed to save sale. Please check your connection and try again.');
          // Don't show receipt if we can't save it at all
          return;
        }
      }
    } catch (error) {
      console.error('Checkout error:', error);
      // Even on error, try to show local receipt
      try {
        const { subtotal, discountAmount, taxAmount, total } = calculateTotals();
        const createTransaction = (id, txId, isOffline = false) => ({
          id: id || `local-${Date.now()}`,
          transactionId: txId || `TXN-${Date.now()}`,
          date: new Date().toISOString(),
          customer: {
            name: customerInfo?.name || 'Walk-in Customer',
            phone: customerInfo?.phone || ''
          },
          items: cart.map(item => ({
            product_name: item.product_name,
            reg_number: item.reg_number,
            quantity: item.quantity,
            price: item.price_rs,
            total: (item.quantity * item.price_rs)
          })),
          payment: {
            method: paymentMethod || 'cash',
            subtotal: subtotal,
            discount: discountAmount,
            discountPercent: discount > 0 && subtotal > 0 ? ((discountAmount / subtotal) * 100).toFixed(1) : 0,
            tax: taxAmount,
            taxPercent: tax > 0 && subtotal > 0 ? ((taxAmount / subtotal) * 100).toFixed(1) : 0,
            total: total
          },
          offline: isOffline
        });
        
        const localTransaction = createTransaction(null, null, true);
        setReceipt(localTransaction);
        setShowCheckout(false);
        alert('Sale completed (local copy). Some data may not be synced.');
      } catch (fallbackError) {
        console.error('Fallback receipt generation failed:', fallbackError);
        alert('Checkout failed. Please try again.');
      }
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


