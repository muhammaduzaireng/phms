import React, { useState } from 'react';
import './Navigation.css';

const Navigation = ({ currentPage, onNavigate, user, onLogout, onOpenPosWindow, posWindowsFull }) => {
  const [desktopNavOpen, setDesktopNavOpen] = useState(false);

  const navItems = [
    { id: 'browse', label: 'Browse Medicines', icon: '📚' },
    { id: 'pos', label: 'Point of Sale', icon: '💰' },
    { id: 'returns', label: 'Returns', icon: '↩️' },
    { id: 'sales', label: 'Sales History', icon: '📊' },
    { id: 'stock', label: 'Stock Management', icon: '📦' },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: '📋' },
    { id: 'profile', label: 'Profile', icon: '⚙️' },
    { id: 'pharmacy-login', label: 'Pharmacy Login', icon: '🔐' },
    { id: 'admin', label: 'Admin Panel', icon: '👨‍💼' }
  ];

  if (!onNavigate || typeof onNavigate !== 'function') {
    return null;
  }

  const currentItem = navItems.find(item => item.id === currentPage);

  const handleNavClick = (id) => {
    onNavigate(id);
    setDesktopNavOpen(false);
  };

  const handleNewPosWindow = () => {
    if (posWindowsFull) return;
    if (onOpenPosWindow) {
      onOpenPosWindow();
      return;
    }
    try {
      sessionStorage.setItem('phmsOpenExtraPos', '1');
    } catch (e) {
      // ignore
    }
    onNavigate('pos');
    setDesktopNavOpen(false);
  };

  return (
    <nav className={`main-navigation ${desktopNavOpen ? 'is-open' : 'is-collapsed'}`}>
      <div className="nav-container">
        <div className="nav-bar-row">
          <button
            type="button"
            className="nav-new-pos-btn"
            onClick={handleNewPosWindow}
            disabled={posWindowsFull}
            title={posWindowsFull ? 'Close a POS window first' : 'Open another POS on this screen'}
            aria-label="Open another POS window"
          >
            +
          </button>
          <div className="nav-logo">
            <span className="logo-icon">💊</span>
            <span className="logo-text">Pharmacy System</span>
          </div>

          {currentItem && (
            <span className="nav-current-page">
              <span className="nav-icon">{currentItem.icon}</span>
              <span>{currentItem.label}</span>
            </span>
          )}

          {user && (
            <div className="nav-user">
              <span className="nav-user-name" title={user.pharmacyName || user.username}>
                🏥 {user.pharmacyName || user.username}
              </span>
              {onLogout && (
                <button type="button" className="nav-logout-btn" onClick={onLogout}>
                  Logout
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            className="nav-dropdown-toggle"
            onClick={() => setDesktopNavOpen(open => !open)}
            aria-expanded={desktopNavOpen}
            aria-label={desktopNavOpen ? 'Hide menu' : 'Show menu'}
            title={desktopNavOpen ? 'Hide menu' : 'Show menu'}
          >
            <span className={`nav-chevron ${desktopNavOpen ? 'is-open' : ''}`} />
          </button>
        </div>

        <div className="nav-links">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-link ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
