import React, { useState, useEffect } from 'react';
import './ElectronPOS.css';
import PharmacyLogin from './PharmacyLogin';
import POS from './POS';
import CreatePurchaseOrder from '../components/PurchaseOrders/CreatePurchaseOrder';
import PurchaseOrders from './PurchaseOrders';
import PurchaseOrderDetail from '../components/PurchaseOrders/PurchaseOrderDetail';
import AddCustomProduct from '../components/POS/AddCustomProduct';
import StockManagement from './StockManagement';
import API_BASE_URL from '../config/api';
import SalesHistory from './SalesHistory';

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI;

const ElectronPOS = () => {
  const [pharmacyUser, setPharmacyUser] = useState(null);
  const [pharmacyToken, setPharmacyToken] = useState(null);
  const [currentView, setCurrentView] = useState('login'); // 'login', 'pos', 'add-product', 'returns', 'purchase-order', 'purchase-order-list', 'sales-reports', 'stock'
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);

  useEffect(() => {
    // Check for existing session
    const savedToken = localStorage.getItem('pharmacyToken');
    const savedUser = localStorage.getItem('pharmacyUser');
    
    if (savedToken && savedUser) {
      setPharmacyToken(savedToken);
      setPharmacyUser(JSON.parse(savedUser));
      setCurrentView('pos');
    }
  }, []);

  const handleLogin = async (userData, token) => {
    setPharmacyUser(userData);
    setPharmacyToken(token);
    setCurrentView('pos');
    localStorage.setItem('pharmacyToken', token);
    localStorage.setItem('pharmacyUser', JSON.stringify(userData));

    // Download all data on first login
    if (isElectron && window.electronAPI && window.electronAPI.downloadAllData) {
      try {
        const lastSync = await window.electronAPI.getLastSyncTime();
        // If no sync or sync is older than 24 hours, download fresh data
        const shouldDownload = !lastSync || 
          (new Date() - new Date(lastSync.timestamp)) > 24 * 60 * 60 * 1000;

        if (shouldDownload) {
          console.log('Downloading all data for offline use...');
          const result = await window.electronAPI.downloadAllData(token);
          if (result.success) {
            console.log(`Data download successful. ${result.medicinesCount || 0} medicines downloaded.`);
          } else {
            console.error('Data download failed:', result.error);
          }
        } else {
          console.log('Using cached offline data');
        }
      } catch (error) {
        console.error('Error downloading data:', error);
      }
    }
  };

  const handleLogout = () => {
    setPharmacyUser(null);
    setPharmacyToken(null);
    setCurrentView('login');
    localStorage.removeItem('pharmacyToken');
    localStorage.removeItem('pharmacyUser');
  };

  // Show login screen
  if (currentView === 'login' || !pharmacyUser) {
    return (
      <div className="electron-pos-container">
        <PharmacyLogin onLogin={handleLogin} />
      </div>
    );
  }

  // Show POS with menu
  return (
    <div className="electron-pos-container">
      <div className="electron-pos-header">
        <div className="pharmacy-info">
          <h2>🏥 {pharmacyUser.pharmacyName || pharmacyUser.username}</h2>
        </div>
        <div className="pos-menu-bar">
          <button 
            className={currentView === 'pos' ? 'active' : ''}
            onClick={() => setCurrentView('pos')}
          >
            💰 POS / Sell
          </button>
          <button 
            className={currentView === 'add-product' ? 'active' : ''}
            onClick={() => setCurrentView('add-product')}
          >
            ➕ Add Product
          </button>
          <button 
            className={currentView === 'returns' ? 'active' : ''}
            onClick={() => setCurrentView('returns')}
          >
            ↩️ Returns
          </button>
          <button 
            className={currentView === 'purchase-order-list' ? 'active' : ''}
            onClick={() => setCurrentView('purchase-order-list')}
          >
            📦 Purchase Orders
          </button>
          <button 
            className={currentView === 'stock' ? 'active' : ''}
            onClick={() => setCurrentView('stock')}
          >
            📦 Stock Management
          </button>
          <button 
            className={currentView === 'sales-reports' ? 'active' : ''}
            onClick={() => setCurrentView('sales-reports')}
          >
            📊 Sales Reports
          </button>
          <button onClick={handleLogout} className="logout-btn">
            🚪 Logout
          </button>
        </div>
      </div>

      <div className="electron-pos-content">
        {currentView === 'pos' && (
          <div className="pos-wrapper">
            {isElectron && (
              <div className="keyboard-shortcuts-hint">
                <strong>Keyboard Shortcuts:</strong> F1 (Search) | F2 (Checkout) | F3 (Clear Cart) | ESC (Close) | Ctrl+Enter (Process Sale)
              </div>
            )}
            <POS 
              user={pharmacyUser} 
              token={pharmacyToken} 
              onLogout={handleLogout}
              isElectron={true}
            />
          </div>
        )}
        
        {currentView === 'add-product' && (
          <div className="view-container">
            <button onClick={() => setCurrentView('pos')} className="back-btn">← Back to POS</button>
            <AddCustomProduct 
              token={pharmacyToken}
              onClose={() => setCurrentView('pos')}
              onSuccess={() => {
                setCurrentView('pos');
                alert('Product added successfully!');
              }}
            />
          </div>
        )}
        
        {currentView === 'returns' && (
          <ReturnsView token={pharmacyToken} user={pharmacyUser} onBack={() => setCurrentView('pos')} />
        )}
        
        {currentView === 'purchase-order-list' && (
          <div className="view-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <PurchaseOrders 
              user={pharmacyUser} 
              token={pharmacyToken}
              onNavigate={() => setCurrentView('pos')}
              onOrderClick={(order) => setSelectedPO(order)}
              onCreateClick={() => setShowCreatePO(true)}
            />
          </div>
        )}

        {currentView === 'stock' && (
          <div className="view-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <StockManagement user={pharmacyUser} token={pharmacyToken} />
          </div>
        )}
        
        {currentView === 'sales-reports' && (
          <div className="view-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <SalesHistory user={pharmacyUser} token={pharmacyToken} onNavigate={() => setCurrentView('pos')} />
          </div>
        )}

        {showCreatePO && (
          <CreatePurchaseOrder 
            token={pharmacyToken}
            onClose={() => setShowCreatePO(false)}
            onSuccess={() => {
              setShowCreatePO(false);
              if (currentView === 'purchase-order-list') {
                // Refresh the list
                window.location.reload();
              }
            }}
          />
        )}

        {selectedPO && (
          <PurchaseOrderDetail
            order={selectedPO}
            onClose={() => setSelectedPO(null)}
            onStatusUpdate={async (orderId, newStatus, receivedDate) => {
              // Refresh after status update
              setSelectedPO(null);
              if (currentView === 'purchase-order-list') {
                window.location.reload();
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

// Returns View
const ReturnsView = ({ token, user, onBack }) => {
  return (
    <div className="view-container">
      <button onClick={onBack} className="back-btn">← Back to POS</button>
      <h2>Product Returns</h2>
      <p>Returns functionality coming soon...</p>
    </div>
  );
};

// Sales Reports View
const SalesReportsView = ({ token, user, onBack }) => {
  const [period, setPeriod] = useState('daily'); // daily, weekly, monthly, yearly
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSalesData();
  }, [period]);

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      let startDate, endDate;

      switch (period) {
        case 'daily':
          startDate = today.toISOString().split('T')[0];
          endDate = startDate;
          break;
        case 'weekly':
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          startDate = weekStart.toISOString().split('T')[0];
          endDate = today.toISOString().split('T')[0];
          break;
        case 'monthly':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
          endDate = today.toISOString().split('T')[0];
          break;
        case 'yearly':
          startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
          endDate = today.toISOString().split('T')[0];
          break;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/pos/sales-stats?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSalesData(data);
      }
    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-container sales-reports">
      <button onClick={onBack} className="back-btn">← Back to POS</button>
      <h2>Sales Reports</h2>
      
      <div className="period-selector">
        <button 
          className={period === 'daily' ? 'active' : ''}
          onClick={() => setPeriod('daily')}
        >
          Daily
        </button>
        <button 
          className={period === 'weekly' ? 'active' : ''}
          onClick={() => setPeriod('weekly')}
        >
          Weekly
        </button>
        <button 
          className={period === 'monthly' ? 'active' : ''}
          onClick={() => setPeriod('monthly')}
        >
          Monthly
        </button>
        <button 
          className={period === 'yearly' ? 'active' : ''}
          onClick={() => setPeriod('yearly')}
        >
          Yearly
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : salesData ? (
        <>
          <div className="sales-stats">
            <div className="stat-card">
              <h3>Total Revenue</h3>
              <p className="amount">PKR {(salesData.totalRevenue || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="stat-card">
              <h3>Total Transactions</h3>
              <p className="count">{salesData.totalTransactions || 0}</p>
            </div>
            <div className="stat-card">
              <h3>Average Transaction</h3>
              <p className="amount">PKR {(salesData.averageTransactionValue || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="stat-card">
              <h3>Items Sold</h3>
              <p className="count">{salesData.totalItemsSold || 0}</p>
            </div>
          </div>
        </>
      ) : (
        <div className="no-data">No sales data available</div>
      )}
    </div>
  );
};

export default ElectronPOS;

