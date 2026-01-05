import React, { useState } from 'react';
import './PharmacyLogin.css';
import API_BASE_URL from '../config/api';

const PharmacyLogin = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem('pharmacyToken', data.token);
        localStorage.setItem('pharmacyUser', JSON.stringify(data.user));
        onLogin(data.user, data.token);
      } else {
        // Display error message from server (includes 500 errors)
        setError(data.error || data.message || `Login failed (${response.status})`);
      }
    } catch (err) {
      // Network error or JSON parsing error
      setError('Network error. Please check your connection and server status.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pharmacy-login-container">
      <div className="pharmacy-login-card">
        <div className="login-header">
          <h1>💊 Pharmacy Login</h1>
          <p>Access Your POS System</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              placeholder="Enter your username"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Login to POS'}
          </button>
        </form>

        <div className="login-footer">
          <p>Don't have an account? Contact your administrator.</p>
          <p className="hint">💡 First time login? Default password is usually 'password123'</p>
        </div>
      </div>
    </div>
  );
};

export default PharmacyLogin;

