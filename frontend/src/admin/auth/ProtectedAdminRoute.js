import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from './AdminAuthContext';

export default function ProtectedAdminRoute({ children }) {
  const { isAuthenticated, isSuperAdmin, bootstrapping } = useAdminAuth();
  const location = useLocation();

  if (bootstrapping) {
    return (
      <div className="admin-boot">
        <div className="admin-boot-card">Checking admin session…</div>
      </div>
    );
  }

  if (!isAuthenticated || !isSuperAdmin) {
    return <Navigate to="/admin-login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
