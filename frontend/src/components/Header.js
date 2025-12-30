import React from 'react';
import './Header.css';

const Header = () => {
  return (
    <header className="header">
      <div className="header-content">
        <h1 className="header-title">
          <span className="icon">💊</span>
          Pharmacy Management System
        </h1>
        <p className="header-subtitle">Browse and search medicines efficiently</p>
      </div>
    </header>
  );
};

export default Header;

