import React, { useEffect, useRef, useState } from 'react';
import {
  getRestaurantBilling,
  startRestaurantCheckout,
} from '../services/paymentsApi';
import { openRazorpaySubscriptionCheckout } from '../services/razorpayCheckout';
import {
  checkoutCtaLabel,
  isAwaitingWebhookConfirmation,
  isCheckoutNeeded,
  isPaidActiveSubscription,
  pollUntilSubscriptionSettled,
} from '../services/billingRefresh';

/**
 * Shows subscription / payment status + Pay Now for PAST_DUE / SUSPENDED / PENDING.
 * After Razorpay Checkout, status is taken from a backend refetch/poll — never from the checkout callback.
 */
export default function RestaurantBillingBanner() {
  const [billing, setBilling] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [error, setError] = useState('');
  const pollLockRef = useRef(false);
  const cancelledRef = useRef(false);

  const fetchBilling = async () => {
    const data = await getRestaurantBilling();
    return { billing: data, restaurant: data?.restaurant || null };
  };

  const load = async () => {
    try {
      const result = await fetchBilling();
      if (!cancelledRef.current) {
        setBilling(result.billing);
      }
      return result;
    } catch {
      if (!cancelledRef.current) {
        setBilling(null);
      }
      return null;
    }
  };

  const pollSubscriptionFromBackend = async () => {
    if (pollLockRef.current) return null;
    pollLockRef.current = true;
    setConfirmingPayment(true);
    try {
      return await pollUntilSubscriptionSettled(
        async () => {
          const result = await fetchBilling();
          if (!cancelledRef.current) {
            setBilling(result.billing);
          }
          return result;
        },
        { isCancelled: () => cancelledRef.current },
      );
    } finally {
      pollLockRef.current = false;
      if (!cancelledRef.current) {
        setConfirmingPayment(false);
      }
    }
  };

  useEffect(() => {
    cancelledRef.current = false;

    const maybePollPendingCheckout = async (result) => {
      if (!result) return;
      if (isAwaitingWebhookConfirmation(result.billing?.subscription)) {
        await pollSubscriptionFromBackend();
      }
    };

    load().then((result) => {
      if (!cancelledRef.current) {
        maybePollPendingCheckout(result);
      }
    });

    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || cancelledRef.current) return;
      load().then((result) => {
        if (!cancelledRef.current) {
          maybePollPendingCheckout(result);
        }
      });
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelledRef.current = true;
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!billing?.subscription) return null;

  const sub = billing.subscription;
  const restaurantStatus = String(billing.restaurant?.status || '').toUpperCase();
  const subStatus = String(sub.status || '').toUpperCase();
  const paymentStatus = String(sub.paymentStatus || '').toUpperCase();
  const paidActive = isPaidActiveSubscription(sub);
  const needsPay =
    !confirmingPayment &&
    !paidActive &&
    isCheckoutNeeded(billing, billing.restaurant);

  const onPay = async () => {
    setBusy(true);
    setError('');
    try {
      const checkout = await startRestaurantCheckout();
      const result = await openRazorpaySubscriptionCheckout(checkout);
      if (result.success) {
        const latest = await pollSubscriptionFromBackend();
        const latestSub = latest?.billing?.subscription;
        if (
          latestSub &&
          !isPaidActiveSubscription(latestSub) &&
          isAwaitingWebhookConfirmation(latestSub)
        ) {
          setError(
            'Razorpay accepted the payment. Status will update when the webhook confirms it.',
          );
        }
      } else {
        setError(result.error || 'Payment was not completed.');
        await load();
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
        {paidActive ? <span>Paid · Active subscription</span> : null}
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

      {confirmingPayment && !paidActive ? (
        <p className="rest-billing-alert">Confirming payment with Razorpay…</p>
      ) : null}

      {subStatus === 'PENDING' && sub.paymentRequired && !paidActive && !confirmingPayment ? (
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
          {busy ? 'Opening…' : checkoutCtaLabel(sub)}
        </button>
      ) : null}

      {error ? <p className="admin-field-error">{error}</p> : null}
    </section>
  );
}
