import React, { useState, useEffect } from 'react';
import './App.css';
import MedicineList from './components/MedicineList';
import SearchBar from './components/SearchBar';
import FilterPanel from './components/FilterPanel';
import Statistics from './components/Statistics';
import Header from './components/Header';
import Navigation from './components/Navigation';
import POS from './pages/POS';
import SalesHistory from './pages/SalesHistory';
import PurchaseOrders from './pages/PurchaseOrders';
import Profile from './pages/Profile';
import AdminLogin from './pages/Admin/AdminLogin';
import AdminDashboard from './pages/Admin/AdminDashboard';
import API_BASE_URL from './config/api';

function App() {
  const [currentPage, setCurrentPage] = useState('browse');
  const [admin, setAdmin] = useState(null);
  const [adminToken, setAdminToken] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    manufacturer: '',
    minPrice: '',
    maxPrice: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [categories, setCategories] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Check for admin session on mount
  useEffect(() => {
    const savedAdmin = localStorage.getItem('adminUser');
    const savedToken = localStorage.getItem('adminToken');
    if (savedAdmin && savedToken) {
      setAdmin(JSON.parse(savedAdmin));
      setAdminToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (currentPage === 'browse') {
      fetchMedicines();
      fetchCategories();
      fetchManufacturers();
    }
  }, [filters, pagination.page, currentPage]);

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
      });

      const response = await fetch(`${API_BASE_URL}/api/medicines?${params}`);
      if (!response.ok) throw new Error('Failed to fetch medicines');
      
      const data = await response.json();
      setMedicines(data.medicines);
      setPagination(prev => ({
        ...prev,
        total: data.total,
        totalPages: data.totalPages
      }));
      setError(null);
    } catch (err) {
      setError(err.message);
      setMedicines([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchManufacturers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/manufacturers`);
      if (response.ok) {
        const data = await response.json();
        setManufacturers(data);
      }
    } catch (err) {
      console.error('Error fetching manufacturers:', err);
    }
  };

  const handleNavigate = (page) => {
    setCurrentPage(page);
  };

  const handleAdminLogin = (adminData, token) => {
    setAdmin(adminData);
    setAdminToken(token);
    setCurrentPage('admin-dashboard');
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setAdmin(null);
    setAdminToken(null);
    setCurrentPage('browse');
  };

  // Admin routes
  if (!admin && (currentPage === 'admin' || currentPage === 'admin-dashboard')) {
    return <AdminLogin onLogin={handleAdminLogin} />;
  }

  if (admin && currentPage === 'admin-dashboard') {
    return <AdminDashboard admin={admin} token={adminToken} onLogout={handleAdminLogout} />;
  }

  const handleSearchChange = (value) => {
    setFilters(prev => ({ ...prev, search: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      category: '',
      manufacturer: '',
      minPrice: '',
      maxPrice: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  if (currentPage === 'pos') {
    return <POS onNavigate={handleNavigate} />;
  }

  if (currentPage === 'sales') {
    return <SalesHistory onNavigate={handleNavigate} />;
  }

  if (currentPage === 'purchase-orders') {
    return <PurchaseOrders onNavigate={handleNavigate} />;
  }

  if (currentPage === 'profile') {
    return <Profile onNavigate={handleNavigate} />;
  }

  if (currentPage === 'admin') {
    return <AdminLogin onLogin={handleAdminLogin} />;
  }

  return (
    <div className="App">
      <Navigation currentPage={currentPage} onNavigate={handleNavigate} />
      {admin && (
        <div className="admin-badge">
          <span>Admin Mode</span>
          <button onClick={() => setCurrentPage('admin-dashboard')}>Go to Admin Panel</button>
        </div>
      )}
      <Header />
      <div className="container">
        <Statistics />
        <div className="search-section">
          <SearchBar 
            value={filters.search}
            onChange={handleSearchChange}
            onToggleFilters={() => setShowFilters(!showFilters)}
            showFilters={showFilters}
          />
        </div>
        
        {showFilters && (
          <FilterPanel
            filters={filters}
            categories={categories}
            manufacturers={manufacturers}
            onChange={handleFilterChange}
            onClear={clearFilters}
          />
        )}

        {error && (
          <div className="error-message">
            <p>Error: {error}</p>
          </div>
        )}

        <MedicineList 
          medicines={medicines}
          loading={loading}
        />

        {pagination.totalPages > 1 && (
          <div className="pagination">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="pagination-btn"
            >
              Previous
            </button>
            <span className="pagination-info">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
