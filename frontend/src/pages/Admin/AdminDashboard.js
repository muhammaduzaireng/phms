import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';
import API_BASE_URL from '../../config/api';
import PharmacyList from './PharmacyList';
import CreatePharmacy from './CreatePharmacy';
import Navigation from '../../components/Navigation';

const AdminDashboard = ({ admin, token, onLogout }) => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentView === 'dashboard') {
      fetchStats();
    }
  }, [currentView]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div className="admin-header-content">
          <h1>👨‍💼 Admin Dashboard</h1>
          <div className="admin-info">
            <span>Welcome, {admin.fullName || admin.username}</span>
            <button className="logout-btn" onClick={onLogout}>Logout</button>
          </div>
        </div>
      </div>

      <div className="admin-nav">
        <button
          className={`admin-nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentView('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={`admin-nav-btn ${currentView === 'pharmacies' ? 'active' : ''}`}
          onClick={() => setCurrentView('pharmacies')}
        >
          🏥 Manage Pharmacies
        </button>
        <button
          className={`admin-nav-btn ${currentView === 'create' ? 'active' : ''}`}
          onClick={() => setCurrentView('create')}
        >
          ➕ Create Pharmacy
        </button>
      </div>

      <div className="admin-content">
        {currentView === 'dashboard' && (
          <div className="dashboard-content">
            {loading ? (
              <div className="loading">Loading statistics...</div>
            ) : stats ? (
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">🏥</div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.totalPharmacies}</div>
                    <div className="stat-label">Total Pharmacies</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">✅</div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.activePharmacies}</div>
                    <div className="stat-label">Active Pharmacies</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">💰</div>
                  <div className="stat-info">
                    <div className="stat-value">
                      {new Intl.NumberFormat('en-PK', {
                        style: 'currency',
                        currency: 'PKR',
                        minimumFractionDigits: 0
                      }).format(stats.totalRevenue)}
                    </div>
                    <div className="stat-label">Total Revenue</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📦</div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.totalPurchaseOrders}</div>
                    <div className="stat-label">Purchase Orders</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🛒</div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.totalSales}</div>
                    <div className="stat-label">Total Sales</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="error">Failed to load statistics</div>
            )}
          </div>
        )}

        {currentView === 'pharmacies' && (
          <PharmacyList token={token} onEdit={() => setCurrentView('create')} />
        )}

        {currentView === 'create' && (
          <CreatePharmacy token={token} onSuccess={() => {
            setCurrentView('pharmacies');
            fetchStats();
          }} />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

