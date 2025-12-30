import React, { useState, useEffect } from 'react';
import './CreatePurchaseOrder.css';
import API_BASE_URL from '../../config/api';
import AddCustomProduct from '../POS/AddCustomProduct';

const CreatePurchaseOrder = ({ onClose, onSuccess }) => {
  const [items, setItems] = useState([{ name: '', quantity: 1, price: 0 }]);
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchTerm.length >= 2) {
        searchProducts();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  const searchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`${API_BASE_URL}/api/pos/products?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.products.slice(0, 10)); // Limit to 10 results
      }
    } catch (err) {
      console.error('Error searching products:', err);
    } finally {
      setLoading(false);
    }
  };

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
          'Content-Type': 'application/json'
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
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="product-search-input"
                  placeholder="Search medicines or products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button
                  type="button"
                  className="add-custom-product-btn"
                  onClick={() => setShowAddProduct(true)}
                >
                  + Add Custom
                </button>
              </div>
              
              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map((product) => (
                    <div
                      key={product.reg_number || product.id}
                      className="search-result-item"
                      onClick={() => addProductToItems(product)}
                    >
                      <div className="result-info">
                        <strong>{product.product_name}</strong>
                        <span className="result-price">
                          {new Intl.NumberFormat('en-PK', {
                            style: 'currency',
                            currency: 'PKR',
                            minimumFractionDigits: 2
                          }).format(product.price_rs)}
                        </span>
                      </div>
                      {product.generic_name && (
                        <small>{product.generic_name}</small>
                      )}
                    </div>
                  ))}
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
          onClose={() => setShowAddProduct(false)}
          onSuccess={handleProductAdded}
        />
      )}
    </div>
  );
};

export default CreatePurchaseOrder;

