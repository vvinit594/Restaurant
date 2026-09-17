/**
 * Backend-backed subscription/payment helpers for Restaurant Profile billing UI.
 * Checkout success is never treated as paid — only API/database state is.
 */

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function normalizeBillingStatus(value) {
  return String(value || '').toUpperCase();
}

export function pickSubscription(billing, restaurant) {
  return billing?.subscription || restaurant?.subscription || null;
}

export function isPaidActiveSubscription(sub) {
  const status = normalizeBillingStatus(sub?.status);
  const paymentStatus = normalizeBillingStatus(sub?.paymentStatus);
  return (status === 'ACTIVE' && paymentStatus === 'PAID') || status === 'TRIAL';
}

export function isAwaitingWebhookConfirmation(sub) {
  const status = normalizeBillingStatus(sub?.status);
  const paymentStatus = normalizeBillingStatus(sub?.paymentStatus);
  return (
    status === 'PENDING' &&
    (paymentStatus === 'PENDING' || !paymentStatus) &&
    Boolean(sub?.razorpaySubscriptionId)
  );
}

export function isCheckoutNeeded(billing, restaurant) {
  const sub = pickSubscription(billing, restaurant);
  if (isPaidActiveSubscription(sub)) return false;

  if (billing && billing.checkoutAvailable === false) {
    return false;
  }

  if (billing?.checkoutAvailable) return true;

  const status = normalizeBillingStatus(sub?.status);
  const paymentStatus = normalizeBillingStatus(sub?.paymentStatus);
  return (
    status === 'PENDING' ||
    status === 'PAST_DUE' ||
    status === 'SUSPENDED' ||
    paymentStatus === 'FAILED'
  );
}

export function checkoutCtaLabel(sub) {
  const status = normalizeBillingStatus(sub?.status);
  if (status === 'PENDING' && !sub?.razorpaySubscriptionId) {
    return 'Start Razorpay Checkout';
  }
  return 'Retry / Start Razorpay Checkout';
}

export function isSubscriptionSettled(sub) {
  if (!sub) return false;
  const status = normalizeBillingStatus(sub.status);
  const paymentStatus = normalizeBillingStatus(sub.paymentStatus);
  if (status === 'ACTIVE' && paymentStatus === 'PAID') return true;
  if (status === 'TRIAL') return true;
  if (status === 'PAST_DUE' || status === 'SUSPENDED' || status === 'CANCELLED') {
    return true;
  }
  if (paymentStatus === 'FAILED' || paymentStatus === 'PAID') return true;
  return false;
}

/**
 * Limited refetch loop so Razorpay webhook / backend sync can land after Checkout.
 * Stops on ACTIVE/PAID (or other settled statuses). Never starts checkout.
 * Transient API errors do not abort the loop.
 */
export async function pollUntilSubscriptionSettled(fetchFn, options = {}) {
  const maxAttempts = options.maxAttempts ?? 8;
  const delayMs = options.delayMs ?? 2000;
  const isCancelled = options.isCancelled || (() => false);

  let last = { billing: null, restaurant: null };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await delay(delayMs);
    }
    if (isCancelled()) return last;
    try {
      last = (await fetchFn()) || last;
    } catch {
      // Keep polling on HTTP 500 / network errors; backend remains source of truth.
    }
    if (isCancelled() || isSubscriptionSettled(pickSubscription(last?.billing, last?.restaurant))) {
      return last;
    }
  }

  return last;
}
