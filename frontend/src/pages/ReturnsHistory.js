import React, { useState, useEffect } from 'react';
import './ReturnsHistory.css';
import API_BASE_URL from '../config/api';

const ReturnsHistory = ({ token, user, onBack }) => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/returns/list`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch returns');
        return;
      }

      setReturns(data.returns || []);
    } catch (err) {
      setError('Failed to fetch returns. Please check your connection.');
      console.error('Error fetching returns:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(price);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="returns-history-container">
        {onBack && (
          <button onClick={onBack} className="back-btn">← Back</button>
        )}
        <div className="loading">Loading returns...</div>
      </div>
    );
  }

  return (
    <div className="returns-history-container">
      {onBack && (
        <button onClick={onBack} className="back-btn">← Back</button>
      )}

      <div className="returns-history-header">
        <h2>📋 Returns History</h2>
        <p>View all processed returns</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {returns.length === 0 ? (
        <div className="no-returns">
          <p>No returns found</p>
        </div>
      ) : (
        <div className="returns-list">
          {returns.map((returnRecord) => (
            <div key={returnRecord.id} className="return-card">
              <div className="return-card-header">
                <div className="return-number">
                  <strong>Return #:</strong> {returnRecord.return_number}
                </div>
                <div className="return-date">
                  {formatDate(returnRecord.created_at)}
                </div>
              </div>

              <div className="return-card-body">
                <div className="return-info">
                  <p><strong>Transaction ID:</strong> {returnRecord.transaction_id}</p>
                  <p><strong>Customer:</strong> {returnRecord.customer_name || 'N/A'}</p>
                  {returnRecord.reason && (
                    <p><strong>Reason:</strong> {returnRecord.reason}</p>
                  )}
                </div>

                <div className="return-items-summary">
                  <strong>Items Returned:</strong>
                  <ul>
                    {returnRecord.items.map((item, index) => (
                      <li key={index}>
                        {item.product_name} - Qty: {item.quantity} @ {formatPrice(item.price)} = {formatPrice(item.total)}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="return-total">
                  <strong>Total Refund:</strong> {formatPrice(returnRecord.total_amount)}
                </div>

                <button
                  className="view-details-btn"
                  onClick={() => setSelectedReturn(selectedReturn === returnRecord.id ? null : returnRecord.id)}
                >
                  {selectedReturn === returnRecord.id ? 'Hide Details' : 'View Details'}
                </button>

                {selectedReturn === returnRecord.id && (
                  <div className="return-details">
                    <table className="details-table">
                      <thead>
                        <tr>
                          <th>Product Name</th>
                          <th>Quantity</th>
                          <th>Price</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnRecord.items.map((item, index) => (
                          <tr key={index}>
                            <td>{item.product_name}</td>
                            <td>{item.quantity}</td>
                            <td>{formatPrice(item.price)}</td>
                            <td>{formatPrice(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="return-card-footer">
                <span className={`status-badge status-${returnRecord.status}`}>
                  {returnRecord.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReturnsHistory;

