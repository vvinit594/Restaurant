/** Display-only. Amounts come from the API; this does not calculate commission. */
export function formatInr(n) {
  const v = Number(n);
  const amount = Number.isFinite(v) ? v : 0;
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
