import React, { useState, useEffect } from 'react';
import './PurchaseOrders.css';
import Navigation from '../components/Navigation';
import API_BASE_URL from '../config/api';
import CreatePurchaseOrder from '../components/PurchaseOrders/CreatePurchaseOrder';
import PurchaseOrderDetail from '../components/PurchaseOrders/PurchaseOrderDetail';

const PurchaseOrders = ({ onNavigate }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      params.append('limit', '100');

      const response = await fetch(`${API_BASE_URL}/api/purchase-orders?${params}`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders);
      }
    } catch (err) {
      console.error('Error fetching purchase orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus, receivedDate) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus, receivedDate })
      });

      if (response.ok) {
        fetchOrders();
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(null);
        }
      }
    } catch (err) {
      console.error('Error updating status:', err);
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
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#ffc107',
      approved: '#17a2b8',
      received: '#28a745',
      cancelled: '#dc3545'
    };
    return colors[status] || '#6c757d';
  };

  if (loading) {
    return (
      <div className="purchase-orders-container">
        <div className="loading">Loading purchase orders...</div>
      </div>
    );
  }

  return (
    <div className="purchase-orders-container">
      <Navigation currentPage="purchase-orders" onNavigate={onNavigate} />
      <div className="po-header">
        <h1>📦 Purchase Orders</h1>
        <div className="po-header-actions">
          <select
            className="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button className="btn-create" onClick={() => setShowCreate(true)}>
            + Create Purchase Order
          </button>
        </div>
      </div>

      <div className="orders-list">
        {orders.length === 0 ? (
          <div className="empty-state">
            <p>No purchase orders found</p>
            <button className="btn-create" onClick={() => setShowCreate(true)}>
              Create Your First Purchase Order
            </button>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="order-card"
              onClick={() => setSelectedOrder(order)}
            >
              <div className="order-header">
                <div>
                  <strong>{order.id}</strong>
                  <span className="order-date">{formatDate(order.date)}</span>
                </div>
                <span
                  className="order-status"
                  style={{ backgroundColor: getStatusColor(order.status) }}
                >
                  {order.status.toUpperCase()}
                </span>
              </div>
              <div className="order-details">
                <div className="order-info">
                  <p><strong>Supplier:</strong> {order.supplier.name}</p>
                  {order.expectedDate && (
                    <p><strong>Expected:</strong> {formatDate(order.expectedDate)}</p>
                  )}
                  <p><strong>Items:</strong> {order.items.length}</p>
                </div>
                <div className="order-total">
                  {formatPrice(order.subtotal)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <CreatePurchaseOrder
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            fetchOrders();
          }}
        />
      )}

      {selectedOrder && (
        <PurchaseOrderDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusUpdate={handleStatusUpdate}
        />
      )}
    </div>
  );
};

export default PurchaseOrders;

