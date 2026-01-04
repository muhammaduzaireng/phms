import React, { useEffect } from 'react';
import './POSReceipt.css';

const POSReceipt = ({ transaction, onClose, pharmacyName, isElectron = false }) => {
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(price);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-PK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePrint = async () => {
    if (isElectron && window.electronAPI && window.electronAPI.printThermalReceipt) {
      // Electron thermal printer print
      try {
        const result = await window.electronAPI.printThermalReceipt(transaction, pharmacyName);
        if (result) {
          if (result.saved && result.filePath) {
            // Show notification about saved file location
            setTimeout(() => {
              const fileName = result.filePath.split(/[/\\]/).pop();
              alert(`Receipt saved to:\n${result.filePath}\n\n${result.message || 'Receipt saved successfully. If printer is connected, it will also be printed.'}`);
            }, 500);
          }
        }
      } catch (error) {
        alert('Error processing receipt. Please check console for details.');
      }
    } else {
      // Browser print
      window.print();
    }
  };

  // Auto-print for thermal printer in Electron mode (but don't auto-close)
  useEffect(() => {
    if (isElectron && window.electronAPI && window.electronAPI.printThermalReceipt) {
      // Auto-print when receipt is shown, but let user close manually
      handlePrint();
      // Don't auto-close - let user manually close after printing
    }
  }, [isElectron, transaction]);

  return (
    <div className="receipt-container">
      <div className="receipt-actions">
        <button className="btn-print" onClick={handlePrint}>
          🖨️ Print Receipt
        </button>
        <button className="btn-close" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="receipt" id="receipt">
        <div className="receipt-header">
          <h1 className="pharmacy-name">{pharmacyName || '💊 Pharmacy Receipt'}</h1>
          <p className="receipt-subtitle">Thank you for your purchase!</p>
        </div>

        <div className="receipt-info">
          <div className="receipt-row">
            <span>Transaction ID:</span>
            <span className="receipt-id">{transaction.id}</span>
          </div>
          <div className="receipt-row">
            <span>Date:</span>
            <span>{formatDate(transaction.date)}</span>
          </div>
          {transaction.customer.name && (
            <div className="receipt-row">
              <span>Customer:</span>
              <span>{transaction.customer.name}</span>
            </div>
          )}
          {transaction.customer.phone && (
            <div className="receipt-row">
              <span>Phone:</span>
              <span>{transaction.customer.phone}</span>
            </div>
          )}
        </div>

        <div className="receipt-items">
          <div className="receipt-items-header">
            <span>Item</span>
            <span>Qty</span>
            <span>Price</span>
            <span>Total</span>
          </div>
          {transaction.items.map((item, index) => (
            <div key={index} className="receipt-item">
              <div className="item-name">
                <strong>{item.product_name}</strong>
                <small>Reg: {item.reg_number}</small>
              </div>
              <div className="item-qty">{item.quantity}</div>
              <div className="item-price">{formatPrice(item.price)}</div>
              <div className="item-total">{formatPrice(item.total)}</div>
            </div>
          ))}
        </div>

        <div className="receipt-totals">
          <div className="receipt-total-row">
            <span>Subtotal:</span>
            <span>{formatPrice(transaction.payment.subtotal)}</span>
          </div>
          {transaction.payment.discount > 0 && (
            <div className="receipt-total-row discount">
              <span>Discount ({transaction.payment.discountPercent}%):</span>
              <span>-{formatPrice(transaction.payment.discount)}</span>
            </div>
          )}
          {transaction.payment.tax > 0 && (
            <div className="receipt-total-row">
              <span>Tax ({transaction.payment.taxPercent}%):</span>
              <span>{formatPrice(transaction.payment.tax)}</span>
            </div>
          )}
          <div className="receipt-total-row final">
            <span>Total:</span>
            <span>{formatPrice(transaction.payment.total)}</span>
          </div>
        </div>

        <div className="receipt-payment">
          <div className="receipt-row">
            <span>Payment Method:</span>
            <span className="payment-method">{transaction.payment.method.toUpperCase()}</span>
          </div>
        </div>

        <div className="receipt-footer">
          <p>Thank you for shopping with us!</p>
          <p className="receipt-footer-small">Please keep this receipt for your records</p>
        </div>
      </div>
    </div>
  );
};

export default POSReceipt;

