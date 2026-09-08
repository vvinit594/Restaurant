import React, { useEffect, useState } from 'react';
import {
  getRestaurantBilling,
  startRestaurantCheckout,
} from '../services/paymentsApi';
import { openRazorpaySubscriptionCheckout } from '../services/razorpayCheckout';

/**
 * Shows subscription / payment status + Pay Now for PAST_DUE / SUSPENDED / PENDING.
 */
export default function RestaurantBillingBanner() {
  const [billing, setBilling] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    getRestaurantBilling()
      .then(setBilling)
      .catch(() => setBilling(null));
  };

  useEffect(() => {
    load();
  }, []);

  if (!billing?.subscription) return null;

  const sub = billing.subscription;
  const restaurantStatus = String(billing.restaurant?.status || '').toUpperCase();
  const subStatus = String(sub.status || '').toUpperCase();
  const paymentStatus = String(sub.paymentStatus || '').toUpperCase();

  const needsPay =
    billing.checkoutAvailable ||
    subStatus === 'PENDING' ||
    subStatus === 'PAST_DUE' ||
    subStatus === 'SUSPENDED' ||
    paymentStatus === 'FAILED' ||
    restaurantStatus === 'SUSPENDED';

  const onPay = async () => {
    setBusy(true);
    setError('');
    try {
      const checkout = await startRestaurantCheckout();
      const result = await openRazorpaySubscriptionCheckout(checkout);
      if (result.success) {
        setError('');
        load();
      } else {
        setError(result.error || 'Payment was not completed.');
      }
    } catch (err) {
      setError(err.message || 'Could not start payment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rest-billing-banner">
      <div className="rest-billing-main">
        <strong>{sub.planName}</strong>
        <span>{sub.priceLabel}</span>
        <span>Status: {subStatus}</span>
        <span>Payment: {paymentStatus}</span>
        {sub.nextPaymentAt ? (
          <span>Next payment: {new Date(sub.nextPaymentAt).toLocaleString()}</span>
        ) : null}
        {sub.lastPaymentAt ? (
          <span>Last payment: {new Date(sub.lastPaymentAt).toLocaleString()}</span>
        ) : null}
        {sub.gracePeriodEndsAt && subStatus === 'PAST_DUE' ? (
          <span className="rest-billing-warn">
            Payment deadline: {new Date(sub.gracePeriodEndsAt).toLocaleString()}
            {sub.graceRemainingHours != null
              ? ` (${sub.graceRemainingHours}h remaining)`
              : ''}
          </span>
        ) : null}
      </div>

      {restaurantStatus === 'SUSPENDED' || subStatus === 'SUSPENDED' ? (
        <p className="rest-billing-alert">
          Your subscription payment is overdue. Your restaurant has been suspended
          because the payment was not received within the 24-hour grace period.
        </p>
      ) : null}

      {subStatus === 'PAST_DUE' ? (
        <p className="rest-billing-alert">
          Payment failed. Please complete payment within 24 hours to avoid suspension.
        </p>
      ) : null}

      {subStatus === 'PENDING' && sub.paymentRequired ? (
        <p className="rest-billing-alert">
          Paid subscription is pending authorization. Complete Razorpay Checkout to activate.
        </p>
      ) : null}

      {needsPay ? (
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={onPay}
          disabled={busy}
        >
          {busy ? 'Opening…' : 'Pay Now / Renew Subscription'}
        </button>
      ) : null}

      {error ? <p className="admin-field-error">{error}</p> : null}
    </section>
  );
}
