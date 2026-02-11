import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import './POSInventoryTable.css';
import API_BASE_URL from '../../config/api';

const POSInventoryTable = ({ searchTerm = '', onAddToCart, token, cart = [] }) => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
  const tableRef = useRef(null);
  const rowRefs = useRef({});

  const authToken = token || localStorage.getItem('pharmacyToken');

  // Fetch all products in stock
  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!authToken) {
        setInventory([]);
        setLoading(false);
        return;
      }

      // Fetch all products that are in stock - use a very high limit to get all products
      const response = await fetch(`${API_BASE_URL}/api/pos/products?limit=100000`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(response);

      if (response.ok) {
        const data = await response.json();
        // Filter only products that are in stock (stock_quantity > 0)
        // Backend should already return only in-stock products for inventory requests, but filter just in case
        const inStockProducts = (data.products || []).filter(
          product => {
            const qty = product.stock_quantity;
            return qty !== undefined && qty !== null && qty > 0;
          }
        );
        setInventory(inStockProducts);
      } else {
        setError('Failed to load inventory');
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setError('Error loading inventory');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort inventory based on search term
  const filteredInventory = useMemo(() => {
    if (!searchTerm.trim()) {
      // If no search term, show all inventory sorted alphabetically
      return [...inventory].sort((a, b) => {
        const nameA = (a.product_name || a.name || '').toLowerCase();
        const nameB = (b.product_name || b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }

    const searchLower = searchTerm.toLowerCase().trim();
    
    // Filter products that match search term
    const filtered = inventory.filter(product => {
      const productName = (product.product_name || product.name || '').toLowerCase();
      const genericName = (product.generic_name || product.description || '').toLowerCase();
      const regNumber = (product.reg_number || '').toLowerCase();
      const manufacturer = (product.manufacturer || '').toLowerCase();
      
      return productName.includes(searchLower) ||
             genericName.includes(searchLower) ||
             regNumber.includes(searchLower) ||
             manufacturer.includes(searchLower);
    });

    // Sort alphabetically by product name
    return filtered.sort((a, b) => {
      const nameA = (a.product_name || a.name || '').toLowerCase();
      const nameB = (b.product_name || b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [inventory, searchTerm]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(price || 0);
  };

  const handleAddToCart = useCallback((product) => {
    onAddToCart(product);
    // Keep focus on table after adding
    setTimeout(() => {
      if (tableRef.current) {
        tableRef.current.focus();
      }
    }, 100);
  }, [onAddToCart]);

  // Keyboard navigation for inventory table
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle if table is focused or no input is focused
      const isInputFocused = e.target.tagName === 'INPUT' || 
                            e.target.tagName === 'TEXTAREA' ||
                            e.target.isContentEditable;
      
      if (isInputFocused && e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') {
        return;
      }

      // Arrow keys - Navigate table rows
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredInventory.length > 0) {
          setSelectedRowIndex(prev => {
            const newIndex = prev < filteredInventory.length - 1 ? prev + 1 : 0;
            scrollToRow(newIndex);
            return newIndex;
          });
        }
        // Focus table container
        if (tableRef.current) {
          tableRef.current.focus();
        }
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredInventory.length > 0) {
          setSelectedRowIndex(prev => {
            const newIndex = prev > 0 ? prev - 1 : filteredInventory.length - 1;
            scrollToRow(newIndex);
            return newIndex;
          });
        }
        // Focus table container
        if (tableRef.current) {
          tableRef.current.focus();
        }
      }

      // Enter - Add selected product to cart
      if (e.key === 'Enter' && selectedRowIndex >= 0 && selectedRowIndex < filteredInventory.length) {
        e.preventDefault();
        const product = filteredInventory[selectedRowIndex];
        if (product && product.stock_quantity > 0) {
          handleAddToCart(product);
        }
      }

      // Home - Go to first row
      if (e.key === 'Home') {
        e.preventDefault();
        if (filteredInventory.length > 0) {
          setSelectedRowIndex(0);
          scrollToRow(0);
        }
      }

      // End - Go to last row
      if (e.key === 'End') {
        e.preventDefault();
        if (filteredInventory.length > 0) {
          const lastIndex = filteredInventory.length - 1;
          setSelectedRowIndex(lastIndex);
          scrollToRow(lastIndex);
        }
      }

      // Page Down
      if (e.key === 'PageDown') {
        e.preventDefault();
        if (filteredInventory.length > 0) {
          setSelectedRowIndex(prev => {
            const newIndex = Math.min(prev + 10, filteredInventory.length - 1);
            scrollToRow(newIndex);
            return newIndex;
          });
        }
      }

      // Page Up
      if (e.key === 'PageUp') {
        e.preventDefault();
        if (filteredInventory.length > 0) {
          setSelectedRowIndex(prev => {
            const newIndex = Math.max(prev - 10, 0);
            scrollToRow(newIndex);
            return newIndex;
          });
        }
      }
    };

    // Reset selection when search term changes
    if (searchTerm) {
      setSelectedRowIndex(0);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredInventory, selectedRowIndex, searchTerm, handleAddToCart]);

  const scrollToRow = (index) => {
    const rowElement = rowRefs.current[`row-${index}`];
    if (rowElement) {
      rowElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  if (loading) {
    return (
      <div className="pos-inventory-table">
        <h2>📦 Available Inventory</h2>
        <div className="inventory-loading">
          <div className="loading-spinner"></div>
          <p>Loading inventory...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pos-inventory-table">
        <h2>📦 Available Inventory</h2>
        <div className="inventory-error">
          <p>❌ {error}</p>
          <button onClick={fetchInventory} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pos-inventory-table">
      <div className="inventory-header">
        <h2>📦 Available Inventory</h2>
        <div className="inventory-count">
          {searchTerm ? (
            <span>{filteredInventory.length} product{filteredInventory.length !== 1 ? 's' : ''} found</span>
          ) : (
            <span>{filteredInventory.length} product{filteredInventory.length !== 1 ? 's' : ''} in stock</span>
          )}
        </div>
      </div>

      <div 
        className="inventory-table-container"
        ref={tableRef}
        tabIndex={0}
        style={{ outline: 'none' }}
        onFocus={() => {
          // Auto-select first row when table gets focus
          if (filteredInventory.length > 0 && selectedRowIndex === -1) {
            setSelectedRowIndex(0);
          }
        }}
      >
        {filteredInventory.length === 0 ? (
          <div className="inventory-empty">
            <p>📭 No products found</p>
            <p className="empty-hint">
              {searchTerm 
                ? `No products match "${searchTerm}"`
                : 'No products in stock'}
            </p>
          </div>
        ) : (
          <>
            <div className="keyboard-hint" style={{
              padding: '8px 12px',
              background: '#e0e7ff',
              borderRadius: '6px',
              marginBottom: '10px',
              fontSize: '0.85rem',
              color: '#4338ca'
            }}>
              ⌨️ <strong>Keyboard:</strong> ↑↓ Navigate • Enter Add • Home/End Jump • Page Up/Down Scroll
            </div>
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Stock</th>
                  <th>Price</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((product, index) => (
                  <tr 
                    key={product.reg_number || product.id}
                    ref={el => rowRefs.current[`row-${index}`] = el}
                    className={`${product.low_stock ? 'low-stock-row' : ''} ${index === selectedRowIndex ? 'selected-row' : ''}`}
                    onClick={() => {
                      setSelectedRowIndex(index);
                      handleAddToCart(product);
                    }}
                  >
                  <td className="product-name-cell">
                    <div className="product-name-main">
                      {product.product_name || product.name || 'Unknown'}
                    </div>
                    {product.generic_name && (
                      <div className="product-name-generic">
                        {product.generic_name}
                      </div>
                    )}
                  </td>
                  <td className="stock-cell">
                    <span className={`stock-badge ${
                      product.stock_quantity <= 0 ? 'stock-out' :
                      product.low_stock ? 'stock-low' : 'stock-available'
                    }`}>
                      {product.stock_quantity || 0}
                    </span>
                  </td>
                  <td className="price-cell">
                    {formatPrice(product.price_rs || product.price || 0)}
                  </td>
                  <td className="action-cell">
                    <button
                      className="add-to-cart-table-btn"
                      onClick={() => handleAddToCart(product)}
                      disabled={product.stock_quantity <= 0}
                      title="Add to cart"
                    >
                      ➕ Add
                    </button>
                  </td>
                </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
};

export default POSInventoryTable;
