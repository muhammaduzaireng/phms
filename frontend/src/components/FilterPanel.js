import React from 'react';
import './FilterPanel.css';

const FilterPanel = ({ filters, categories, manufacturers, onChange, onClear }) => {
  const handleChange = (key, value) => {
    onChange({ [key]: value });
  };

  return (
    <div className="filter-panel">
      <div className="filter-header">
        <h3>Filters</h3>
        <button onClick={onClear} className="clear-btn">Clear All</button>
      </div>
      
      <div className="filter-grid">
        <div className="filter-group">
          <label>Category</label>
          <select
            value={filters.category}
            onChange={(e) => handleChange('category', e.target.value)}
            className="filter-select"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Manufacturer</label>
          <select
            value={filters.manufacturer}
            onChange={(e) => handleChange('manufacturer', e.target.value)}
            className="filter-select"
          >
            <option value="">All Manufacturers</option>
            {manufacturers.map(man => (
              <option key={man} value={man}>{man}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Min Price (Rs)</label>
          <input
            type="number"
            value={filters.minPrice}
            onChange={(e) => handleChange('minPrice', e.target.value)}
            placeholder="0"
            className="filter-input"
            min="0"
          />
        </div>

        <div className="filter-group">
          <label>Max Price (Rs)</label>
          <input
            type="number"
            value={filters.maxPrice}
            onChange={(e) => handleChange('maxPrice', e.target.value)}
            placeholder="No limit"
            className="filter-input"
            min="0"
          />
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;

