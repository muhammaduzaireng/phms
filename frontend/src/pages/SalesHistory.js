import React, { useState, useEffect } from 'react';
import './SalesHistory.css';
import Navigation from '../components/Navigation';
import API_BASE_URL from '../config/api';

const SalesHistory = ({ onNavigate }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, [filters]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('limit', '100');

      const response = await fetch(`${API_BASE_URL}/api/pos/transactions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`${API_BASE_URL}/api/pos/sales-stats?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="sales-history-container">
        <div className="loading">Loading sales history...</div>
      </div>
    );
  }

  return (
    <div className="sales-history-container">
      <Navigation currentPage="sales" onNavigate={onNavigate} />
      <div className="sales-header">
        <h1>📊 Sales History</h1>
        <div className="date-filters">
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            placeholder="Start Date"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            placeholder="End Date"
          />
          <button onClick={() => setFilters({ startDate: '', endDate: '' })}>
            Clear Filters
          </button>
        </div>
      </div>

      {stats && (
        <div className="sales-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.totalTransactions}</div>
            <div className="stat-label">Total Transactions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatPrice(stats.totalRevenue)}</div>
            <div className="stat-label">Total Revenue</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalItemsSold}</div>
            <div className="stat-label">Items Sold</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatPrice(stats.averageTransactionValue)}</div>
            <div className="stat-label">Avg. Transaction</div>
          </div>
        </div>
      )}

      <div className="transactions-list">
        {transactions.length === 0 ? (
          <div className="empty-state">
            <p>No transactions found</p>
          </div>
        ) : (
          transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="transaction-card"
              onClick={() => setSelectedTransaction(transaction)}
            >
              <div className="transaction-header">
                <div>
                  <strong>{transaction.id}</strong>
                  <span className="transaction-date">{formatDate(transaction.date)}</span>
                </div>
                <div className="transaction-total">{formatPrice(transaction.payment.total)}</div>
              </div>
              <div className="transaction-details">
                <span>Items: {transaction.items.length}</span>
                <span>Customer: {transaction.customer.name}</span>
                <span>Payment: {transaction.payment.method.toUpperCase()}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedTransaction && (
        <div className="transaction-modal" onClick={() => setSelectedTransaction(null)}>
          <div className="transaction-detail" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Transaction Details</h2>
              <button onClick={() => setSelectedTransaction(null)}>×</button>
            </div>
            <div className="modal-content">
              <div className="detail-section">
                <h3>Transaction Info</h3>
                <p><strong>ID:</strong> {selectedTransaction.id}</p>
                <p><strong>Date:</strong> {formatDate(selectedTransaction.date)}</p>
                <p><strong>Customer:</strong> {selectedTransaction.customer.name}</p>
                {selectedTransaction.customer.phone && (
                  <p><strong>Phone:</strong> {selectedTransaction.customer.phone}</p>
                )}
              </div>
              <div className="detail-section">
                <h3>Items</h3>
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransaction.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.product_name}</td>
                        <td>{item.quantity}</td>
                        <td>{formatPrice(item.price)}</td>
                        <td>{formatPrice(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="detail-section">
                <h3>Payment</h3>
                <p><strong>Subtotal:</strong> {formatPrice(selectedTransaction.payment.subtotal)}</p>
                {selectedTransaction.payment.discount > 0 && (
                  <p><strong>Discount:</strong> -{formatPrice(selectedTransaction.payment.discount)}</p>
                )}
                {selectedTransaction.payment.tax > 0 && (
                  <p><strong>Tax:</strong> {formatPrice(selectedTransaction.payment.tax)}</p>
                )}
                <p className="final-total"><strong>Total:</strong> {formatPrice(selectedTransaction.payment.total)}</p>
                <p><strong>Method:</strong> {selectedTransaction.payment.method.toUpperCase()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;

