/**
 * HTTP cache for anonymous public menu/QR responses (Vercel CDN via s-maxage).
 * max-age=0 keeps browsers revalidating; s-maxage=60 lets the edge serve for ~1m.
 * Menu edits become visible within ~60s (or sooner on cache miss). Never use on auth routes.
 */
export const PUBLIC_MENU_CACHE_CONTROL =
  'public, max-age=0, s-maxage=60, stale-while-revalidate=300';
