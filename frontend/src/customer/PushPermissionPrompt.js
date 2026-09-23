import React from 'react';
import { useCustomerDevice } from './CustomerDeviceContext';

export default function PushPermissionPrompt() {
  const {
    pushPromptOpen,
    pushDeniedHint,
    enablePush,
    skipPush,
    dismissDeniedHint,
    pushBusy,
  } = useCustomerDevice();

  if (pushDeniedHint) {
    return (
      <div className="push-prompt" role="status">
        <h2>Notifications are blocked</h2>
        <p className="customer-muted">
          This browser has blocked notifications for DilYum, so order updates and offers cannot be delivered.
          Allow notifications for this site in the browser’s site settings, then reload the page.
        </p>
        <div className="push-prompt-actions">
          <button type="button" className="customer-btn ghost" onClick={dismissDeniedHint}>
            OK
          </button>
        </div>
      </div>
    );
  }

  if (!pushPromptOpen) return null;

  return (
    <div className="push-prompt" role="dialog" aria-labelledby="push-prompt-title">
      <h2 id="push-prompt-title">Stay Updated with DilYum</h2>
      <p className="customer-muted">Get notifications about:</p>
      <ul className="push-prompt-list">
        <li>Order updates</li>
        <li>Live order status</li>
        <li>Restaurant offers</li>
        <li>Discount coupons</li>
        <li>Special promotions</li>
      </ul>
      <div className="push-prompt-actions">
        <button type="button" className="customer-btn" onClick={enablePush} disabled={pushBusy}>
          {pushBusy ? 'Enabling…' : 'Enable Notifications'}
        </button>
        <button type="button" className="customer-btn ghost" onClick={skipPush} disabled={pushBusy}>
          Maybe Later
        </button>
      </div>
    </div>
  );
}
