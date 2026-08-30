import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Loader from '../../components/Loader';
import { useAdminAuth } from './AdminAuthContext';

export default function ProtectedAdminRoute({ children }) {
  const { isAuthenticated, isSuperAdmin, bootstrapping } = useAdminAuth();
  const location = useLocation();

  if (bootstrapping) {
    return <Loader variant="fullscreen" label="Checking admin session…" />;
  }

  if (!isAuthenticated || !isSuperAdmin) {
    return <Navigate to="/admin-login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
