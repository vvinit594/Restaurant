import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import CustomerApp from './App';
import './admin/admin.css';
import AdminLogin from './admin/AdminLogin';
import AdminLayout from './admin/AdminLayout';
import AdminDashboard from './admin/AdminDashboard';
import AdminPlaceholder from './admin/AdminPlaceholder';
import AdminQrPage from './admin/AdminQrPage';
import AddRestaurantPage from './admin/AddRestaurantPage';
import RestaurantsPage from './admin/RestaurantsPage';
import RestaurantDetailPage from './admin/RestaurantDetailPage';
import { AdminAuthProvider } from './admin/auth/AdminAuthContext';
import ProtectedAdminRoute from './admin/auth/ProtectedAdminRoute';
import { ToastProvider } from './admin/components/Toast';
import { RestaurantAuthProvider } from './restaurant/auth/RestaurantAuthContext';
import ProtectedRestaurantRoute from './restaurant/auth/ProtectedRestaurantRoute';
import RestaurantLogin from './restaurant/RestaurantLogin';
import RestaurantLayout from './restaurant/RestaurantLayout';
import RestaurantDashboard from './restaurant/RestaurantDashboard';
import RestaurantMenuPage from './restaurant/RestaurantMenuPage';
import DishFormPage from './restaurant/DishFormPage';
import RestaurantPlaceholder from './restaurant/RestaurantPlaceholder';
import RestaurantProfilePage from './restaurant/RestaurantProfilePage';
import RestaurantQrPage from './restaurant/RestaurantQrPage';
import PublicRestaurantPage from './pages/PublicRestaurantPage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <RestaurantAuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/" element={<CustomerApp />} />

              <Route path="/admin-login" element={<AdminLogin />} />
              <Route
                path="/admin"
                element={
                  <ProtectedAdminRoute>
                    <AdminLayout />
                  </ProtectedAdminRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="restaurants" element={<RestaurantsPage />} />
                <Route path="restaurants/new" element={<AddRestaurantPage />} />
                <Route path="restaurants/:restaurantId" element={<RestaurantDetailPage />} />
                <Route path="qr" element={<AdminQrPage />} />
                <Route
                  path="analytics"
                  element={
                    <AdminPlaceholder
                      title="Analytics"
                      description="Platform-wide restaurant performance and QR scan insights."
                    />
                  }
                />
                <Route
                  path="subscriptions"
                  element={
                    <AdminPlaceholder
                      title="Subscriptions"
                      description="Manage Free, Starter, Professional, and Enterprise plans."
                    />
                  }
                />
                <Route
                  path="settings"
                  element={
                    <AdminPlaceholder
                      title="Settings"
                      description="Platform settings, audit preferences, and Super Admin account options."
                    />
                  }
                />
              </Route>

              <Route path="/restaurant-login" element={<RestaurantLogin />} />
              <Route
                path="/restaurant"
                element={
                  <ProtectedRestaurantRoute>
                    <RestaurantLayout />
                  </ProtectedRestaurantRoute>
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<RestaurantDashboard />} />
                <Route
                  path="menu"
                  element={
                    <ProtectedRestaurantRoute permission="viewMenu">
                      <RestaurantMenuPage />
                    </ProtectedRestaurantRoute>
                  }
                />
                <Route
                  path="menu/add"
                  element={
                    <ProtectedRestaurantRoute permission="addDish">
                      <DishFormPage mode="create" />
                    </ProtectedRestaurantRoute>
                  }
                />
                <Route
                  path="menu/:dishId/edit"
                  element={
                    <ProtectedRestaurantRoute permission="editDish">
                      <DishFormPage mode="edit" />
                    </ProtectedRestaurantRoute>
                  }
                />
                <Route
                  path="profile"
                  element={
                    <ProtectedRestaurantRoute permission="manageProfile">
                      <RestaurantProfilePage />
                    </ProtectedRestaurantRoute>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <RestaurantPlaceholder
                      title="Settings"
                      description="Owner-only restaurant settings and staff management."
                    />
                  }
                />
                <Route
                  path="categories"
                  element={
                    <RestaurantPlaceholder
                      title="Categories"
                      description="Organize menu categories for your restaurant."
                    />
                  }
                />
                <Route
                  path="ingredients"
                  element={
                    <RestaurantPlaceholder
                      title="Ingredients"
                      description="Manage reusable ingredients and allergen tags."
                    />
                  }
                />
                <Route
                  path="tables"
                  element={
                    <RestaurantPlaceholder
                      title="Tables"
                      description="Create tables that map to unique QR tokens."
                    />
                  }
                />
                <Route
                  path="qr"
                  element={
                    <ProtectedRestaurantRoute permission="manageQr">
                      <RestaurantQrPage />
                    </ProtectedRestaurantRoute>
                  }
                />
                <Route
                  path="analytics"
                  element={
                    <RestaurantPlaceholder
                      title="Analytics"
                      description="View dish performance and QR scan activity for your restaurant."
                    />
                  }
                />
              </Route>

              <Route path="/r/:restaurantSlug/t/:token" element={<PublicRestaurantPage />} />
              <Route path="/r/:restaurantSlug" element={<PublicRestaurantPage />} />
              <Route path="/restaurant/:restaurantSlug" element={<PublicRestaurantPage />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </RestaurantAuthProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}
