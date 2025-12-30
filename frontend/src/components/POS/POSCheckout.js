import React, { useState } from 'react';
import './POSCheckout.css';

const POSCheckout = ({ totals, onCheckout, onCancel }) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState(totals.total.toFixed(2));
  const [errors, setErrors] = useState({});

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(price);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (paymentMethod === 'cash') {
      const paid = parseFloat(amountPaid);
      if (isNaN(paid) || paid < totals.total) {
        newErrors.amountPaid = `Amount must be at least ${formatPrice(totals.total)}`;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onCheckout(
      {
        name: customerName || 'Walk-in Customer',
        phone: customerPhone
      },
      paymentMethod
    );
  };

  const change = paymentMethod === 'cash' && amountPaid 
    ? (parseFloat(amountPaid) - totals.total).toFixed(2)
    : 0;

  return (
    <div className="checkout-overlay">
      <div className="checkout-modal">
        <div className="checkout-header">
          <h2>Checkout</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>

        <div className="checkout-content">
          <div className="checkout-summary">
            <h3>Order Summary</h3>
            <div className="summary-row">
              <span>Subtotal:</span>
              <span>{formatPrice(totals.subtotal)}</span>
            </div>
            {totals.discountAmount > 0 && (
              <div className="summary-row discount">
                <span>Discount:</span>
                <span>-{formatPrice(totals.discountAmount)}</span>
              </div>
            )}
            {totals.taxAmount > 0 && (
              <div className="summary-row">
                <span>Tax:</span>
                <span>{formatPrice(totals.taxAmount)}</span>
              </div>
            )}
            <div className="summary-row total">
              <span>Total:</span>
              <span>{formatPrice(totals.total)}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="checkout-form">
            <div className="form-group">
              <label>Customer Name (Optional)</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in Customer"
              />
            </div>

            <div className="form-group">
              <label>Customer Phone (Optional)</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone number"
              />
            </div>

            <div className="form-group">
              <label>Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  if (e.target.value === 'cash') {
                    setAmountPaid(totals.total.toFixed(2));
                  }
                }}
                required
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_payment">Mobile Payment</option>
              </select>
            </div>

            {paymentMethod === 'cash' && (
              <div className="form-group">
                <label>Amount Paid *</label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  step="0.01"
                  min={totals.total}
                  required
                />
                {errors.amountPaid && (
                  <span className="error-message">{errors.amountPaid}</span>
                )}
                {change > 0 && (
                  <div className="change-amount">
                    Change: {formatPrice(change)}
                  </div>
                )}
              </div>
            )}

            <div className="checkout-actions">
              <button type="button" className="btn-cancel" onClick={onCancel}>
                Cancel
              </button>
              <button type="submit" className="btn-confirm">
                Complete Sale
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default POSCheckout;

