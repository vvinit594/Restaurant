import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Loader from './components/Loader';
import CustomerApp from './App';
import { AdminAuthProvider } from './admin/auth/AdminAuthContext';
import ProtectedAdminRoute from './admin/auth/ProtectedAdminRoute';
import { ToastProvider } from './admin/components/Toast';
import { CustomerDeviceProvider } from './customer/CustomerDeviceContext';
import PushPermissionPrompt from './customer/PushPermissionPrompt';
import './customer/customer.css';
import { RestaurantAuthProvider } from './restaurant/auth/RestaurantAuthContext';
import ProtectedRestaurantRoute from './restaurant/auth/ProtectedRestaurantRoute';
import { SalesAuthProvider } from './sales/auth/SalesAuthContext';
import ProtectedSalesRoute from './sales/auth/ProtectedSalesRoute';

const AdminLogin = lazy(() => import(/* webpackChunkName: "admin-login" */ './admin/AdminLogin'));
const AdminLayout = lazy(() => import(/* webpackChunkName: "admin-layout" */ './admin/AdminLayout'));
const AdminDashboard = lazy(() => import(/* webpackChunkName: "admin-dashboard" */ './admin/AdminDashboard'));
const AdminPlaceholder = lazy(() => import(/* webpackChunkName: "admin-placeholder" */ './admin/AdminPlaceholder'));
const AdminQrPage = lazy(() => import(/* webpackChunkName: "admin-qr" */ './admin/AdminQrPage'));
const AddRestaurantPage = lazy(() => import(/* webpackChunkName: "admin-add-restaurant" */ './admin/AddRestaurantPage'));
const RestaurantsPage = lazy(() => import(/* webpackChunkName: "admin-restaurants" */ './admin/RestaurantsPage'));
const RestaurantDetailPage = lazy(() => import(/* webpackChunkName: "admin-restaurant-detail" */ './admin/RestaurantDetailPage'));
const AdminSalesPersonsPage = lazy(() => import(/* webpackChunkName: "admin-sales-persons" */ './admin/AdminSalesPersonsPage'));

const CustomerPanelLayout = lazy(() => import(/* webpackChunkName: "customer-panel" */ './customer/CustomerPanelLayout'));
const CustomerOverviewPage = lazy(() => import(/* webpackChunkName: "customer-overview" */ './customer/CustomerOverviewPage'));
const CustomerOrdersPage = lazy(() => import(/* webpackChunkName: "customer-orders" */ './customer/CustomerOrdersPage'));
const CustomerOrderDetailPage = lazy(() => import(/* webpackChunkName: "customer-order-detail" */ './customer/CustomerOrderDetailPage'));
const CustomerTransactionsPage = lazy(() => import(/* webpackChunkName: "customer-transactions" */ './customer/CustomerTransactionsPage'));
const CustomerCouponsPage = lazy(() => import(/* webpackChunkName: "customer-coupons" */ './customer/CustomerCouponsPage'));
const CustomerNotificationsPage = lazy(() => import(/* webpackChunkName: "customer-notifications" */ './customer/CustomerNotificationsPage'));

const RestaurantLogin = lazy(() => import(/* webpackChunkName: "restaurant-login" */ './restaurant/RestaurantLogin'));
const RestaurantLayout = lazy(() => import(/* webpackChunkName: "restaurant-layout" */ './restaurant/RestaurantLayout'));
const RestaurantDashboard = lazy(() => import(/* webpackChunkName: "restaurant-dashboard" */ './restaurant/RestaurantDashboard'));
const RestaurantMenuPage = lazy(() => import(/* webpackChunkName: "restaurant-menu" */ './restaurant/RestaurantMenuPage'));
const DishFormPage = lazy(() => import(/* webpackChunkName: "restaurant-dish-form" */ './restaurant/DishFormPage'));
const BulkDishesAddPage = lazy(() => import(/* webpackChunkName: "restaurant-bulk-dishes" */ './restaurant/BulkDishesAddPage'));
const RestaurantPlaceholder = lazy(() => import(/* webpackChunkName: "restaurant-placeholder" */ './restaurant/RestaurantPlaceholder'));
const RestaurantProfilePage = lazy(() => import(/* webpackChunkName: "restaurant-profile" */ './restaurant/RestaurantProfilePage'));
const RestaurantLoyaltyPage = lazy(() => import(/* webpackChunkName: "restaurant-loyalty" */ './restaurant/RestaurantLoyaltyPage'));
const RestaurantQrPage = lazy(() => import(/* webpackChunkName: "restaurant-qr" */ './restaurant/RestaurantQrPage'));
const RestaurantLiveOrdersPage = lazy(() => import(/* webpackChunkName: "restaurant-live-orders" */ './restaurant/RestaurantLiveOrdersPage'));
const RestaurantOrderHistoryPage = lazy(() => import(/* webpackChunkName: "restaurant-order-history" */ './restaurant/RestaurantOrderHistoryPage'));

const PublicRestaurantPage = lazy(() => import(/* webpackChunkName: "public-restaurant" */ './pages/PublicRestaurantPage'));
const RestaurantsListingPage = lazy(() => import(/* webpackChunkName: "restaurants-listing" */ './pages/RestaurantsListingPage'));

const SalesLogin = lazy(() => import(/* webpackChunkName: "sales-login" */ './sales/SalesLogin'));
const SalesLayout = lazy(() => import(/* webpackChunkName: "sales-layout" */ './sales/SalesLayout'));
const SalesDashboardPage = lazy(() => import(/* webpackChunkName: "sales-dashboard" */ './sales/SalesDashboardPage'));
const SalesAddRestaurantPage = lazy(() => import(/* webpackChunkName: "sales-add-restaurant" */ './sales/SalesAddRestaurantPage'));
const SalesMyRestaurantsPage = lazy(() => import(/* webpackChunkName: "sales-restaurants" */ './sales/SalesMyRestaurantsPage'));
const SalesLeadsPage = lazy(() => import(/* webpackChunkName: "sales-leads" */ './sales/SalesLeadsPage'));
const SalesQrManagementPage = lazy(() => import(/* webpackChunkName: "sales-qr" */ './sales/SalesQrManagementPage'));
const SalesAnalyticsPage = lazy(() => import(/* webpackChunkName: "sales-analytics" */ './sales/SalesAnalyticsPage'));
const SalesCommissionPage = lazy(() => import(/* webpackChunkName: "sales-commission" */ './sales/SalesCommissionPage'));
const SalesProfilePage = lazy(() => import(/* webpackChunkName: "sales-profile" */ './sales/SalesProfilePage'));

function RouteFallback() {
  return <Loader label="Loading…" />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <RestaurantAuthProvider>
          <SalesAuthProvider>
          <ToastProvider>
            <CustomerDeviceProvider>
            <PushPermissionPrompt />
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<CustomerApp />} />
              <Route path="/restaurants" element={<RestaurantsListingPage />} />
              <Route path="/account" element={<CustomerPanelLayout />}>
                <Route index element={<CustomerOverviewPage />} />
                <Route path="orders/live" element={<CustomerOrdersPage live />} />
                <Route path="orders/:orderId" element={<CustomerOrderDetailPage />} />
                <Route path="orders" element={<CustomerOrdersPage />} />
                <Route path="transactions" element={<CustomerTransactionsPage />} />
                <Route path="coupons" element={<CustomerCouponsPage />} />
                <Route path="notifications" element={<CustomerNotificationsPage />} />
              </Route>

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
            </Suspense>
            </CustomerDeviceProvider>
          </ToastProvider>
          </SalesAuthProvider>
        </RestaurantAuthProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}
