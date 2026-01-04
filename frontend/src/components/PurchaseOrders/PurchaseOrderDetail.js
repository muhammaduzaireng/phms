import React, { useState } from 'react';
import './PurchaseOrderDetail.css';
import API_BASE_URL from '../../config/api';

const PurchaseOrderDetail = ({ order, onClose, onStatusUpdate }) => {
  const [newStatus, setNewStatus] = useState(order.status);
  const [receivedDate, setReceivedDate] = useState('');

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
    return date.toLocaleString('en-PK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleStatusChange = async () => {
    await onStatusUpdate(order.id, newStatus, receivedDate || new Date().toISOString());
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#ffc107',
      approved: '#17a2b8',
      partial: '#ff9800',
      received: '#28a745',
      cancelled: '#dc3545'
    };
    return colors[status] || '#6c757d';
  };

  return (
    <div className="po-detail-overlay" onClick={onClose}>
      <div className="po-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Purchase Order Details</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="po-detail-content">
          <div className="detail-section">
            <h3>Order Information</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <strong>Order ID:</strong>
                <span>{order.id}</span>
              </div>
              <div className="detail-item">
                <strong>Date:</strong>
                <span>{formatDate(order.created_at || order.date)}</span>
              </div>
              <div className="detail-item">
                <strong>Status:</strong>
                <span
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(order.status) }}
                >
                  {order.status.toUpperCase()}
                </span>
              </div>
              {(order.received_date || order.receivedDate) && (
                <div className="detail-item">
                  <strong>Received Date:</strong>
                  <span>{formatDate(order.received_date || order.receivedDate)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="detail-section">
            <h3>Supplier Information</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <strong>Name:</strong>
                <span>{order.supplier_name || (order.supplier && order.supplier.name) || 'N/A'}</span>
              </div>
              {(order.supplier_contact || (order.supplier && order.supplier.contact)) && (
                <div className="detail-item">
                  <strong>Contact:</strong>
                  <span>{order.supplier_contact || (order.supplier && order.supplier.contact)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="detail-section">
            <h3>Items</h3>
            <table className="items-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>{formatPrice(item.price)}</td>
                    <td>{formatPrice(item.price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="order-total">
              <strong>Subtotal: {formatPrice(order.subtotal)}</strong>
            </div>
          </div>

          {(order.expected_date || order.expectedDate) && (
            <div className="detail-section">
              <h3>Expected Delivery</h3>
              <p>{formatDate(order.expected_date || order.expectedDate)}</p>
            </div>
          )}

          {order.notes && (
            <div className="detail-section">
              <h3>Notes</h3>
              <p>{order.notes}</p>
            </div>
          )}

          <div className="detail-section">
            <h3>Update Status</h3>
            <div className="status-update">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="status-select"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="partial">Partially Completed</option>
                <option value="received">Completed / Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {(newStatus === 'received' || newStatus === 'partial') && (
                <input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="received-date"
                  placeholder="Received Date"
                />
              )}
              <button className="btn-update" onClick={handleStatusChange}>
                Update Status
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderDetail;

