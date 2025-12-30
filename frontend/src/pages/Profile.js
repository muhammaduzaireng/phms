import React, { useState, useEffect } from 'react';
import './Profile.css';
import Navigation from '../components/Navigation';
import API_BASE_URL from '../config/api';

const Profile = ({ onNavigate }) => {
  const [profile, setProfile] = useState({
    pharmacyName: '',
    ownerName: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    licenseNumber: '',
    taxId: '',
    logo: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profile)
      });

      if (response.ok) {
        setMessage('Profile updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to update profile');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setMessage('Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <Navigation currentPage="profile" onNavigate={onNavigate} />
      <div className="profile-header">
        <h1>⚙️ Pharmacy Profile</h1>
        <p>Manage your pharmacy information and settings</p>
      </div>

      {message && (
        <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="profile-form">
        <div className="form-section">
          <h2>Basic Information</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Pharmacy Name *</label>
              <input
                type="text"
                name="pharmacyName"
                value={profile.pharmacyName}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Owner Name</label>
              <input
                type="text"
                name="ownerName"
                value={profile.ownerName}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Contact Information</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Address</label>
              <input
                type="text"
                name="address"
                value={profile.address}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                name="city"
                value={profile.city}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                name="phone"
                value={profile.phone}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={profile.email}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Legal Information</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>License Number</label>
              <input
                type="text"
                name="licenseNumber"
                value={profile.licenseNumber}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Tax ID</label>
              <input
                type="text"
                name="taxId"
                value={profile.taxId}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Logo URL</h2>
          <div className="form-group">
            <label>Logo URL (optional)</label>
            <input
              type="url"
              name="logo"
              value={profile.logo}
              onChange={handleChange}
              placeholder="https://example.com/logo.png"
            />
            {profile.logo && (
              <div className="logo-preview">
                <img src={profile.logo} alt="Logo preview" onError={(e) => e.target.style.display = 'none'} />
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Profile;

