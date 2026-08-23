/**
 * Absolute URL encoded into QR images / Open Menu links.
 * Never use a localhost targetUrl when a production public origin is available.
 */
export function resolveQrScanUrl(qr, restaurantSlug) {
  if (!qr) return '';

  const slug = restaurantSlug || qr.slug || 'restaurant';
  const path =
    qr.path ||
    (qr.token ? `/r/${slug}/t/${qr.token}` : '');

  const apiUrl = String(qr.targetUrl || '').trim();
  const isAbsolute = /^https?:\/\//i.test(apiUrl);
  const isLocal = /localhost|127\.0\.0\.1/i.test(apiUrl);

  if (isAbsolute && !isLocal) return apiUrl.includes('#') ? apiUrl : `${apiUrl}#menu`;

  const base = String(
    process.env.REACT_APP_PUBLIC_URL ||
      (typeof window !== 'undefined' ? window.location.origin : ''),
  ).replace(/\/+$/, '');

  if (!base || !path) return apiUrl;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}#menu`;
}
