import React, { useState, useEffect } from 'react';
import './SalesHistory.css';
import Navigation from '../components/Navigation';
import API_BASE_URL from '../config/api';

const SalesHistory = ({ onNavigate, user, token }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [transactionItems, setTransactionItems] = useState({}); // Cache items by transaction ID
  const [loadingItems, setLoadingItems] = useState({}); // Track loading state for items
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState(''); // Search by transaction ID
  
  // Default to today's date
  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState({
    startDate: today,
    endDate: today
  });
  const [showDateFilter, setShowDateFilter] = useState(false);

  useEffect(() => {
    setPage(1); // Reset to page 1 when filters change
    fetchTransactions();
    fetchStats();
  }, [filters]);

  useEffect(() => {
    fetchTransactions();
  }, [page]);

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
      params.append('page', page.toString());
      params.append('limit', '30'); // Reduced limit for faster loading

      const response = await fetch(`${API_BASE_URL}/api/sales/transactions?${params}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || data.sales || []);
        setTotalPages(data.totalPages || 1);
        // Clear cached items when changing date range or page
        setTransactionItems({});
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

  // Lazy load items when transaction is selected
  const handleTransactionSelect = async (transaction) => {
    setSelectedTransaction(transaction);
    
    // If items already cached, use them
    if (transactionItems[transaction.id]) {
      return;
    }

    // Load items from API
    try {
      setLoadingItems(prev => ({ ...prev, [transaction.id]: true }));
      const authToken = token || localStorage.getItem('pharmacyToken');
      
      const response = await fetch(`${API_BASE_URL}/api/sales/transaction/${transaction.sale_id}/items`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTransactionItems(prev => ({
          ...prev,
          [transaction.id]: data.items || []
        }));
      }
    } catch (err) {
      console.error('Error loading transaction items:', err);
    } finally {
      setLoadingItems(prev => {
        const newState = { ...prev };
        delete newState[transaction.id];
        return newState;
      });
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

      const response = await fetch(`${API_BASE_URL}/api/sales/sales-stats?${params}`, {
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
    ${(transaction.items || []).map(item => {
      const itemName = item.product_name || item.item_name || item.name || 'Product';
      const regNumber = item.reg_number || item.regNumber || '';
      const qty = item.quantity || item.qty || 0;
      const price = item.price || item.unit_price || 0;
      const total = item.total || item.subtotal || (qty * price);
      const displayName = regNumber ? `${itemName} (${regNumber})` : itemName;
      return `
      <div class="item">
        <div><strong>${displayName}</strong> - Qty: ${qty} x ${formatPrice(price)}</div>
        <div>${formatPrice(total)}</div>
      </div>
    `;
    }).join('')}
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

  // Filter transactions based on search term
  const filteredTransactions = transactions.filter(transaction => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    const transactionId = (transaction.id || transaction.transaction_id || transaction.sale_id || '').toString().toLowerCase();
    const customerName = (transaction.customer?.name || transaction.customer_name || '').toLowerCase();
    
    return transactionId.includes(searchLower) || customerName.includes(searchLower);
  });

  // Skeleton loader component
  const SkeletonCard = () => (
    <div className="transaction-card" style={{ opacity: 0.6 }}>
      <div className="transaction-header">
        <div>
          <div style={{ width: '150px', height: '20px', background: '#e0e0e0', borderRadius: '4px', marginBottom: '8px' }}></div>
          <div style={{ width: '120px', height: '16px', background: '#e0e0e0', borderRadius: '4px' }}></div>
        </div>
        <div style={{ width: '100px', height: '24px', background: '#e0e0e0', borderRadius: '4px' }}></div>
      </div>
      <div className="transaction-details" style={{ marginTop: '12px' }}>
        <div style={{ width: '80px', height: '16px', background: '#e0e0e0', borderRadius: '4px', display: 'inline-block', marginRight: '15px' }}></div>
        <div style={{ width: '120px', height: '16px', background: '#e0e0e0', borderRadius: '4px', display: 'inline-block', marginRight: '15px' }}></div>
        <div style={{ width: '100px', height: '16px', background: '#e0e0e0', borderRadius: '4px', display: 'inline-block' }}></div>
      </div>
    </div>
  );

  return (
    <div className="sales-history-container">
      <Navigation currentPage="sales" onNavigate={onNavigate} />
      <div className="sales-header">
        <h1>📊 Sales History</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1', minWidth: '250px', maxWidth: '400px' }}>
            <input
              type="text"
              placeholder="🔍 Search by Transaction ID or Customer Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 40px 10px 12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#999',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
          
          <div style={{ fontSize: '14px', color: '#666', whiteSpace: 'nowrap' }}>
            Showing: {filters.startDate === filters.endDate 
              ? new Date(filters.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : `${new Date(filters.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(filters.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
            }
          </div>
          <button 
            onClick={() => setShowDateFilter(!showDateFilter)}
            style={{
              padding: '8px 16px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              whiteSpace: 'nowrap'
            }}
          >
            {showDateFilter ? 'Hide' : 'Change'} Date
          </button>
          {filters.startDate !== today && (
            <button 
              onClick={() => {
                setFilters({ startDate: today, endDate: today });
                setShowDateFilter(false);
              }}
              style={{
                padding: '8px 16px',
                background: '#48bb78',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                whiteSpace: 'nowrap'
              }}
            >
              Today
            </button>
          )}
        </div>
        {showDateFilter && (
          <div className="date-filters" style={{ marginTop: '15px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-end' }}>
                <button 
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setFilters({ startDate: today, endDate: today });
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#48bb78',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Today
                </button>
                <button 
                  onClick={() => {
                    const today = new Date();
                    const weekAgo = new Date(today);
                    weekAgo.setDate(today.getDate() - 7);
                    setFilters({ 
                      startDate: weekAgo.toISOString().split('T')[0], 
                      endDate: today.toISOString().split('T')[0] 
                    });
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#4299e1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Last 7 Days
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {stats && (
        <div className="sales-stats" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          <div className="stat-card" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '24px',
            borderRadius: '12px',
            color: 'white',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div className="stat-value" style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>{stats.totalTransactions}</div>
            <div className="stat-label" style={{ fontSize: '14px', opacity: 0.9 }}>Total Transactions</div>
          </div>
          <div className="stat-card" style={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            padding: '24px',
            borderRadius: '12px',
            color: 'white',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div className="stat-value" style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>{formatPrice(stats.totalRevenue)}</div>
            <div className="stat-label" style={{ fontSize: '14px', opacity: 0.9 }}>Total Revenue</div>
          </div>
          <div className="stat-card" style={{
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            padding: '24px',
            borderRadius: '12px',
            color: 'white',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div className="stat-value" style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>{stats.totalItemsSold}</div>
            <div className="stat-label" style={{ fontSize: '14px', opacity: 0.9 }}>Items Sold</div>
          </div>
          <div className="stat-card" style={{
            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            padding: '24px',
            borderRadius: '12px',
            color: 'white',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div className="stat-value" style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>{formatPrice(stats.averageTransactionValue)}</div>
            <div className="stat-label" style={{ fontSize: '14px', opacity: 0.9 }}>Avg. Transaction</div>
          </div>
        </div>
      )}

      <div className="transactions-list">
        {loading ? (
          <>
            {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
          </>
        ) : filteredTransactions.length === 0 ? (
          <div className="empty-state" style={{ 
            padding: '60px 20px', 
            textAlign: 'center',
            background: '#f9fafb',
            borderRadius: '12px',
            marginTop: '20px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '8px' }}>
              {searchTerm ? 'No transactions found matching your search' : 'No transactions found'}
            </p>
            <p style={{ fontSize: '14px', color: '#9ca3af' }}>
              {searchTerm 
                ? `No transactions match "${searchTerm}". Try a different search term.`
                : filters.startDate === today 
                  ? "No sales today yet. Start making sales to see them here!"
                  : `No transactions found for the selected date range.`
              }
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  marginTop: '16px',
                  padding: '10px 20px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <>
            {searchTerm && (
              <div style={{
                padding: '12px 16px',
                background: '#e0e7ff',
                borderRadius: '8px',
                marginBottom: '15px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '14px', color: '#4338ca', fontWeight: '500' }}>
                  🔍 Found {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} matching "{searchTerm}"
                </span>
                <button
                  onClick={() => setSearchTerm('')}
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
                  Clear
                </button>
              </div>
            )}
            {filteredTransactions.map((transaction) => (
            <div
              key={transaction.id || transaction.sale_id}
              className="transaction-card"
              onClick={() => handleTransactionSelect(transaction)}
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
              <div className="transaction-details" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid #e5e7eb',
                flex: 1
              }}>
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  fontSize: '13px',
                  color: '#6b7280'
                }}>
                  <span style={{ fontSize: '14px' }}>📦</span>
                  <strong style={{ color: '#374151' }}>{transaction.items?.length || transaction.items_count || 0}</strong> items
                </span>
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  fontSize: '13px',
                  color: '#6b7280'
                }}>
                  <span style={{ fontSize: '14px' }}>👤</span>
                  <span style={{ 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {transaction.customer?.name || transaction.customer_name || 'Walk-in'}
                  </span>
                </span>
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  fontSize: '13px',
                  color: '#6b7280'
                }}>
                  <span style={{ fontSize: '14px' }}>💳</span>
                  {(transaction.payment?.method || transaction.payment_method || 'cash').toUpperCase()}
                </span>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
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
                    fontSize: '12px',
                    width: '100%'
                  }}
                >
                  🖨️ Print Receipt
                </button>
              </div>
            </div>
            ))}
            {totalPages > 1 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '10px', 
                marginTop: '30px',
                padding: '20px'
              }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '10px 20px',
                    background: page === 1 ? '#e5e7eb' : '#667eea',
                    color: page === 1 ? '#9ca3af' : 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  ← Previous
                </button>
                <span style={{ 
                  padding: '10px 20px',
                  background: '#f3f4f6',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: '10px 20px',
                    background: page === totalPages ? '#e5e7eb' : '#667eea',
                    color: page === totalPages ? '#9ca3af' : 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
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
                <h3>Items ({selectedTransaction.items_count || 0})</h3>
                {loadingItems[selectedTransaction.id] ? (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <div className="loading-spinner"></div>
                    <p style={{ marginTop: '12px', color: '#6b7280' }}>Loading items...</p>
                  </div>
                ) : (() => {
                  const items = transactionItems[selectedTransaction.id] || [];
                  return items.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="items-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Product</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Qty</th>
                            <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Price</th>
                            <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '12px', color: '#1f2937' }}>{item.product_name || item.item_name || item.name || 'Unknown'}</td>
                              <td style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>{item.quantity || item.qty || 0}</td>
                              <td style={{ padding: '12px', textAlign: 'right', color: '#6b7280' }}>{formatPrice(item.price || item.unit_price || 0)}</td>
                              <td style={{ padding: '12px', textAlign: 'right', fontWeight: '500', color: '#1f2937' }}>{formatPrice(item.total || item.subtotal || ((item.quantity || item.qty || 0) * (item.price || item.unit_price || 0)))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>No items found</p>
                  );
                })()}
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

