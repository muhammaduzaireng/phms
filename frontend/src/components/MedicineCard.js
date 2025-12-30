import React from 'react';
import './MedicineCard.css';

const MedicineCard = ({ medicine }) => {
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(price);
  };

  const formatDate = (dateString) => {
    return dateString;
  };

  return (
    <div className="medicine-card">
      <div className="card-header">
        <h3 className="product-name">{medicine.product_name}</h3>
        <span className="price-badge">{formatPrice(medicine.price_rs)}</span>
      </div>
      
      <div className="card-body">
        <div className="info-row">
          <span className="label">Generic Name:</span>
          <span className="value">{medicine.generic_name}</span>
        </div>
        
        <div className="info-row">
          <span className="label">Manufacturer:</span>
          <span className="value">{medicine.manufacturer}</span>
        </div>
        
        <div className="info-row">
          <span className="label">Category:</span>
          <span className="value category-badge">{medicine.category}</span>
        </div>
        
        <div className="info-row">
          <span className="label">Pack Size:</span>
          <span className="value">{medicine.pack_size}</span>
        </div>
        
        <div className="info-row">
          <span className="label">Reg. Number:</span>
          <span className="value reg-number">{medicine.reg_number}</span>
        </div>
        
        <div className="info-row">
          <span className="label">DSL/DML:</span>
          <span className="value">{medicine.dsl_dml}</span>
        </div>
        
        <div className="info-row">
          <span className="label">Effective From:</span>
          <span className="value">{formatDate(medicine.effective_from)}</span>
        </div>
      </div>
    </div>
  );
};

export default MedicineCard;

