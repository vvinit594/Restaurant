import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Loader from '../../components/Loader';
import { useSalesAuth } from './SalesAuthContext';

export default function ProtectedSalesRoute({ children }) {
  const { isAuthenticated, isSalesPerson, bootstrapping } = useSalesAuth();
  const location = useLocation();

  if (bootstrapping) {
    return <Loader variant="fullscreen" label="Checking sales session…" />;
  }

  if (!isAuthenticated || !isSalesPerson) {
    return <Navigate to="/sales-login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
