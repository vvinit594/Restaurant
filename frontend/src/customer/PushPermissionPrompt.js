import React from 'react';
import { useCustomerDevice } from './CustomerDeviceContext';

export default function PushPermissionPrompt() {
  const { pushPromptOpen, enablePush, skipPush } = useCustomerDevice();
  if (!pushPromptOpen) return null;

  return (
    <div className="push-prompt" role="dialog" aria-label="Enable notifications">
      <h2>Stay updated with your orders and exclusive offers.</h2>
      <p className="customer-muted">
        DilYum can send device notifications when your order status changes or a restaurant sends a coupon.
      </p>
      <div className="push-prompt-actions">
        <button type="button" className="customer-btn" onClick={enablePush}>
          Enable Notifications
        </button>
        <button type="button" className="customer-btn ghost" onClick={skipPush}>
          Not Now
        </button>
      </div>
    </div>
  );
}
