import React, { useState } from 'react';
import './CreatePharmacy.css';
import API_BASE_URL from '../../config/api';

const CreatePharmacy = ({ token, onSuccess }) => {
  const [formData, setFormData] = useState({
    username: '',
    pharmacyName: '',
    ownerName: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    licenseNumber: '',
    taxId: '',
    subscriptionStatus: 'trial'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/pharmacies`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onSuccess();
        // Reset form
        setFormData({
          username: '',
          pharmacyName: '',
          ownerName: '',
          address: '',
          city: '',
          phone: '',
          email: '',
          licenseNumber: '',
          taxId: '',
          subscriptionStatus: 'trial'
        });
      } else {
        setError(data.error || 'Failed to create pharmacy');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-pharmacy">
      <h2>Create New Pharmacy Account</h2>

      {error && (
        <div className="error-message">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="pharmacy-form">
        <div className="form-row">
          <div className="form-group">
            <label>Username *</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Pharmacy Name *</label>
            <input
              type="text"
              name="pharmacyName"
              value={formData.pharmacyName}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Owner Name</label>
            <input
              type="text"
              name="ownerName"
              value={formData.ownerName}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>City</label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Address</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>License Number</label>
            <input
              type="text"
              name="licenseNumber"
              value={formData.licenseNumber}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>Tax ID</label>
            <input
              type="text"
              name="taxId"
              value={formData.taxId}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Subscription Status</label>
          <select
            name="subscriptionStatus"
            value={formData.subscriptionStatus}
            onChange={handleChange}
          >
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        <div className="form-actions">
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Creating...' : 'Create Pharmacy'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePharmacy;

