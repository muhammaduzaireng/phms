import React, { useState, useEffect } from 'react';
import './PharmacyList.css';
import API_BASE_URL from '../../config/api';

const PharmacyList = ({ token, onEdit }) => {
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchPharmacies();
  }, [search]);

  const fetchPharmacies = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const response = await fetch(`${API_BASE_URL}/api/admin/pharmacies?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPharmacies(data.pharmacies || []);
      }
    } catch (err) {
      console.error('Error fetching pharmacies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/pharmacies/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });

      if (response.ok) {
        fetchPharmacies();
      }
    } catch (err) {
      console.error('Error updating pharmacy:', err);
    }
  };

  if (loading) {
    return <div className="loading">Loading pharmacies...</div>;
  }

  return (
    <div className="pharmacy-list">
      <div className="list-header">
        <h2>Manage Pharmacies</h2>
        <input
          type="text"
          className="search-input"
          placeholder="Search pharmacies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="pharmacies-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Pharmacy Name</th>
              <th>Owner</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Sales</th>
              <th>Orders</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pharmacies.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty">No pharmacies found</td>
              </tr>
            ) : (
              pharmacies.map(pharmacy => (
                <tr key={pharmacy.id}>
                  <td>{pharmacy.id}</td>
                  <td><strong>{pharmacy.pharmacy_name}</strong></td>
                  <td>{pharmacy.owner_name || '-'}</td>
                  <td>{pharmacy.email || '-'}</td>
                  <td>{pharmacy.phone || '-'}</td>
                  <td>{pharmacy.total_sales || 0}</td>
                  <td>{pharmacy.total_purchase_orders || 0}</td>
                  <td>
                    <span className={`status-badge ${pharmacy.is_active ? 'active' : 'inactive'}`}>
                      {pharmacy.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="toggle-btn"
                      onClick={() => handleToggleActive(pharmacy.id, pharmacy.is_active)}
                    >
                      {pharmacy.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PharmacyList;

