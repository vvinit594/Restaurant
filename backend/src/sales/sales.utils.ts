/**
 * Prefer trusted numeric priceAmount; fall back to parsing display labels.
 * Returns 0 for Custom / unparseable labels (no invented revenue).
 */
export function parseMonthlyPriceLabel(
  priceLabel: string | null | undefined,
  priceAmount?: number | string | { toString(): string } | null,
): number {
  if (priceAmount != null && priceAmount !== '') {
    const n = Number(priceAmount);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  const raw = String(priceLabel || '');
  if (!raw || /custom/i.test(raw)) return 0;
  const digits = raw.replace(/[^0-9.]/g, '');
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

export function startOfWeek(d = new Date()): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + diff);
  return date;
}

export function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function startOfYear(d = new Date()): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}
