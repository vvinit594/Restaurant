import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getPushConfig,
  getUnreadNotificationCount,
  registerCustomerDevice,
  savePushSubscription,
} from '../services/customerApi';
import {
  dismissPushPrompt,
  getStoredDeviceCredentials,
  mintDeviceCredentials,
  storeDeviceCredentials,
  wasPushPromptDismissed,
} from '../services/customerDevice';

const CustomerDeviceContext = createContext(null);

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function CustomerDeviceProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushPromptOpen, setPushPromptOpen] = useState(false);

  const refreshUnread = useCallback(async () => {
    try {
      const data = await getUnreadNotificationCount();
      setUnreadCount(Number(data.unreadCount || 0));
    } catch {
      /* device may not be registered yet */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const existing = getStoredDeviceCredentials();
        const payload = existing || mintDeviceCredentials();
        const registered = await registerCustomerDevice(payload);
        storeDeviceCredentials(registered.publicId, registered.secret);
        if (alive) await refreshUnread();
      } catch {
        /* ordering still works without registration */
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshUnread]);

  const maybeAskPush = useCallback(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    if (wasPushPromptDismissed()) return;
    setPushPromptOpen(true);
  }, []);

  const enablePush = useCallback(async () => {
    setPushPromptOpen(false);
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
      return false;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      dismissPushPrompt();
      return false;
    }
    const config = await getPushConfig();
    if (!config?.enabled || !config.vapidPublicKey) return false;
    const registration = await navigator.serviceWorker.register('/push-sw.js');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
    });
    const json = subscription.toJSON();
    await savePushSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    });
    return true;
  }, []);

  const skipPush = useCallback(() => {
    dismissPushPrompt();
    setPushPromptOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      unreadCount,
      setUnreadCount,
      refreshUnread,
      maybeAskPush,
      enablePush,
      skipPush,
      pushPromptOpen,
    }),
    [ready, unreadCount, refreshUnread, maybeAskPush, enablePush, skipPush, pushPromptOpen],
  );

  return (
    <CustomerDeviceContext.Provider value={value}>
      {children}
    </CustomerDeviceContext.Provider>
  );
}

export function useCustomerDevice() {
  return useContext(CustomerDeviceContext) || {
    ready: false,
    unreadCount: 0,
    setUnreadCount: () => {},
    refreshUnread: async () => {},
    maybeAskPush: () => {},
    enablePush: async () => false,
    skipPush: () => {},
    pushPromptOpen: false,
  };
}
