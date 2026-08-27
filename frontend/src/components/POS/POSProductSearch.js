import React, { useState, useEffect, useRef, useCallback } from 'react';
import './POSProductSearch.css';
import API_BASE_URL from '../../config/api';
import AddCustomProduct from './AddCustomProduct';
import { cacheMedicineSearch, getCachedMedicineSearch } from '../../services/dataSync';

const POSProductSearch = ({ onAddToCart, token, onSearchChange }) => {
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

  const uniquePOSProducts = (productsArray) => {
    const bestById = new Map();
    productsArray.forEach((p) => {
      const idKey = p.isCustom
        ? `CUST-${p.custom_product_id || p.id}`
        : `MED-${p.reg_number}`;
      const prev = bestById.get(idKey);
      const pQty = Number(p.stock_quantity) || 0;
      const prevQty = prev ? (Number(prev.stock_quantity) || 0) : -1;
      if (!prev || pQty > prevQty) {
        bestById.set(idKey, p);
      }
    });

    const bestByName = new Map();
    bestById.forEach((p) => {
      const nameKey = (p.product_name || p.name || '').trim().toLowerCase()
        || `id:${p.reg_number || p.id}`;
      const prev = bestByName.get(nameKey);
      const pQty = Number(p.stock_quantity) || 0;
      const prevQty = prev ? (Number(prev.stock_quantity) || 0) : -1;
      if (!prev || pQty > prevQty) {
        bestByName.set(nameKey, p);
      }
    });

    return Array.from(bestByName.values());
  };

  // Helper function to sort products by relevance to search term
  const sortProductsByRelevance = (productsArray, searchQuery) => {
    if (!searchQuery) return productsArray;
  
    const searchLower = searchQuery.toLowerCase().trim();
  
    return [...productsArray].sort((a, b) => {
      const nameA = (a.product_name || a.name || '').toLowerCase();
      const nameB = (b.product_name || b.name || '').toLowerCase();
  
      const aStarts = nameA.startsWith(searchLower);
      const bStarts = nameB.startsWith(searchLower);
  
      // 1️⃣ Exact match first
      if (nameA === searchLower && nameB !== searchLower) return -1;
      if (nameB === searchLower && nameA !== searchLower) return 1;
  
      // 2️⃣ Starts with search text
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
  
      // 3️⃣ Contains search text
      const aIncludes = nameA.includes(searchLower);
      const bIncludes = nameB.includes(searchLower);
  
      if (aIncludes && !bIncludes) return -1;
      if (!aIncludes && bIncludes) return 1;
  
      // 4️⃣ Alphabetical order among matches
      if (aIncludes && bIncludes) {
        return nameA.localeCompare(nameB);
      }
  
      // 5️⃣ If no match, push to bottom
      return 0;
    });
  };
  
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
          // Sort cached results too
          const sortedCached = sortProductsByRelevance(
            uniquePOSProducts(cachedResults),
            searchQuery
          );
          setProducts(sortedCached);
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

        // Limit results for speed (backend default is 50; keeping explicit helps)
        params.append('limit', '50');
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
              const sortedCached = sortProductsByRelevance(
                uniquePOSProducts(cachedResults),
                searchQuery
              );
              setProducts(sortedCached);
              if (searchQuery.length >= 1) {
                setShowDropdown(true);
              }
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
          setLoading(false);
          return;
        }

        const data = await response.json();
        let productsArray = uniquePOSProducts(
          Array.isArray(data.products) ? data.products : []
        );
        const inStockOnly = productsArray.filter(p => Number(p.stock_quantity) > 0);
        if (inStockOnly.length > 0) {
          productsArray = inStockOnly;
        }
        
        // Sort products by relevance - ALWAYS sort when there's a search query
        const sortedProducts = searchQuery.length > 0 
          ? sortProductsByRelevance(productsArray, searchQuery)
          : productsArray;
        setProducts(sortedProducts);
        
        // Cache the search results
        if (searchQuery.length > 0) {
          cacheMedicineSearch(searchQuery, productsArray);
        }
        
        // Show dropdown if we have search results
        if (searchQuery.length >= 1) {
          setShowDropdown(true);
        }
      } else {
        // Offline - try cache
        const cachedResults = getCachedMedicineSearch(searchQuery);
        if (cachedResults) {
          const sortedCached = sortProductsByRelevance(
            uniquePOSProducts(cachedResults),
            searchQuery
          );
          setProducts(sortedCached);
        } else {
          setProducts([]);
        }
      }
    } catch (err) {
      // On error, try cache
      const cachedResults = getCachedMedicineSearch(searchTerm.trim());
      if (cachedResults) {
        const sortedCached = sortProductsByRelevance(
          uniquePOSProducts(cachedResults),
          searchTerm.trim()
        );
        setProducts(sortedCached);
        if (searchTerm.trim().length >= 1) {
          setShowDropdown(true);
        }
      } else {
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory, token]);

  // Trigger search when searchTerm or category changes
  useEffect(() => {
    let timeoutId;
    
    const trimmed = searchTerm.trim();
    const isLikelyBarcode = /^\d{4,}$/.test(trimmed); // barcode scanners usually send digits

    // For speed: don't search centralized DB on 1 character typing
    // Search when:
    // - barcode-like input (fast exact match on custom product barcode)
    // - 2+ characters
    // - category filter selected
    if (trimmed.length >= 2 || isLikelyBarcode || selectedCategory) {
      // Show dropdown when typing
      setShowDropdown(true);
      
      // For barcode scans, search immediately (scanners often send Enter quickly)
      if (isLikelyBarcode) {
        searchProducts();
      } else {
        // Debounce for normal typing
        timeoutId = setTimeout(() => {
          searchProducts();
        }, 120);
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


  // Notify parent component about search term changes for inventory table
  useEffect(() => {
    if (onSearchChange) {
      onSearchChange(searchTerm);
    }
  }, [searchTerm, onSearchChange]);

  // Keep dropdown visible when we have a search term
  useEffect(() => {
    if (searchTerm.trim().length >= 1) {
      // Show dropdown when searching (even if products haven't loaded yet)
      setShowDropdown(true);
      if (products.length > 0) {
        setSelectedIndex(0);
      } else {
        setSelectedIndex(-1);
      }
    } else if (searchTerm.trim().length === 0) {
      setShowDropdown(false);
      setSelectedIndex(-1);
    }
  }, [searchTerm, products.length]);

  // Helper function to scroll selected item into view
  const scrollToSelectedItem = useCallback((index) => {
    if (!dropdownRef.current || index < 0 || index >= products.length) return;
    
    const dropdownList = dropdownRef.current.querySelector('.dropdown-products-list');
    if (!dropdownList) return;

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

  // Handle keyboard navigation for dropdown
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showDropdown || products.length === 0) return;
      
      // Don't interfere if typing in input
      if (e.target !== searchInputRef.current) return;

      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => {
            const newIndex = prev < products.length - 1 ? prev + 1 : 0;
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
    setSelectedIndex(-1);
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
    // Notify parent component about search change for inventory table
    if (onSearchChange) {
      onSearchChange(value);
    }
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
            <span className="search-icon"></span>
          )}
          <input
            ref={searchInputRef}
            type="text"
            className="search-input product-search-input"
            placeholder="Search products or medicines... (F1 to focus, Tab to inventory table)"
            value={searchTerm}
            onChange={handleSearchChange}
            onFocus={handleSearchFocus}
            onKeyDown={(e) => {
              // Tab - Move to inventory table
              if (e.key === 'Tab' && !e.shiftKey && !showDropdown) {
                // Let default tab behavior work, but focus inventory table
                setTimeout(() => {
                  const inventoryTable = document.querySelector('.inventory-table-container');
                  if (inventoryTable) {
                    inventoryTable.focus();
                  }
                }, 0);
              }
              // Escape - Clear search
              if (e.key === 'Escape') {
                setSearchTerm('');
                setProducts([]);
                setShowDropdown(false);
              }
            }}
            autoComplete="off"
          />
          {loading && (
            <div className="search-loading">
              <span className="loading-spinner">⟳</span>
            </div>
          )}

          {/* Dropdown Results - Shows searched products sorted by relevance */}
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
                    setProducts([]);
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
