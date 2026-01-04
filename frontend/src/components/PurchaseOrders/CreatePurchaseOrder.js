import React, { useState, useEffect } from 'react';
import './CreatePurchaseOrder.css';
import API_BASE_URL from '../../config/api';
import AddCustomProduct from '../POS/AddCustomProduct';

const CreatePurchaseOrder = ({ onClose, onSuccess, token }) => {
  const [items, setItems] = useState([{ name: '', quantity: 1, price: 0 }]);
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = React.useRef(null);
  const dropdownRef = React.useRef(null);

  const searchProducts = React.useCallback(async () => {
    if (!searchTerm || searchTerm.trim().length < 1) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm && searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const authToken = token || localStorage.getItem('token');
      if (!authToken) {
        setSearchResults([]);
        setLoading(false);
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      };

      const response = await fetch(`${API_BASE_URL}/api/pos/products?${params}`, {
        method: 'GET',
        headers: headers
      });

      if (response.ok) {
        const data = await response.json();
        const productsArray = Array.isArray(data.products) ? data.products : [];
        setSearchResults(productsArray.slice(0, 15)); // Limit to 15 results
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, token]);

  useEffect(() => {
    // Search immediately on first character, then debounce for subsequent characters
    if (searchTerm.trim().length === 1) {
      searchProducts();
    } else if (searchTerm.trim().length > 1) {
      const delayDebounce = setTimeout(() => {
        searchProducts();
      }, 200);
      return () => clearTimeout(delayDebounce);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, searchProducts]);

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, price: 0 }]);
  };

  const addProductToItems = (product) => {
    const newItem = {
      name: product.product_name || product.name,
      quantity: 1,
      price: product.price_rs || product.price
    };
    setItems([...items, newItem]);
    setSearchTerm('');
    setSearchResults([]);
    setSelectedIndex(-1);
    searchInputRef.current?.focus();
  };

  // Scroll selected item into view
  const scrollToSelectedItem = () => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const selectedElement = dropdownRef.current.children[selectedIndex];
      if (selectedElement) {
        setTimeout(() => {
          selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
      }
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const newIndex = prev < searchResults.length - 1 ? prev + 1 : prev;
        setTimeout(() => scrollToSelectedItem(), 0);
        return newIndex;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const newIndex = prev > 0 ? prev - 1 : -1;
        setTimeout(() => scrollToSelectedItem(), 0);
        return newIndex;
      });
    } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < searchResults.length) {
      e.preventDefault();
      addProductToItems(searchResults[selectedIndex]);
    } else if (e.key === 'Escape') {
      setSearchResults([]);
      setSelectedIndex(-1);
    }
  };

  const handleProductAdded = (product) => {
    addProductToItems({
      ...product,
      product_name: product.name,
      price_rs: product.price
    });
    setShowAddProduct(false);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!supplierName.trim()) {
      alert('Supplier name is required');
      return;
    }

    const validItems = items.filter(item => item.name.trim() && item.quantity > 0 && item.price >= 0);
    if (validItems.length === 0) {
      alert('At least one valid item is required');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          items: validItems,
          supplierName,
          supplierContact,
          expectedDate,
          notes
        })
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create purchase order');
      }
    } catch (err) {
      console.error('Error creating purchase order:', err);
      alert('Failed to create purchase order');
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  return (
    <div className="create-po-overlay" onClick={onClose}>
      <div className="create-po-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Purchase Order</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="create-po-form">
          <div className="form-section">
            <h3>Supplier Information</h3>
            <div className="form-group">
              <label>Supplier Name *</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Contact</label>
              <input
                type="text"
                value={supplierContact}
                onChange={(e) => setSupplierContact(e.target.value)}
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Items</h3>
            
            {/* Product Search */}
            <div className="product-search-section">
              <div className="search-input-wrapper">
                {!loading && (!searchTerm || searchTerm.trim().length === 0) && (
                  <span className="search-icon">🔍</span>
                )}
                {loading && (
                  <span className="loading-spinner">⏳</span>
                )}
                <input
                  ref={searchInputRef}
                  type="text"
                  className="product-search-input"
                  placeholder="Search medicines from centralized DB or custom products... (↑↓ to navigate, Enter to select)"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSelectedIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    if (searchTerm.trim().length >= 1 && searchResults.length > 0) {
                      // Keep dropdown open if there are results
                    }
                  }}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="add-custom-product-btn"
                  onClick={() => setShowAddProduct(true)}
                >
                  + Add Custom
                </button>
              </div>
              
              {(searchResults.length > 0 || (loading && searchTerm.trim().length >= 1)) && (
                <div className="search-results" ref={dropdownRef}>
                  {loading && searchTerm.trim().length >= 1 ? (
                    <div className="search-loading">Searching...</div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((product, index) => (
                      <div
                        key={product.reg_number || product.id || product.custom_product_id}
                        className={`search-result-item ${selectedIndex === index ? 'selected' : ''}`}
                        onClick={() => addProductToItems(product)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <div className="result-info">
                          <div className="result-name-wrapper">
                            <strong>{product.product_name}</strong>
                            <span className={`product-type-badge ${product.isCustom ? 'custom' : 'medicine'}`}>
                              {product.isCustom ? 'Custom' : 'Medicine'}
                            </span>
                          </div>
                          <span className="result-price">
                            {new Intl.NumberFormat('en-PK', {
                              style: 'currency',
                              currency: 'PKR',
                              minimumFractionDigits: 2
                            }).format(product.price_rs || 0)}
                          </span>
                        </div>
                        {product.generic_name && (
                          <small>{product.generic_name}</small>
                        )}
                        {product.manufacturer && (
                          <small>Manufacturer: {product.manufacturer}</small>
                        )}
                      </div>
                    ))
                  ) : searchTerm.trim().length >= 1 ? (
                    <div className="search-no-results">No products found. Try a different search term or add a custom product.</div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="items-list">
              {items.map((item, index) => (
                <div key={index} className="item-row">
                  <input
                    type="text"
                    placeholder="Item name"
                    value={item.name}
                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                    className="item-name"
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                    min="1"
                    className="item-qty"
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    value={item.price}
                    onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    className="item-price"
                  />
                  <button
                    type="button"
                    className="remove-item-btn"
                    onClick={() => removeItem(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            
            <button type="button" className="add-item-btn" onClick={addItem}>
              + Add Item Manually
            </button>
          </div>

          <div className="form-section">
            <h3>Additional Information</h3>
            <div className="form-group">
              <label>Expected Delivery Date</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows="3"
              />
            </div>
          </div>

          <div className="form-total">
            <strong>Total: {new Intl.NumberFormat('en-PK', {
              style: 'currency',
              currency: 'PKR',
              minimumFractionDigits: 2
            }).format(calculateTotal())}</strong>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit">
              Create Purchase Order
            </button>
          </div>
        </form>
      </div>

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

export default CreatePurchaseOrder;

