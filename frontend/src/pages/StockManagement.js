import React, { useState, useEffect, useCallback } from 'react';
import './StockManagement.css';
import Navigation from '../components/Navigation';
import AddCustomProduct from '../components/POS/AddCustomProduct';
import API_BASE_URL from '../config/api';

const StockManagement = ({ onNavigate, user, token }) => {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    medicineRegNumber: '',
    customProductId: '',
    quantity: 0,
    unitPrice: 0, // Selling price
    purchasePrice: 0, // Purchase price
    minStockLevel: 0,
    maxStockLevel: 0,
    expiryDate: '',
    batchNumber: '',
    location: ''
  });
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showAddCustomProduct, setShowAddCustomProduct] = useState(false);

  const authToken = token || localStorage.getItem('pharmacyToken');

  // Define searchProducts before useEffect that uses it
  const searchProducts = useCallback(async (searchTerm) => {
    if (!searchTerm || searchTerm.trim().length < 1) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/pos/products?search=${encodeURIComponent(searchTerm)}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.products || []);
        setShowSearchResults(true); // Always show results (even if empty) so user can add custom product
      } else {
        // Even if response is not ok, show the "no results" message
        setSearchResults([]);
        setShowSearchResults(true);
      }
    } catch (error) {
      // On error, still show "no results" so user can add custom product
      setSearchResults([]);
      setShowSearchResults(true);
    } finally {
      setSearchLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchStock();
  }, []);

  // Search products when productSearch changes
  useEffect(() => {
    let timeoutId;
    if (productSearch.trim().length >= 1) {
      timeoutId = setTimeout(() => {
        searchProducts(productSearch);
      }, 300);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [productSearch, searchProducts]);

  const fetchStock = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/stock`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStock(data);
      }
    } catch (error) {
      alert('Error fetching stock');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setFormData({
      medicineRegNumber: item.medicine_reg_number || '',
      customProductId: item.custom_product_id || '',
      quantity: item.quantity || 0,
      unitPrice: parseFloat(item.unit_price || 0), // Selling price
      purchasePrice: parseFloat(item.purchase_price || 0), // Purchase price
      minStockLevel: item.min_stock_level || 0,
      maxStockLevel: item.max_stock_level || 0,
      expiryDate: item.expiry_date ? item.expiry_date.split('T')[0] : '',
      batchNumber: item.batch_number || '',
      location: item.location || ''
    });
    setProductSearch(item.medicine_name || item.custom_product_name || '');
    setSearchResults([]);
    setShowSearchResults(false);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setSelectedItem(null);
    setFormData({
      medicineRegNumber: '',
      customProductId: '',
      quantity: 0,
      unitPrice: 0, // Selling price
      purchasePrice: 0, // Purchase price
      minStockLevel: 0,
      maxStockLevel: 0,
      expiryDate: '',
      batchNumber: '',
      location: ''
    });
    setProductSearch('');
    setSearchResults([]);
    setShowSearchResults(false);
    setShowForm(true);
  };

  const handleProductSelect = (product) => {
    if (product.isCustom) {
      setFormData(prev => ({
        ...prev,
        customProductId: product.custom_product_id || product.id,
        medicineRegNumber: '',
        unitPrice: product.price_rs || 0
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        medicineRegNumber: product.reg_number,
        customProductId: '',
        unitPrice: product.price_rs || 0
      }));
    }
    setProductSearch(product.product_name);
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const handleCustomProductAdded = async (customProduct) => {
    // After custom product is created, search again to get it with proper format
    // Or format it to match the expected product structure
    const formattedProduct = {
      product_name: customProduct.name,
      custom_product_id: customProduct.id,
      id: customProduct.id,
      isCustom: true,
      price_rs: customProduct.price || 0
    };
    
    // Select the newly created product
    handleProductSelect(formattedProduct);
    
    // Close the add custom product modal
    setShowAddCustomProduct(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.medicineRegNumber && !formData.customProductId) {
      alert('Please search and select a product from the centralized database or custom products');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/stock/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert(selectedItem ? 'Stock updated successfully!' : 'Stock added successfully!');
        setShowForm(false);
        fetchStock();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update stock');
      }
    } catch (error) {
      alert('Error updating stock');
    }
  };

  const filteredStock = stock.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    const productName = (item.medicine_name || item.custom_product_name || '').toLowerCase();
    return productName.includes(searchLower);
  });

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(price || 0);
  };

  if (loading) {
    return (
      <div className="stock-management-container">
        <div className="loading">Loading stock...</div>
      </div>
    );
  }

  return (
    <div className="stock-management-container">
      <Navigation currentPage="stock" onNavigate={onNavigate} />
      <div className="stock-header">
        <h1>📦 Stock Management</h1>
        <button className="btn-add" onClick={handleAddNew}>
          ➕ Add Stock
        </button>
      </div>

      <div className="stock-search">
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="stock-list">
        {filteredStock.length === 0 ? (
          <div className="empty-state">
            <p>No stock items found</p>
            <button className="btn-add" onClick={handleAddNew}>
              Add First Stock Item
            </button>
          </div>
        ) : (
          <table className="stock-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Quantity</th>
                <th>Purchase Price</th>
                <th>Sell Price</th>
                <th>Profit/Unit</th>
                <th>Total Value</th>
                <th>Min Level</th>
                <th>Max Level</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStock.map((item) => {
                const purchasePrice = parseFloat(item.purchase_price || 0);
                const sellPrice = parseFloat(item.unit_price || 0);
                const profitPerUnit = sellPrice - purchasePrice;
                return (
                  <tr key={item.id} className={item.quantity <= item.min_stock_level ? 'low-stock' : ''}>
                    <td>
                      <strong>{item.medicine_name || item.custom_product_name}</strong>
                      {item.batch_number && <small> (Batch: {item.batch_number})</small>}
                    </td>
                    <td>
                      <span className={item.quantity <= item.min_stock_level ? 'quantity-low' : ''}>
                        {item.quantity}
                      </span>
                    </td>
                    <td>{formatPrice(purchasePrice)}</td>
                    <td>{formatPrice(sellPrice)}</td>
                    <td className={profitPerUnit >= 0 ? 'profit-positive' : 'profit-negative'}>
                      {formatPrice(profitPerUnit)}
                    </td>
                    <td>{formatPrice(sellPrice * (item.quantity || 0))}</td>
                    <td>{item.min_stock_level || 0}</td>
                    <td>{item.max_stock_level || 0}</td>
                    <td>{item.location || '-'}</td>
                    <td>
                      <button className="btn-edit" onClick={() => handleEdit(item)}>
                        ✏️ Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedItem ? 'Edit Stock' : 'Add Stock'}</h2>
              <button className="close-btn" onClick={() => setShowForm(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="stock-form">
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Search Product (Medicine or Custom Product) *</label>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    // useEffect will handle the search with debounce
                  }}
                  onFocus={() => {
                    // Show search results when input is focused if there's a search term
                    if (productSearch.trim().length >= 1) {
                      setShowSearchResults(true);
                    }
                  }}
                  onBlur={() => {
                    // Close dropdown after a short delay to allow click events
                    setTimeout(() => {
                      setShowSearchResults(false);
                    }, 200);
                  }}
                  placeholder="Type product name to search..."
                  required
                />
                {searchLoading && (
                  <div style={{ position: 'absolute', right: '10px', top: '45px' }}>Loading...</div>
                )}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="product-search-dropdown" style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    marginTop: '5px'
                  }}>
                    {searchResults.map((product, index) => (
                      <div
                        key={index}
                        className="product-search-item"
                        onClick={() => handleProductSelect(product)}
                        style={{
                          padding: '12px',
                          cursor: 'pointer',
                          borderBottom: index < searchResults.length - 1 ? '1px solid #eee' : 'none'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                      >
                        <div style={{ fontWeight: '600', color: '#333' }}>
                          {product.product_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          {product.isCustom ? (
                            <>Custom Product • Price: PKR {product.price_rs || 0}</>
                          ) : (
                            <>Reg: {product.reg_number} • {product.generic_name} • PKR {product.price_rs || 0}</>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {(showSearchResults && searchResults.length === 0 && productSearch.trim().length >= 1 && !searchLoading) && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '12px',
                    zIndex: 1000,
                    marginTop: '5px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ color: '#666', fontSize: '14px' }}>
                      No products found matching "{productSearch}"
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAddCustomProduct(true);
                      }}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#2563eb'}
                    >
                      ➕ Add "{productSearch}" as Custom Product
                    </button>
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Medicine Registration Number (auto-filled if medicine selected)</label>
                  <input
                    type="text"
                    value={formData.medicineRegNumber}
                    onChange={(e) => setFormData({ ...formData, medicineRegNumber: e.target.value })}
                    placeholder="Auto-filled from search"
                    readOnly={!!productSearch}
                  />
                </div>
                <div className="form-group">
                  <label>Custom Product ID (auto-filled if custom product selected)</label>
                  <input
                    type="number"
                    value={formData.customProductId}
                    onChange={(e) => setFormData({ ...formData, customProductId: e.target.value })}
                    placeholder="Auto-filled from search"
                    readOnly={!!productSearch}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Quantity *</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                    min="0"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Purchase Price (PKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                    min="0"
                    required
                    placeholder="Price you paid to buy"
                  />
                  <small style={{ color: '#666', fontSize: '12px' }}>Price you paid to purchase this item</small>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Sell Price / Unit Price (PKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.unitPrice}
                    onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                    min="0"
                    required
                    placeholder="Price you sell to customer"
                  />
                  <small style={{ color: '#666', fontSize: '12px' }}>Price you sell this item to customers</small>
                </div>
                <div className="form-group">
                  <label>Expected Profit per Unit</label>
                  <input
                    type="text"
                    value={formatPrice((formData.unitPrice || 0) - (formData.purchasePrice || 0))}
                    readOnly
                    style={{ 
                      backgroundColor: '#f5f5f5', 
                      color: (formData.unitPrice - formData.purchasePrice) >= 0 ? '#137333' : '#c5221f',
                      fontWeight: 'bold'
                    }}
                  />
                  <small style={{ color: '#666', fontSize: '12px' }}>Calculated automatically (Sell Price - Purchase Price)</small>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Min Stock Level</label>
                  <input
                    type="number"
                    value={formData.minStockLevel}
                    onChange={(e) => setFormData({ ...formData, minStockLevel: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Max Stock Level</label>
                  <input
                    type="number"
                    value={formData.maxStockLevel}
                    onChange={(e) => setFormData({ ...formData, maxStockLevel: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Expiry Date</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Batch Number</label>
                  <input
                    type="text"
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    placeholder="Batch number"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Storage location"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  {selectedItem ? 'Update Stock' : 'Add Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddCustomProduct && (
        <AddCustomProduct
          initialName={productSearch}
          onClose={() => setShowAddCustomProduct(false)}
          onSuccess={handleCustomProductAdded}
          token={authToken}
        />
      )}
    </div>
  );
};

export default StockManagement;

