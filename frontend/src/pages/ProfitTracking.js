import React, { useState, useEffect } from 'react';
import './ProfitTracking.css';
import API_BASE_URL from '../config/api';

const ProfitTracking = ({ token, user, onBack, onLogout }) => {
  const [period, setPeriod] = useState('daily'); // daily, weekly, monthly, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [profitData, setProfitData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if user is logged in
  useEffect(() => {
    const authToken = token || localStorage.getItem('pharmacyToken');
    if (!authToken) {
      setError('Please login to view profit reports');
      if (onLogout) {
        setTimeout(() => {
          onLogout();
        }, 2000);
      }
    }
  }, [token, onLogout]);

  useEffect(() => {
    if (token || localStorage.getItem('pharmacyToken')) {
      fetchProfitData();
    }
  }, [period, startDate, endDate, token]);

  const fetchProfitData = async () => {
    const authToken = token || localStorage.getItem('pharmacyToken');
    if (!authToken) {
      setError('Please login to view profit reports');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let queryParams = '';
      const today = new Date();
      let start, end;

      switch (period) {
        case 'daily':
          start = today.toISOString().split('T')[0];
          end = start;
          break;
        case 'weekly':
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          start = weekStart.toISOString().split('T')[0];
          end = today.toISOString().split('T')[0];
          break;
        case 'monthly':
          start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
          end = today.toISOString().split('T')[0];
          break;
        case 'custom':
          if (!startDate || !endDate) {
            setLoading(false);
            return;
          }
          start = startDate;
          end = endDate;
          break;
        default:
          start = today.toISOString().split('T')[0];
          end = start;
      }

      queryParams = `?startDate=${start}&endDate=${end}`;

      const response = await fetch(
        `${API_BASE_URL}/api/sales/daily-profit${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          setError('Session expired. Please login again.');
          if (onLogout) {
            setTimeout(() => {
              onLogout();
            }, 2000);
          }
          return;
        }
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch profit data');
        return;
      }

      const data = await response.json();
      
      // Calculate aggregated stats
      const totalProfit = data.reduce((sum, day) => sum + parseFloat(day.total_profit || 0), 0);
      const totalSales = data.reduce((sum, day) => sum + parseInt(day.total_sales || 0), 0);
      const averageProfit = data.length > 0 ? totalProfit / data.length : 0;

      // Also get sales data to calculate total revenue
      const salesResponse = await fetch(
        `${API_BASE_URL}/api/sales/sales-stats${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      let totalRevenue = 0;
      if (salesResponse.ok) {
        const salesData = await salesResponse.json();
        totalRevenue = salesData.totalRevenue || 0;
      }

      setProfitData({
        dailyProfits: data,
        summary: {
          totalProfit,
          totalRevenue,
          totalSales,
          averageProfit,
          period,
          startDate: start,
          endDate: end
        }
      });
    } catch (err) {
      setError('Failed to fetch profit data. Please check your connection.');
      console.error('Error fetching profit data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(price);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Check authentication before rendering
  const authToken = token || localStorage.getItem('pharmacyToken');
  if (!authToken) {
    return (
      <div className="profit-tracking-container">
        <div className="auth-error">
          <h2>🔒 Authentication Required</h2>
          <p>Please login to view profit reports.</p>
          {onBack && (
            <button onClick={onBack} className="back-btn">← Back</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="profit-tracking-container">
      {onBack && (
        <button onClick={onBack} className="back-btn">← Back</button>
      )}

      <div className="profit-header">
        <h2>💰 Profit Tracking</h2>
        {user && (
          <p>🏥 {user.pharmacyName || user.username}</p>
        )}
      </div>

      <div className="period-selector">
        <button
          className={period === 'daily' ? 'active' : ''}
          onClick={() => setPeriod('daily')}
        >
          📅 Daily
        </button>
        <button
          className={period === 'weekly' ? 'active' : ''}
          onClick={() => setPeriod('weekly')}
        >
          📆 Weekly
        </button>
        <button
          className={period === 'monthly' ? 'active' : ''}
          onClick={() => setPeriod('monthly')}
        >
          📊 Monthly
        </button>
        <button
          className={period === 'custom' ? 'active' : ''}
          onClick={() => setPeriod('custom')}
        >
          📋 Custom Range
        </button>
      </div>

      {period === 'custom' && (
        <div className="custom-date-range">
          <div className="date-input-group">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate || new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="date-input-group">
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          {(startDate && endDate) && (
            <button onClick={fetchProfitData} className="fetch-btn">
              Get Report
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">Loading profit data...</div>
      ) : profitData ? (
        <>
          <div className="profit-summary">
            <div className="summary-card">
              <h3>Total Profit</h3>
              <p className="amount profit">{formatPrice(profitData.summary.totalProfit)}</p>
            </div>
            <div className="summary-card">
              <h3>Total Revenue</h3>
              <p className="amount revenue">{formatPrice(profitData.summary.totalRevenue)}</p>
            </div>
            <div className="summary-card">
              <h3>Total Sales</h3>
              <p className="count">{profitData.summary.totalSales}</p>
            </div>
            <div className="summary-card">
              <h3>Average Daily Profit</h3>
              <p className="amount average">{formatPrice(profitData.summary.averageProfit)}</p>
            </div>
          </div>

          <div className="profit-details">
            <h3>Daily Breakdown</h3>
            {profitData.dailyProfits.length === 0 ? (
              <div className="no-data">
                <p>No profit data available for the selected period.</p>
              </div>
            ) : (
              <table className="profit-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Total Sales</th>
                    <th>Total Profit</th>
                    <th>Average Profit per Sale</th>
                  </tr>
                </thead>
                <tbody>
                  {profitData.dailyProfits.map((day, index) => {
                    const avgProfitPerSale = day.total_sales > 0 
                      ? parseFloat(day.total_profit) / parseInt(day.total_sales) 
                      : 0;
                    return (
                      <tr key={index}>
                        <td>{formatDate(day.date)}</td>
                        <td>{day.total_sales || 0}</td>
                        <td className="profit-amount">{formatPrice(day.total_profit || 0)}</td>
                        <td className="avg-profit">{formatPrice(avgProfitPerSale)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <div className="no-data">
          <p>Select a period to view profit data</p>
        </div>
      )}
    </div>
  );
};

export default ProfitTracking;

