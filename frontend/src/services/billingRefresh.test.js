/**
 * @jest-environment node
 */
import {
  checkoutCtaLabel,
  isSubscriptionSettled,
  isUnpaidCheckoutPending,
  pollUntilSubscriptionSettled,
} from './billingRefresh';

const pendingWithSubscription = {
  status: 'PENDING',
  paymentStatus: 'PENDING',
  razorpaySubscriptionId: 'sub_existing',
};

describe('checkout dismissal state', () => {
  it('keeps a closed checkout as unpaid pending and offers Retry Payment', () => {
    expect(isUnpaidCheckoutPending(pendingWithSubscription)).toBe(true);
    expect(isSubscriptionSettled(pendingWithSubscription)).toBe(false);
    expect(checkoutCtaLabel(pendingWithSubscription)).toBe('Retry Payment');
  });

  it('uses Start Razorpay Checkout only before a subscription id exists', () => {
    expect(
      checkoutCtaLabel({ status: 'PENDING', paymentStatus: 'PENDING' }),
    ).toBe('Start Razorpay Checkout');
  });

  it('stops polling a cancelled checkout instead of waiting forever', async () => {
    let calls = 0;
    const result = await pollUntilSubscriptionSettled(
      async () => {
        calls += 1;
        return { billing: { subscription: pendingWithSubscription } };
      },
      { maxAttempts: 3, delayMs: 0 },
    );
    expect(calls).toBe(3);
    expect(result.billing.subscription.status).toBe('PENDING');
  });

  it('stops polling when the webhook marks the subscription paid', async () => {
    let calls = 0;
    const result = await pollUntilSubscriptionSettled(
      async () => {
        calls += 1;
        return {
          billing: {
            subscription: {
              status: calls < 2 ? 'PENDING' : 'ACTIVE',
              paymentStatus: calls < 2 ? 'PENDING' : 'PAID',
              razorpaySubscriptionId: 'sub_existing',
            },
          },
        };
      },
      { maxAttempts: 8, delayMs: 0 },
    );
    expect(calls).toBe(2);
    expect(result.billing.subscription.status).toBe('ACTIVE');
    expect(result.billing.subscription.paymentStatus).toBe('PAID');
  });
});
