import React, { useState } from 'react';
import './AddCustomProduct.css';
import API_BASE_URL from '../../config/api';

const AddCustomProduct = ({ onClose, onSuccess, token }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'General',
    unit: 'piece',
    barcode: '',
    stock: 0
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'price' || name === 'stock' ? (value === '' ? '' : parseFloat(value) || 0) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.price) {
      alert('Name and price are required');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/custom-products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        onSuccess(data.product);
        onClose();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add product');
      }
    } catch (err) {
      console.error('Error adding product:', err);
      alert('Failed to add product');
    }
  };

  return (
    <div className="add-product-overlay" onClick={onClose}>
      <div className="add-product-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Custom Product</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="add-product-form">
          <div className="form-group">
            <label>Product Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Price (Rs) *</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                min="0"
                step="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="General"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Unit</label>
              <select
                name="unit"
                value={formData.unit}
                onChange={handleChange}
              >
                <option value="piece">Piece</option>
                <option value="pack">Pack</option>
                <option value="box">Box</option>
                <option value="bottle">Bottle</option>
                <option value="kg">Kg</option>
                <option value="gram">Gram</option>
                <option value="liter">Liter</option>
                <option value="ml">ML</option>
              </select>
            </div>

            <div className="form-group">
              <label>Stock Quantity</label>
              <input
                type="number"
                name="stock"
                value={formData.stock}
                onChange={handleChange}
                min="0"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Barcode (Optional)</label>
            <input
              type="text"
              name="barcode"
              value={formData.barcode}
              onChange={handleChange}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit">
              Add Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCustomProduct;

