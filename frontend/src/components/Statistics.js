import React, { useState, useEffect } from 'react';
import './Statistics.css';
import API_BASE_URL from '../config/api';

const Statistics = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/statistics`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return null;
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  return (
    <div className="statistics">
      <div className="stat-card">
        <div className="stat-icon">📦</div>
        <div className="stat-content">
          <div className="stat-value">{stats.totalMedicines}</div>
          <div className="stat-label">Total Medicines</div>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">🏷️</div>
        <div className="stat-content">
          <div className="stat-value">{stats.totalCategories}</div>
          <div className="stat-label">Categories</div>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">🏭</div>
        <div className="stat-content">
          <div className="stat-value">{stats.totalManufacturers}</div>
          <div className="stat-label">Manufacturers</div>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">💰</div>
        <div className="stat-content">
          <div className="stat-value">{formatPrice(stats.averagePrice)}</div>
          <div className="stat-label">Average Price</div>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">📊</div>
        <div className="stat-content">
          <div className="stat-value">{formatPrice(stats.minPrice)}</div>
          <div className="stat-label">Min Price</div>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">📈</div>
        <div className="stat-content">
          <div className="stat-value">{formatPrice(stats.maxPrice)}</div>
          <div className="stat-label">Max Price</div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;

