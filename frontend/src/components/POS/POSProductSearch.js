import React, { useState, useEffect, useRef, useCallback } from 'react';
import './POSProductSearch.css';
import API_BASE_URL from '../../config/api';
import AddCustomProduct from './AddCustomProduct';
import { cacheMedicineSearch, getCachedMedicineSearch } from '../../services/dataSync';

const POSProductSearch = ({ onAddToCart, token }) => {
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

  // Define searchProducts function using useCallback
  const searchProducts = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get token from prop or localStorage
      const authToken = token || localStorage.getItem('pharmacyToken');

      if (!authToken) {
        setProducts([]);
        setShowDropdown(false);
        setLoading(false);
        return;
      }

      const searchQuery = searchTerm.trim();
      
      // Check cache first (if offline or for faster results)
      if (!navigator.onLine || searchQuery.length > 0) {
        const cachedResults = getCachedMedicineSearch(searchQuery);
        if (cachedResults && cachedResults.length > 0) {
          setProducts(cachedResults);
          if (searchQuery.length >= 1) {
            setShowDropdown(true);
          }
          setLoading(false);
          // Still try to fetch fresh data in background if online
          if (navigator.onLine) {
            // Continue to fetch fresh data...
          } else {
            return; // Offline - use cache only
          }
        }
      }

      // Fetch from server (if online)
      if (navigator.onLine) {
        const params = new URLSearchParams();
        if (searchQuery) {
          params.append('search', searchQuery);
        }
        if (selectedCategory) {
          params.append('category', selectedCategory);
        }

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        };

        const url = `${API_BASE_URL}/api/pos/products?${params}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: headers
        });

        if (!response.ok) {
          // If request fails and we have cache, use cache
          if (!navigator.onLine) {
            const cachedResults = getCachedMedicineSearch(searchQuery);
            if (cachedResults) {
              setProducts(cachedResults);
              setShowDropdown(true);
              setLoading(false);
              return;
            }
          }
          
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || 'Unknown error' };
          }
          
          setProducts([]);
          setShowDropdown(true);
          setLoading(false);
          return;
        }

        const data = await response.json();
        const productsArray = Array.isArray(data.products) ? data.products : [];
        setProducts(productsArray);
        
        // Cache the search results
        if (searchQuery.length > 0) {
          cacheMedicineSearch(searchQuery, productsArray);
        }
        
        // Ensure dropdown is shown to display results
        if (searchQuery.length >= 1) {
          setShowDropdown(true);
        }
      } else {
        // Offline - try cache
        const cachedResults = getCachedMedicineSearch(searchQuery);
        if (cachedResults) {
          setProducts(cachedResults);
        } else {
          setProducts([]);
        }
        setShowDropdown(true);
      }
    } catch (err) {
      // On error, try cache
      const cachedResults = getCachedMedicineSearch(searchTerm.trim());
      if (cachedResults) {
        setProducts(cachedResults);
      } else {
        setProducts([]);
      }
      setShowDropdown(true);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory, token]);

  // Trigger search when searchTerm or category changes
  useEffect(() => {
    let timeoutId;
    
    // If there's a search term (even 1 character) or category, search
    if (searchTerm.trim().length >= 1 || selectedCategory) {
      // Show dropdown immediately when typing
      setShowDropdown(true);
      
      // For first character, search immediately; for subsequent, debounce
      if (searchTerm.trim().length === 1) {
        searchProducts();
      } else if (searchTerm.trim().length > 1) {
        timeoutId = setTimeout(() => {
          searchProducts();
        }, 150);
      }
    } else {
      // Clear results if search is empty and no category
      setProducts([]);
      setShowDropdown(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [searchTerm, selectedCategory, searchProducts]);

  // Helper function to scroll selected item into view
  const scrollToSelectedItem = useCallback((index) => {
    if (!dropdownRef.current || index < 0 || index >= products.length) return;
    
    const dropdownList = dropdownRef.current.querySelector('.dropdown-products-list');
    if (!dropdownList) return;

    // Get all product items (only elements with class 'dropdown-product-item')
    const productItems = Array.from(dropdownList.children).filter(
      child => child.classList && child.classList.contains('dropdown-product-item')
    );

    if (productItems[index]) {
      productItems[index].scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [products.length]);

  // Keep dropdown visible when we have a search term
  useEffect(() => {
    if (searchTerm.trim().length >= 1) {
      setShowDropdown(true);
      if (products.length > 0) {
        setSelectedIndex(0);
      } else {
        setSelectedIndex(-1);
      }
    } else if (!selectedCategory) {
      setShowDropdown(false);
      setSelectedIndex(-1);
    }
  }, [searchTerm, products.length, selectedCategory]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showDropdown || products.length === 0) return;

      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => {
            const newIndex = prev < products.length - 1 ? prev + 1 : 0;
            // Scroll selected item into view after state update
            setTimeout(() => {
              scrollToSelectedItem(newIndex);
            }, 50);
            return newIndex;
          });
          break;
        
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => {
            const newIndex = prev > 0 ? prev - 1 : products.length - 1;
            // Scroll selected item into view after state update
            setTimeout(() => {
              scrollToSelectedItem(newIndex);
            }, 50);
            return newIndex;
          });
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
  }, [showDropdown, products, selectedIndex, scrollToSelectedItem]);

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
    const value = e.target.value;
    setSearchTerm(value);
    // Dropdown visibility is handled by useEffect
  };

  const handleSearchFocus = () => {
    // Show dropdown if we have a search term
    if (searchTerm.trim().length >= 1) {
      setShowDropdown(true);
    }
  };

  return (
    <div className="pos-product-search">
      <div className="search-controls">
        <div className="search-input-wrapper">
          {!searchTerm && !loading && (
            <span className="search-icon">🔍</span>
          )}
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
            <div className="search-loading">
              <span className="loading-spinner">⟳</span>
            </div>
          )}

          {/* Dropdown Results - Positioned relative to search input */}
          {showDropdown && searchTerm.trim().length >= 1 && (
            <div 
              className="search-results-dropdown" 
              ref={dropdownRef}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="dropdown-header">
                <span>
                  {loading ? (
                    <span>🔍 Searching for "{searchTerm}"...</span>
                  ) : (
                    `Search Results (${products.length})`
                  )}
                </span>
                <button 
                  className="close-dropdown"
                  onClick={() => {
                    setShowDropdown(false);
                    setSearchTerm('');
                  }}
                >
                  ×
                </button>
              </div>
              
              <div className="dropdown-products-list">
                {loading && (
                  <div className="no-results">
                    <p>🔍 Searching for "{searchTerm}"...</p>
                    <p style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>Please wait...</p>
                  </div>
                )}
                {!loading && products.length === 0 && searchTerm.trim().length >= 1 && (
                  <div className="no-results">
                    <p>❌ No products found for "{searchTerm}"</p>
                    <p style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                      Try searching with a different term (e.g., product name, generic name, or registration number)
                    </p>
                  </div>
                )}
                {!loading && products.length > 0 && (
                  <>
                    {products.map((product, index) => (
                    <div
                      key={product.reg_number || product.id || `product-${index}`}
                      className={`dropdown-product-item ${
                        index === selectedIndex ? 'selected' : ''
                      }`}
                      onClick={() => handleAddToCart(product)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      style={{ display: 'block' }}
                    >
                      <div className="dropdown-product-info">
                        <div className="dropdown-product-name">
                          {product.product_name || product.name || 'Unknown Product'}
                        </div>
                        {(product.generic_name || product.description) && (
                          <div className="dropdown-product-generic">
                            {product.generic_name || product.description}
                          </div>
                        )}
                        <div className="dropdown-product-details">
                          <span className="dropdown-manufacturer">
                            {product.isCustom ? 'Custom' : product.manufacturer || 'N/A'}
                          </span>
                          <span className="dropdown-pack-size">
                            {product.pack_size || product.unit || 'N/A'}
                          </span>
                          <span className="dropdown-price">
                            {formatPrice(product.price_rs || product.price || 0)}
                          </span>
                        </div>
                        {/* Stock Status */}
                        <div className="dropdown-stock-status">
                          {product.stock_quantity !== undefined && product.stock_quantity !== null ? (
                            <>
                              {product.stock_quantity <= 0 ? (
                                <span className="stock-badge stock-out">Out of Stock</span>
                              ) : product.low_stock ? (
                                <span className="stock-badge stock-low">
                                  Low Stock: {product.stock_quantity} {product.pack_size || 'units'}
                                </span>
                              ) : (
                                <span className="stock-badge stock-available">
                                  In Stock: {product.stock_quantity} {product.pack_size || 'units'}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="stock-badge stock-not-added">Not in Stock</span>
                          )}
                        </div>
                      </div>
                      <button className="dropdown-add-btn">
                        Add <span className="keyboard-hint">↵ Enter</span>
                      </button>
                    </div>
                    ))}
                  </>
                )}
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

      {/* Grid View (for category-only filtering - only show when NOT searching) */}
      {!showDropdown && selectedCategory && products.length > 0 && searchTerm.trim().length === 0 && (
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
                {/* Stock Status */}
                <div className="product-stock-status">
                  {product.stock_quantity !== undefined && product.stock_quantity !== null ? (
                    <>
                      {product.stock_quantity <= 0 ? (
                        <span className="stock-badge stock-out">Out of Stock</span>
                      ) : product.low_stock ? (
                        <span className="stock-badge stock-low">
                          Low Stock: {product.stock_quantity} {product.pack_size || 'units'}
                        </span>
                      ) : (
                        <span className="stock-badge stock-available">
                          In Stock: {product.stock_quantity} {product.pack_size || 'units'}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="stock-badge stock-not-added">Not in Stock</span>
                  )}
                </div>
              </div>
              <button
                className="add-to-cart-btn"
                onClick={() => handleAddToCart(product)}
                disabled={product.stock_quantity !== undefined && product.stock_quantity !== null && product.stock_quantity <= 0}
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
          token={token}
          onClose={() => setShowAddProduct(false)}
          onSuccess={handleProductAdded}
        />
      )}
    </div>
  );
};

export default POSProductSearch;
