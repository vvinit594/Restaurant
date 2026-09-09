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
import AdminSalesPersonsPage from './admin/AdminSalesPersonsPage';
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
import BulkDishesAddPage from './restaurant/BulkDishesAddPage';
import RestaurantPlaceholder from './restaurant/RestaurantPlaceholder';
import RestaurantProfilePage from './restaurant/RestaurantProfilePage';
import RestaurantLoyaltyPage from './restaurant/RestaurantLoyaltyPage';
import RestaurantQrPage from './restaurant/RestaurantQrPage';
import RestaurantLiveOrdersPage from './restaurant/RestaurantLiveOrdersPage';
import RestaurantOrderHistoryPage from './restaurant/RestaurantOrderHistoryPage';
import PublicRestaurantPage from './pages/PublicRestaurantPage';
import RestaurantsListingPage from './pages/RestaurantsListingPage';
import { SalesAuthProvider } from './sales/auth/SalesAuthContext';
import ProtectedSalesRoute from './sales/auth/ProtectedSalesRoute';
import SalesLogin from './sales/SalesLogin';
import SalesLayout from './sales/SalesLayout';
import SalesDashboardPage from './sales/SalesDashboardPage';
import SalesAddRestaurantPage from './sales/SalesAddRestaurantPage';
import SalesMyRestaurantsPage from './sales/SalesMyRestaurantsPage';
import SalesLeadsPage from './sales/SalesLeadsPage';
import SalesQrManagementPage from './sales/SalesQrManagementPage';
import SalesAnalyticsPage from './sales/SalesAnalyticsPage';
import SalesCommissionPage from './sales/SalesCommissionPage';
import SalesProfilePage from './sales/SalesProfilePage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <RestaurantAuthProvider>
          <SalesAuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/" element={<CustomerApp />} />
              <Route path="/restaurants" element={<RestaurantsListingPage />} />

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
                <Route path="sales-persons" element={<AdminSalesPersonsPage />} />
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
                      description="Active plans: 10 Days Free Trial, Monthly (₹1,499/mo), and Launch (₹2,999 / 3 months)."
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
                  path="loyalty"
                  element={
                    <ProtectedRestaurantRoute permission="viewLoyalty">
                      <RestaurantLoyaltyPage />
                    </ProtectedRestaurantRoute>
                  }
                />
                <Route
                  path="orders"
                  element={
                    <ProtectedRestaurantRoute permission="viewOrders">
                      <RestaurantLiveOrdersPage />
                    </ProtectedRestaurantRoute>
                  }
                />
                <Route
                  path="orders/history"
                  element={
                    <ProtectedRestaurantRoute permission="viewOrders">
                      <RestaurantOrderHistoryPage />
                    </ProtectedRestaurantRoute>
                  }
                />
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
                  path="menu/bulk"
                  element={
                    <ProtectedRestaurantRoute permission="addDish">
                      <BulkDishesAddPage />
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

              <Route path="/sales-login" element={<SalesLogin />} />
              <Route
                path="/sales"
                element={
                  <ProtectedSalesRoute>
                    <SalesLayout />
                  </ProtectedSalesRoute>
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<SalesDashboardPage />} />
                <Route path="restaurants/add" element={<SalesAddRestaurantPage />} />
                <Route path="restaurants" element={<SalesMyRestaurantsPage />} />
                <Route path="leads" element={<SalesLeadsPage />} />
                <Route path="qr-management" element={<SalesQrManagementPage />} />
                <Route path="analytics" element={<SalesAnalyticsPage />} />
                <Route path="commission" element={<SalesCommissionPage />} />
                <Route path="profile" element={<SalesProfilePage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
          </SalesAuthProvider>
        </RestaurantAuthProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}
