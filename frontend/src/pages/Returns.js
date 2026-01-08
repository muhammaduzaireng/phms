import React, { useState } from 'react';
import './Returns.css';
import API_BASE_URL from '../config/api';

const Returns = ({ token, user, onBack }) => {
  const [transactionId, setTransactionId] = useState('');
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [returnItems, setReturnItems] = useState({}); // { sale_item_id: return_quantity }
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [returnSuccess, setReturnSuccess] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!transactionId.trim()) {
      setError('Please enter a transaction ID');
      return;
    }

    setLoading(true);
    setError(null);
    setTransaction(null);
    setReturnItems({});

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/returns/transaction/${transactionId.trim()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Transaction not found');
        return;
      }

      setTransaction(data.transaction);
      // Initialize return quantities to 0
      const initialReturnItems = {};
      data.transaction.items.forEach(item => {
        initialReturnItems[item.sale_item_id] = 0;
      });
      setReturnItems(initialReturnItems);
    } catch (err) {
      setError('Failed to fetch transaction. Please check your connection.');
      console.error('Error fetching transaction:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (saleItemId, value) => {
    const item = transaction.items.find(i => i.sale_item_id === saleItemId);
    if (!item) return;

    const numValue = parseInt(value) || 0;
    const maxReturnable = item.available_to_return;

    if (numValue < 0) {
      setReturnItems({ ...returnItems, [saleItemId]: 0 });
    } else if (numValue > maxReturnable) {
      setReturnItems({ ...returnItems, [saleItemId]: maxReturnable });
    } else {
      setReturnItems({ ...returnItems, [saleItemId]: numValue });
    }
  };

  const handleProcessReturn = async () => {
    // Check if at least one item has return quantity > 0
    const itemsToReturn = Object.entries(returnItems)
      .filter(([id, qty]) => qty > 0)
      .map(([saleItemId, returnQuantity]) => ({
        sale_item_id: parseInt(saleItemId),
        return_quantity: returnQuantity
      }));

    if (itemsToReturn.length === 0) {
      setError('Please select at least one item to return');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/returns/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transactionId: transaction.transaction_id,
          items: itemsToReturn,
          reason: reason.trim() || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to process return');
        return;
      }

      setReturnSuccess(data.return);
      setTransaction(null);
      setReturnItems({});
      setReason('');
      setTransactionId('');

      // Auto-clear success message after 5 seconds
      setTimeout(() => {
        setReturnSuccess(null);
      }, 5000);
    } catch (err) {
      setError('Failed to process return. Please check your connection.');
      console.error('Error processing return:', err);
    } finally {
      setProcessing(false);
    }
  };

  const calculateReturnTotal = () => {
    let total = 0;
    Object.entries(returnItems).forEach(([saleItemId, qty]) => {
      if (qty > 0) {
        const item = transaction.items.find(i => i.sale_item_id === parseInt(saleItemId));
        if (item) {
          total += item.price * qty;
        }
      }
    });
    return total;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(price);
  };

  return (
    <div className="returns-container">
      {onBack && (
        <button onClick={onBack} className="back-btn">← Back to POS</button>
      )}
      
      <div className="returns-header">
        <h2>🔄 Product Returns</h2>
        <p>Enter the bill/transaction number to process a return</p>
      </div>

      {returnSuccess && (
        <div className="success-message">
          <h3>✅ Return Processed Successfully!</h3>
          <p><strong>Return Number:</strong> {returnSuccess.return_number}</p>
          <p><strong>Total Refund:</strong> {formatPrice(returnSuccess.total_amount)}</p>
          <p><strong>Date:</strong> {new Date(returnSuccess.return_date).toLocaleDateString()}</p>
          <button onClick={() => setReturnSuccess(null)} className="close-success-btn">Close</button>
        </div>
      )}

      <form onSubmit={handleSearch} className="search-transaction-form">
        <div className="form-group">
          <label>Transaction / Bill Number</label>
          <div className="search-input-group">
            <input
              type="text"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
              placeholder="Enter transaction ID (e.g., TXN-1234567890)"
              className="transaction-input"
              disabled={loading}
            />
            <button type="submit" className="search-btn" disabled={loading}>
              {loading ? 'Searching...' : '🔍 Search'}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {transaction && (
        <div className="transaction-details">
          <div className="transaction-header">
           
           
              <p><strong>Transaction ID:</strong> {transaction.transaction_id}</p>
              <p><strong>Date:</strong> {new Date(transaction.date).toLocaleString()}</p>
              <p><strong>Customer:</strong> {transaction.customer.name}</p>
              {transaction.customer.phone && (
                <p><strong>Phone:</strong> {transaction.customer.phone}</p>
              )}
            
          </div>

          <div className="return-items-section">
            <h3>Select Items to Return</h3>
            <table className="return-items-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Original Qty</th>
                  <th>Already Returned</th>
                  <th>Available to Return</th>
                  <th>Original Price</th>
                  <th>Return Qty</th>
                  <th>Refund Amount</th>
                </tr>
              </thead>
              <tbody>
                {transaction.items.map((item) => (
                  <tr key={item.sale_item_id} className={item.available_to_return === 0 ? 'no-return-available' : ''}>
                    <td>{item.product_name}</td>
                    <td>{item.quantity}</td>
                    <td>{item.returned_quantity || 0}</td>
                    <td>
                      <span className={item.available_to_return === 0 ? 'unavailable' : 'available'}>
                        {item.available_to_return}
                      </span>
                    </td>
                    <td>{formatPrice(item.price)}</td>
                    <td>
                      {item.available_to_return > 0 ? (
                        <input
                          type="number"
                          min="0"
                          max={item.available_to_return}
                          value={returnItems[item.sale_item_id] || 0}
                          onChange={(e) => handleQuantityChange(item.sale_item_id, e.target.value)}
                          className="return-qty-input"
                        />
                      ) : (
                        <span className="cannot-return">Already Returned</span>
                      )}
                    </td>
                    <td>
                      {formatPrice((returnItems[item.sale_item_id] || 0) * item.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="return-summary">
              <div className="reason-input">
                <label>Return Reason (Optional)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter reason for return..."
                  rows="3"
                  className="reason-textarea"
                />
              </div>

              <div className="total-section">
                <div className="total-row">
                  <span className="total-label">Total Refund Amount:</span>
                  <span className="total-amount">{formatPrice(calculateReturnTotal())}</span>
                </div>
              </div>

              <button
                onClick={handleProcessReturn}
                disabled={processing || calculateReturnTotal() === 0}
                className="process-return-btn"
              >
                {processing ? 'Processing Return...' : 'Process Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Returns;

