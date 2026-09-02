/**
 * Per-restaurant cart persistence (localStorage).
 * Carts never mix dishes across restaurants.
 */
const PREFIX = 'dilyum_cart_v1:';

function key(slug) {
  return PREFIX + String(slug || '').trim().toLowerCase();
}

export function loadCart(slug) {
  try {
    const raw = localStorage.getItem(key(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((i) => i && i.dishId && Number(i.quantity) > 0)
      .map((i) => ({
        dishId: String(i.dishId),
        name: String(i.name || ''),
        price: Number(i.price) || 0,
        imageUrl: String(i.imageUrl || ''),
        quantity: Math.min(20, Math.max(1, Number(i.quantity) || 1)),
      }));
  } catch {
    return [];
  }
}

export function saveCart(slug, items) {
  const clean = (items || []).filter((i) => i && Number(i.quantity) > 0);
  if (!clean.length) {
    localStorage.removeItem(key(slug));
    return;
  }
  localStorage.setItem(key(slug), JSON.stringify(clean));
}

export function clearCart(slug) {
  localStorage.removeItem(key(slug));
}

export function cartQtyTotal(items) {
  return (items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
}

export function cartSubtotal(items) {
  return (items || []).reduce(
    (sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0),
    0,
  );
}
