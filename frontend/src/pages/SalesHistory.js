import React, { useState, useEffect } from 'react';
import './SalesHistory.css';
import Navigation from '../components/Navigation';
import API_BASE_URL from '../config/api';

const SalesHistory = ({ onNavigate, user, token }) => {
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
      const authToken = token || localStorage.getItem('pharmacyToken');
      
      if (!authToken) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('limit', '100');

      const response = await fetch(`${API_BASE_URL}/api/pos/transactions?${params}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || data.sales || []);
      } else if (response.status === 401) {
        // Handle unauthorized
        setTransactions([]);
      }
    } catch (err) {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const authToken = token || localStorage.getItem('pharmacyToken');
      
      if (!authToken) {
        setStats(null);
        return;
      }

      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`${API_BASE_URL}/api/pos/sales-stats?${params}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      setStats(null);
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

  const handlePrintReceipt = (transaction) => {
    // Convert transaction to receipt format and print
    const receiptData = {
      id: transaction.id || transaction.transaction_id || transaction.sale_id,
      transaction_id: transaction.id || transaction.transaction_id || transaction.sale_id,
      date: transaction.date || transaction.created_at || transaction.sale_date,
      created_at: transaction.date || transaction.created_at || transaction.sale_date,
      customer: transaction.customer || {
        name: transaction.customer_name || 'Walk-in Customer',
        phone: transaction.customer_phone || null
      },
      items: transaction.items || [],
      payment: transaction.payment || {
        method: transaction.payment_method || 'cash',
        subtotal: transaction.subtotal || transaction.subtotal_amount || 0,
        discount: transaction.discount_amount || 0,
        tax: transaction.tax_amount || 0,
        total: transaction.total || transaction.total_amount || 0
      }
    };

    // If Electron, use electron API to print
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.printThermalReceipt) {
      const user = JSON.parse(localStorage.getItem('pharmacyUser') || '{}');
      const pharmacyName = user.pharmacy_name || user.pharmacyName || user.username || 'Pharmacy';
      window.electronAPI.printThermalReceipt(receiptData, pharmacyName);
    } else {
      // For web, create a new window with receipt HTML and print
      const receiptWindow = window.open('', '_blank', 'width=400,height=600');
      if (receiptWindow) {
        receiptWindow.document.write(generateReceiptHTML(receiptData));
        receiptWindow.document.close();
        setTimeout(() => {
          receiptWindow.print();
          // Close the window after printing (browser dependent)
          setTimeout(() => {
            receiptWindow.close();
          }, 500);
        }, 250);
      }
    }
  };

  const generateReceiptHTML = (transaction) => {
    const user = JSON.parse(localStorage.getItem('pharmacyUser') || '{}');
    const pharmacyName = user.pharmacy_name || user.pharmacyName || user.username || 'Pharmacy';
    
    return `<!DOCTYPE html>
<html>
<head>
  <title>Receipt - ${transaction.id}</title>
  <style>
    body {
      font-family: 'Courier New', monospace;
      width: 80mm;
      margin: 0;
      padding: 5px;
      font-size: 10px;
      line-height: 1.2;
    }
    .header {
      text-align: center;
      margin-bottom: 5px;
      border-bottom: 1px dashed #000;
      padding-bottom: 5px;
    }
    .header h2 {
      margin: 3px 0;
      font-size: 14px;
    }
    .info {
      margin: 3px 0;
    }
    .items {
      margin: 5px 0;
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      padding: 5px 0;
    }
    .item {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
    }
    .total {
      margin-top: 5px;
      border-top: 1px dashed #000;
      padding-top: 5px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
    }
    .final-total {
      font-weight: bold;
      font-size: 12px;
      margin-top: 5px;
    }
    .footer {
      text-align: center;
      margin-top: 10px;
      font-size: 9px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>${pharmacyName}</h2>
    <div>Receipt #${transaction.id || transaction.transaction_id}</div>
    <div>${formatDate(transaction.date || transaction.created_at)}</div>
  </div>
  <div class="info">
    <div><strong>Customer:</strong> ${transaction.customer?.name || transaction.customer_name || 'Walk-in'}</div>
    ${transaction.customer?.phone || transaction.customer_phone ? `<div><strong>Phone:</strong> ${transaction.customer?.phone || transaction.customer_phone}</div>` : ''}
  </div>
  <div class="items">
    ${(transaction.items || []).map(item => `
      <div class="item">
        <div>
          <div><strong>${item.product_name || item.item_name || item.name}</strong></div>
          <div>${item.quantity || item.qty} x ${formatPrice(item.price || item.unit_price || 0)}</div>
        </div>
        <div>${formatPrice(item.total || item.subtotal || ((item.quantity || item.qty || 0) * (item.price || item.unit_price || 0)))}</div>
      </div>
    `).join('')}
  </div>
  <div class="total">
    <div class="total-row">
      <span>Subtotal:</span>
      <span>${formatPrice(transaction.payment?.subtotal || transaction.subtotal || 0)}</span>
    </div>
    ${(transaction.payment?.discount || transaction.discount_amount) > 0 ? `
      <div class="total-row">
        <span>Discount:</span>
        <span>-${formatPrice(transaction.payment?.discount || transaction.discount_amount)}</span>
      </div>
    ` : ''}
    ${(transaction.payment?.tax || transaction.tax_amount) > 0 ? `
      <div class="total-row">
        <span>Tax:</span>
        <span>${formatPrice(transaction.payment?.tax || transaction.tax_amount)}</span>
      </div>
    ` : ''}
    <div class="total-row final-total">
      <span>Total:</span>
      <span>${formatPrice(transaction.payment?.total || transaction.total || transaction.total_amount || 0)}</span>
    </div>
    <div class="total-row">
      <span>Payment:</span>
      <span>${(transaction.payment?.method || transaction.payment_method || 'cash').toUpperCase()}</span>
    </div>
  </div>
  <div class="footer">
    <div>Thank you for your business!</div>
    <div>Visit us again</div>
  </div>
</body>
</html>`;
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
              key={transaction.id || transaction.sale_id}
              className="transaction-card"
              onClick={() => setSelectedTransaction(transaction)}
            >
              <div className="transaction-header">
                <div>
                  <strong>#{transaction.id || transaction.transaction_id || transaction.sale_id || 'N/A'}</strong>
                  <span className="transaction-date">
                    {formatDate(transaction.date || transaction.created_at || transaction.sale_date)}
                  </span>
                </div>
                <div className="transaction-total">
                  {formatPrice(
                    transaction.payment?.total || 
                    transaction.total_amount || 
                    transaction.total || 
                    0
                  )}
                </div>
              </div>
              <div className="transaction-details">
                <span>
                  Items: {transaction.items?.length || transaction.items_count || 0}
                </span>
                <span>
                  Customer: {transaction.customer?.name || transaction.customer_name || 'Walk-in'}
                </span>
                <span>
                  Payment: {(transaction.payment?.method || transaction.payment_method || 'cash').toUpperCase()}
                </span>
              </div>
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrintReceipt(transaction);
                  }}
                  style={{
                    padding: '6px 12px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  🖨️ Print Receipt
                </button>
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
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button 
                  onClick={() => handlePrintReceipt(selectedTransaction)}
                  style={{
                    padding: '8px 16px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  🖨️ Print Receipt
                </button>
                <button onClick={() => setSelectedTransaction(null)}>×</button>
              </div>
            </div>
            <div className="modal-content">
              <div className="detail-section">
                <h3>Transaction Info</h3>
                <p><strong>ID:</strong> {selectedTransaction.id || selectedTransaction.transaction_id || selectedTransaction.sale_id || 'N/A'}</p>
                <p><strong>Date:</strong> {
                  formatDate(
                    selectedTransaction.date || 
                    selectedTransaction.created_at || 
                    selectedTransaction.sale_date ||
                    new Date()
                  )
                }</p>
                <p><strong>Customer:</strong> {
                  selectedTransaction.customer?.name || 
                  selectedTransaction.customer_name || 
                  'Walk-in'
                }</p>
                {(selectedTransaction.customer?.phone || selectedTransaction.customer_phone) && (
                  <p><strong>Phone:</strong> {
                    selectedTransaction.customer?.phone || 
                    selectedTransaction.customer_phone
                  }</p>
                )}
              </div>
              <div className="detail-section">
                <h3>Items</h3>
                {selectedTransaction.items && selectedTransaction.items.length > 0 ? (
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
                          <td>{item.product_name || item.item_name || item.name || 'Unknown'}</td>
                          <td>{item.quantity || item.qty || 0}</td>
                          <td>{formatPrice(item.price || item.unit_price || 0)}</td>
                          <td>{formatPrice(item.total || item.subtotal || ((item.quantity || item.qty || 0) * (item.price || item.unit_price || 0)))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No items found</p>
                )}
              </div>
              <div className="detail-section">
                <h3>Payment</h3>
                <p><strong>Subtotal:</strong> {
                  formatPrice(
                    selectedTransaction.payment?.subtotal || 
                    selectedTransaction.subtotal || 
                    selectedTransaction.subtotal_amount ||
                    0
                  )
                }</p>
                {(selectedTransaction.payment?.discount || selectedTransaction.discount_amount) > 0 && (
                  <p><strong>Discount:</strong> -{
                    formatPrice(
                      selectedTransaction.payment?.discount || 
                      selectedTransaction.discount_amount || 
                      0
                    )
                  }</p>
                )}
                {(selectedTransaction.payment?.tax || selectedTransaction.tax_amount) > 0 && (
                  <p><strong>Tax:</strong> {
                    formatPrice(
                      selectedTransaction.payment?.tax || 
                      selectedTransaction.tax_amount || 
                      0
                    )
                  }</p>
                )}
                <p className="final-total"><strong>Total:</strong> {
                  formatPrice(
                    selectedTransaction.payment?.total || 
                    selectedTransaction.total_amount || 
                    selectedTransaction.total || 
                    0
                  )
                }</p>
                <p><strong>Method:</strong> {
                  (selectedTransaction.payment?.method || 
                   selectedTransaction.payment_method || 
                   'cash'
                  ).toUpperCase()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;

