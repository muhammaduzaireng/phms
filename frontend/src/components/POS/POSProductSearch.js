import React, { useState, useEffect, useRef } from 'react';
import './POSProductSearch.css';
import API_BASE_URL from '../../config/api';
import AddCustomProduct from './AddCustomProduct';

const POSProductSearch = ({ onAddToCart }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchTerm.length >= 2 || selectedCategory) {
        searchProducts();
      } else {
        setProducts([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    if (products.length > 0 && searchTerm.length >= 2) {
      setShowDropdown(true);
      setSelectedIndex(0); // Select first item by default
    } else {
      setShowDropdown(false);
      setSelectedIndex(-1);
    }
  }, [products, searchTerm]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showDropdown || products.length === 0) return;

      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < products.length - 1 ? prev + 1 : 0
          );
          break;
        
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : products.length - 1
          );
          break;
        
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < products.length) {
            handleAddToCart(products[selectedIndex]);
          }
          break;
        
        case 'Escape':
          e.preventDefault();
          setShowDropdown(false);
          searchInputRef.current?.focus();
          break;
        
        case 'Tab':
          setShowDropdown(false);
          break;
      }
    };

    const input = searchInputRef.current;
    input?.addEventListener('keydown', handleKeyDown);
    
    return () => {
      input?.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDropdown, products, selectedIndex]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        searchInputRef.current && 
        !searchInputRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const searchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory) params.append('category', selectedCategory);

      const response = await fetch(`${API_BASE_URL}/api/pos/products?${params}`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products);
      }
    } catch (err) {
      console.error('Error searching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product) => {
    onAddToCart(product);
    setSearchTerm('');
    setProducts([]);
    setShowDropdown(false);
    searchInputRef.current?.focus();
  };

  const handleProductAdded = (product) => {
    onAddToCart({
      ...product,
      product_name: product.name,
      price_rs: product.price,
      reg_number: product.id,
      generic_name: product.description,
      manufacturer: product.category,
      pack_size: product.unit
    });
    setSearchTerm('');
    setProducts([]);
    setShowDropdown(false);
    searchInputRef.current?.focus();
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(price);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    if (e.target.value.length < 2) {
      setShowDropdown(false);
    }
  };

  const handleSearchFocus = () => {
    if (products.length > 0 && searchTerm.length >= 2) {
      setShowDropdown(true);
    }
  };

  return (
    <div className="pos-product-search">
      <div className="search-controls">
        <div className="search-input-wrapper" ref={searchInputRef}>
          <span className="search-icon">🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Search products or medicines..."
            value={searchTerm}
            onChange={handleSearchChange}
            onFocus={handleSearchFocus}
            autoComplete="off"
          />
          {loading && (
            <div className="search-loading">Loading...</div>
          )}
        </div>

        <select
          className="category-filter"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <button
          className="add-product-btn"
          onClick={() => setShowAddProduct(true)}
          title="Add custom product"
        >
          + Add Product
        </button>
      </div>

      {/* Dropdown Results */}
      {showDropdown && (
        <div className="search-results-dropdown" ref={dropdownRef}>
          <div className="dropdown-header">
            <span>Search Results ({products.length})</span>
            <button 
              className="close-dropdown"
              onClick={() => setShowDropdown(false)}
            >
              ×
            </button>
          </div>
          
          <div className="dropdown-products-list">
            {products.map((product, index) => (
              <div
                key={product.reg_number || product.id}
                className={`dropdown-product-item ${
                  index === selectedIndex ? 'selected' : ''
                }`}
                onClick={() => handleAddToCart(product)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="dropdown-product-info">
                  <div className="dropdown-product-name">
                    {product.product_name}
                  </div>
                  {product.generic_name && (
                    <div className="dropdown-product-generic">
                      {product.generic_name}
                    </div>
                  )}
                  <div className="dropdown-product-details">
                    <span className="dropdown-manufacturer">
                      {product.isCustom ? 'Custom' : product.manufacturer || 'N/A'}
                    </span>
                    <span className="dropdown-pack-size">
                      {product.pack_size || 'N/A'}
                    </span>
                    <span className="dropdown-price">
                      {formatPrice(product.price_rs)}
                    </span>
                  </div>
                </div>
                <button className="dropdown-add-btn">
                  Add <span className="keyboard-hint">↵ Enter</span>
                </button>
              </div>
            ))}
          </div>

          <div className="dropdown-footer">
            <div className="keyboard-instructions">
              <span className="key-hint">↑↓</span> Navigate • 
              <span className="key-hint">↵</span> Select • 
              <span className="key-hint">Esc</span> Close
            </div>
          </div>
        </div>
      )}

      {/* Grid View (for category-only filtering) */}
      {!showDropdown && selectedCategory && products.length > 0 && (
        <div className="products-grid">
          {products.map((product) => (
            <div key={product.reg_number || product.id} className="product-card">
              <div className="product-info">
                <h3 className="product-name">{product.product_name}</h3>
                {product.generic_name && (
                  <p className="product-generic">{product.generic_name}</p>
                )}
                <div className="product-details">
                  <span className="product-manufacturer">
                    {product.isCustom ? 'Custom Product' : product.manufacturer || 'N/A'}
                  </span>
                  <span className="product-price">{formatPrice(product.price_rs)}</span>
                </div>
                <div className="product-meta">
                  <span className="product-pack">{product.pack_size || 'N/A'}</span>
                </div>
              </div>
              <button
                className="add-to-cart-btn"
                onClick={() => handleAddToCart(product)}
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      )}

      {!showDropdown && !selectedCategory && products.length === 0 && searchTerm.length === 0 && (
        <div className="empty-state">
          <p>Start typing to search for products</p>
          <button
            className="add-product-btn-large"
            onClick={() => setShowAddProduct(true)}
          >
            + Add Custom Product
          </button>
        </div>
      )}

      {showAddProduct && (
        <AddCustomProduct
          onClose={() => setShowAddProduct(false)}
          onSuccess={handleProductAdded}
        />
      )}
    </div>
  );
};

export default POSProductSearch;