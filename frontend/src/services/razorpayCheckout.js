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
function sanitizePaymentText(value) {
  return String(value || '')
    .replace(/rzp_(?:live|test)_[A-Za-z0-9]+/g, '')
    .replace(/\bplan_[A-Za-z0-9]{14}\b/g, '')
    .replace(/\b(?:key_secret|webhook_secret)\b\s*[:=]?\s*\S+/gi, '')
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function setupFailureMessage(detail) {
  const clean = sanitizePaymentText(detail);
  if (!clean) return 'Razorpay payment setup failed. Please retry Razorpay Checkout.';
  if (/^Razorpay payment setup failed\./i.test(clean)) return clean;
  const sentence = /[.!?]$/.test(clean) ? clean : `${clean}.`;
  return `Razorpay payment setup failed. ${sentence} Please retry Razorpay Checkout.`;
}

export function paymentSetupErrorMessage(err) {
  const code = err?.data?.code;
  const paymentFailure =
    code === 'RAZORPAY_PLAN_UNAVAILABLE' ||
    code === 'RAZORPAY_CHECKOUT_INITIALIZATION_FAILED' ||
    Boolean(err?.data?.paymentRequired);
  if (paymentFailure) {
    return setupFailureMessage(err?.data?.reason || err?.data?.message || err?.message);
  }
  const raw = sanitizePaymentText(err?.message);
  if (!raw || /something went wrong on the server/i.test(raw) || /internal server error/i.test(raw)) {
    return 'Razorpay payment setup failed. Please retry Razorpay Checkout.';
  }
  return raw;
}

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
