import React, { useState, useEffect, useRef } from 'react';
import './POS.css';
import Navigation from '../components/Navigation';
import POSInventoryTable from '../components/POS/POSInventoryTable';
import POSCart from '../components/POS/POSCart';
import POSCheckout from '../components/POS/POSCheckout';
import POSReceipt from '../components/POS/POSReceipt';
import POSAddItemPopup from '../components/POS/POSAddItemPopup';
import API_BASE_URL from '../config/api';
// Data sync only used in Electron - disabled for web
// import { addToSyncQueue } from '../services/dataSync';

const POSSession = ({ user, token, isElectron = false, onNavigate, paneLabel, onClose, compact }) => {
  const paneRef = useRef(null);
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [showAddItem, setShowAddItem] = useState(true);
  const [addItemSearch, setAddItemSearch] = useState('');

  const authToken = token || localStorage.getItem('pharmacyToken');

  useEffect(() => {
    const handleKeyPress = (e) => {
      const activePane = document.activeElement?.closest('.pos-session');
      if (activePane && paneRef.current && activePane !== paneRef.current) {
        return;
      }
      if (!activePane && onClose) {
        return;
      }

      const isInputFocused = e.target.tagName === 'INPUT' || 
                            e.target.tagName === 'TEXTAREA' ||
                            e.target.isContentEditable;
      
      if (e.key === 'Escape') {
        if (showCheckout) {
          e.preventDefault();
          setShowCheckout(false);
        } else if (showAddItem) {
          e.preventDefault();
          setShowAddItem(false);
        }
        if (receipt) {
          e.preventDefault();
          setReceipt(null);
        }
        return;
      }

      if (e.key === 'F1') {
        e.preventDefault();
        setShowAddItem(true);
        return;
      }

      const isTypingKey = /^[a-zA-Z0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey;
      const inAddPopup = e.target.closest?.('.add-item-modal');
      if (
        isTypingKey &&
        !showCheckout &&
        !receipt &&
        !showAddItem &&
        !isInputFocused
      ) {
        e.preventDefault();
        setAddItemSearch(e.key);
        setShowAddItem(true);
        return;
      }
      if (
        isTypingKey &&
        showAddItem &&
        !inAddPopup &&
        !isInputFocused &&
        !showCheckout
      ) {
        e.preventDefault();
        setAddItemSearch((prev) => prev + e.key);
        return;
      }

      if (isInputFocused && !e.ctrlKey && !e.altKey && e.key !== 'Escape') {
        return;
      }

      // F2 - Open checkout (if cart has items)
      if (e.key === 'F2') {
        e.preventDefault();
        if (cart.length > 0 && !showCheckout) {
          setShowAddItem(false);
          setShowCheckout(true);
        }
      }

      // F3 - Clear cart
      if (e.key === 'F3') {
        e.preventDefault();
        if (cart.length > 0) {
          clearCart();
        }
      }

      // Ctrl+Enter - Quick checkout (complete sale)
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        if (cart.length > 0 && !showCheckout) {
          setShowAddItem(false);
          setShowCheckout(true);
        } else if (showCheckout) {
          const checkoutBtn = paneRef.current?.querySelector('.btn-confirm, .checkout-button');
          if (checkoutBtn) checkoutBtn.click();
        }
      }

      // Tab - Navigate between sections (when not in input)
      if (e.key === 'Tab' && !isInputFocused) {
        // Let default tab behavior work
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [cart, showCheckout, receipt, showAddItem, onClose]);

  const addToCart = (medicine, quantity = 1) => {
    const qtyToAdd = Math.max(1, parseInt(quantity, 10) || 1);
    const existingItem = cart.find(item => item.reg_number === medicine.reg_number);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.reg_number === medicine.reg_number
          ? { ...item, quantity: item.quantity + qtyToAdd }
          : item
      ));
    } else {
      setCart([...cart, {
        ...medicine,
        quantity: qtyToAdd
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
          reg_number: item.reg_number && !item.reg_number.startsWith('CUST-') ? item.reg_number : null,
          customProductId: item.custom_product_id || (item.reg_number && item.reg_number.startsWith('CUST-') ? parseInt(item.reg_number.replace('CUST-', '')) : null),
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
            
            // Low stock alerts are tracked but not shown as alerts (user doesn't want alerts)
            // They can check stock management page for low stock items
            
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
          // Show error to user - data sync removed from web version
          // Just show error, don't attempt offline sync
          console.error('Checkout error:', error.message);
          // Don't show receipt on error - user needs to retry when online
          return;
        }
      } else {
        // Offline mode - data sync removed from web version
        // User must be online to complete checkout
        console.error('Cannot complete checkout offline - data sync disabled for web');
        return;
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
        // No alert - user doesn't want alerts
      } catch (fallbackError) {
        console.error('Fallback receipt generation failed:', fallbackError);
        // Checkout failed - silently fail, don't show receipt
      }
    }
  };

  const closeReceipt = () => {
    setReceipt(null);
    clearCart();
    setShowAddItem(true);
    setAddItemSearch('');
  };

  if (receipt) {
    return (
      <div className="pos-session" ref={paneRef} tabIndex={-1}>
        <POSReceipt 
          transaction={receipt} 
          onClose={closeReceipt}
          pharmacyName={user?.pharmacyName || user?.username}
          isElectron={isElectron}
        />
      </div>
    );
  }

  return (
    <div className={`pos-session ${compact ? 'is-compact' : ''}`} ref={paneRef} tabIndex={-1}>
      <div className="pos-header">
        <h1>💊 {paneLabel || 'Point of Sale'}</h1>
        <div className="pos-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="keyboard-shortcuts-hint" style={{
            fontSize: '0.85rem',
            color: '#666',
            padding: '6px 12px',
            background: '#f0f0f0',
            borderRadius: '6px'
          }}>
            ⌨️ <strong>Shortcuts:</strong> F1=Add item • F2=Checkout • F3=Clear • Enter=Add in popup
          </div>
          <button
            type="button"
            className="btn-add-item"
            onClick={() => setShowAddItem(true)}
            title="Add product (F1)"
          >
            + Add item (F1)
          </button>
          {!isElectron && onNavigate && (
            <button 
              className="btn-secondary" 
              onClick={() => onNavigate('returns')}
              title="Process Customer Returns"
            >
              ↩️ Returns
            </button>
          )}
          <button 
            className="btn-secondary" 
            onClick={clearCart} 
            disabled={cart.length === 0}
            title="Clear Cart (F3)"
          >
            Clear Cart (F3)
          </button>
          {onClose && (
            <button
              type="button"
              className="btn-secondary pos-close-pane"
              onClick={onClose}
              title="Close this POS window"
            >
              ✕ Close
            </button>
          )}
        </div>
      </div>

      <div className="pos-main has-inventory">
        <div className="pos-middle">
          <POSInventoryTable 
            searchTerm=""
            onAddToCart={(product) => {
              addToCart(product, 1);
              setShowAddItem(true);
            }}
            token={authToken}
            cart={cart}
          />
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
            onCheckout={() => {
              setShowAddItem(false);
              setShowCheckout(true);
            }}
          />
        </div>
      </div>

      {showAddItem && !showCheckout && (
        <POSAddItemPopup
          token={authToken}
          searchTerm={addItemSearch}
          onSearchTermChange={setAddItemSearch}
          onAddToCart={addToCart}
          onClose={() => setShowAddItem(false)}
        />
      )}

      {showCheckout && (
        <POSCheckout
          totals={calculateTotals()}
          onCheckout={handleCheckout}
          onCancel={() => {
            setShowCheckout(false);
            setShowAddItem(true);
            setAddItemSearch('');
          }}
        />
      )}
    </div>
  );
};

const POS = ({ onNavigate, user, token, onLogout, isElectron = false }) => {
  const [paneIds, setPaneIds] = useState(['main']);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('phmsOpenExtraPos') === '1') {
        sessionStorage.removeItem('phmsOpenExtraPos');
        setPaneIds((ids) => (ids.length >= 2 ? ids : [...ids, `pos-${Date.now()}`]));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const addPane = () => {
    setPaneIds((ids) => {
      if (ids.length >= 2) return ids;
      return [...ids, `pos-${Date.now()}`];
    });
  };

  const closePane = (id) => {
    setPaneIds((ids) => (ids.length <= 1 ? ids : ids.filter((paneId) => paneId !== id)));
  };

  const split = paneIds.length > 1;

  return (
    <div className={`pos-workspace ${split ? 'is-split' : ''}`}>
      {!isElectron && onNavigate && (
        <Navigation
          currentPage="pos"
          onNavigate={onNavigate}
          user={user}
          onLogout={onLogout}
          onOpenPosWindow={addPane}
          posWindowsFull={paneIds.length >= 2}
        />
      )}
      {user && (isElectron || !onNavigate) && (
        <div className="pos-user-info">
          <span>🏥 {user.pharmacyName || user.username}</span>
          {onLogout && <button className="logout-btn" onClick={onLogout}>Logout</button>}
        </div>
      )}
      <div className="pos-panes">
        {paneIds.map((id, index) => (
          <POSSession
            key={id}
            user={user}
            token={token}
            isElectron={isElectron}
            onNavigate={onNavigate}
            paneLabel={split ? `POS ${index + 1}` : 'Point of Sale (POS)'}
            compact={split}
            onClose={index === 0 ? null : () => closePane(id)}
          />
        ))}
      </div>
    </div>
  );
};

export default POS;


