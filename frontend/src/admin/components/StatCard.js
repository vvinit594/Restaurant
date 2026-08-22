import React from 'react';

export default function StatCard({ label, value, hint, loading }) {
  return (
    <div className="admin-stat-card">
      <p className="admin-stat-label">{label}</p>
      {loading ? <div className="admin-skeleton admin-skeleton-lg" /> : <p className="admin-stat-value">{value}</p>}
      {hint ? <p className="admin-stat-hint">{hint}</p> : null}
    </div>
  );
}
