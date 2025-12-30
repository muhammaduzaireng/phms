import React from 'react';
import './SearchBar.css';

const SearchBar = ({ value, onChange, onToggleFilters, showFilters }) => {
  return (
    <div className="search-bar-container">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder="Search by product name, generic name, manufacturer, or registration number..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <button 
        className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
        onClick={onToggleFilters}
      >
        {showFilters ? 'Hide Filters' : 'Show Filters'}
      </button>
    </div>
  );
};

export default SearchBar;

