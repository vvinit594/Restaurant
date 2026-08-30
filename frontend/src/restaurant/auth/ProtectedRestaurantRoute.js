import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Loader from '../../components/Loader';
import { useRestaurantAuth } from './RestaurantAuthContext';

export default function ProtectedRestaurantRoute({ children, permission }) {
  const { isAuthenticated, permissions, bootstrapping } = useRestaurantAuth();
  const location = useLocation();

  if (bootstrapping) {
    return <Loader variant="fullscreen" label="Checking restaurant session…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/restaurant-login" replace state={{ from: location.pathname }} />;
  }

  if (permission && permissions && !permissions[permission]) {
    return <Navigate to="/restaurant/dashboard" replace />;
  }

  return children;
}
