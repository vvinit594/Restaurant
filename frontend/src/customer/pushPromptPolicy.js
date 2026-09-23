const STAFF_RESTAURANT_SECTIONS = new Set([
  'dashboard',
  'loyalty',
  'orders',
  'menu',
  'profile',
  'settings',
  'categories',
  'ingredients',
  'tables',
  'qr',
  'analytics',
]);

/** Customer site, public menus, and the customer account. Staff panels are excluded. */
export function isCustomerFacingPath(pathname) {
  const path = pathname || '/';
  if (
    path === '/'
    || path.startsWith('/restaurants')
    || path.startsWith('/r/')
    || path === '/account'
    || path.startsWith('/account/')
  ) {
    return true;
  }
  if (path.startsWith('/restaurant/')) {
    const section = path.split('/')[2] || '';
    return section.length > 0 && !STAFF_RESTAURANT_SECTIONS.has(section);
  }
  return false;
}

export function isPushApiSupported() {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator
    && 'PushManager' in window
    && typeof Notification !== 'undefined'
  );
}
