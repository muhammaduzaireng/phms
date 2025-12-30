import React from 'react';
import './MedicineList.css';
import MedicineCard from './MedicineCard';

const MedicineList = ({ medicines, loading }) => {
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading medicines...</p>
      </div>
    );
  }

  if (medicines.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-icon">🔍</p>
        <h3>No medicines found</h3>
        <p>Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="medicine-list">
      {medicines.map((medicine, index) => (
        <MedicineCard key={`${medicine.reg_number}-${index}`} medicine={medicine} />
      ))}
    </div>
  );
};

export default MedicineList;

