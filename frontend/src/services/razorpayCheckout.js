/**
 * Open Razorpay Subscription Checkout with a backend-issued payload.
 * Loads checkout.js dynamically; never uses the secret key.
 */
export function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Failed to load Razorpay Checkout.'));
    document.body.appendChild(script);
  });
}

/**
 * @param {object} checkout — from create restaurant / billing API
 * @returns {Promise<{ success: boolean, paymentId?: string, error?: string }>}
 */
export async function openRazorpaySubscriptionCheckout(checkout) {
  if (!checkout?.keyId || !checkout?.subscriptionId) {
    throw new Error('Missing Razorpay checkout details from server.');
  }

  const Razorpay = await loadRazorpayScript();

  return new Promise((resolve) => {
    const rzp = new Razorpay({
      key: checkout.keyId,
      subscription_id: checkout.subscriptionId,
      name: 'DilYum',
      description: checkout.description || checkout.planName || 'Subscription',
      prefill: {
        name: checkout.customer?.name || '',
        email: checkout.customer?.email || '',
        contact: checkout.customer?.contact || '',
      },
      notes: {
        restaurantId: checkout.restaurantId || '',
        dilYumSubscriptionId: checkout.dilYumSubscriptionId || '',
        planCode: checkout.planCode || '',
      },
      theme: { color: '#ea580c' },
      handler(response) {
        resolve({
          success: true,
          paymentId: response.razorpay_payment_id,
          subscriptionId: response.razorpay_subscription_id,
          signature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss() {
          resolve({ success: false, error: 'Checkout closed before payment completed.' });
        },
      },
    });
    rzp.on('payment.failed', (resp) => {
      resolve({
        success: false,
        error: resp?.error?.description || 'Payment failed.',
      });
    });
    rzp.open();
  });
}
