import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useRestaurantAuth } from './RestaurantAuthContext';

export default function ProtectedRestaurantRoute({ children, permission }) {
  const { isAuthenticated, permissions, bootstrapping } = useRestaurantAuth();
  const location = useLocation();

  if (bootstrapping) {
    return (
      <div className="admin-boot">
        <div className="admin-boot-card">Checking restaurant session…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/restaurant-login" replace state={{ from: location.pathname }} />;
  }

  if (permission && permissions && !permissions[permission]) {
    return <Navigate to="/restaurant/dashboard" replace />;
  }

  return children;
}
