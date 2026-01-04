import React from 'react';
import './Navigation.css';

const Navigation = ({ currentPage, onNavigate }) => {
  const navItems = [
    { id: 'browse', label: '📚 Browse Medicines', icon: '📚' },
    { id: 'pos', label: '💰 Point of Sale', icon: '💰' },
    { id: 'sales', label: '📊 Sales History', icon: '📊' },
    { id: 'stock', label: '📦 Stock Management', icon: '📦' },
    { id: 'purchase-orders', label: '📋 Purchase Orders', icon: '📋' },
    { id: 'profile', label: '⚙️ Profile', icon: '⚙️' },
    { id: 'pharmacy-login', label: '🔐 Pharmacy Login', icon: '🔐' },
    { id: 'admin', label: '👨‍💼 Admin Panel', icon: '👨‍💼' }
  ];

  // Don't render if onNavigate is not provided
  if (!onNavigate || typeof onNavigate !== 'function') {
    return null;
  }

  return (
    <nav className="main-navigation">
      <div className="nav-container">
        <div className="nav-logo">
          <span className="logo-icon">💊</span>
          <span className="logo-text">Pharmacy System</span>
        </div>
        <div className="nav-links">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-link ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label.replace(/[📚💰📊📦⚙️🔐👨‍💼]/g, '').trim()}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

