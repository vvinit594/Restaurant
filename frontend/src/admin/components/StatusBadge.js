import React from 'react';

export default function StatusBadge({ status }) {
  const label = status === 'active' ? 'Active' : status === 'suspended' ? 'Suspended' : status;
  return <span className={`admin-badge admin-badge-${status || 'unknown'}`}>{label}</span>;
}
