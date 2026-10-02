import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getPushConfig,
  getUnreadNotificationCount,
  registerCustomerDevice,
  savePushSubscription,
} from '../services/customerApi';
import {
  dismissDeniedHint as rememberDeniedHint,
  dismissPushPrompt,
  getStoredDeviceCredentials,
  mintDeviceCredentials,
  storeDeviceCredentials,
  wasDeniedHintDismissed,
  wasPushPromptDismissed,
} from '../services/customerDevice';
import { isCustomerFacingPath, isPushApiSupported } from './pushPromptPolicy';

const CustomerDeviceContext = createContext(null);
const PROMPT_DELAY_MS = 1500;

let deviceRegistration;
let pushConfigRequest;

function loadPushConfig() {
  if (!pushConfigRequest) {
    pushConfigRequest = getPushConfig().catch((err) => {
      pushConfigRequest = null;
      throw err;
    });
  }
  return pushConfigRequest;
}

function ensureDeviceRegistered() {
  if (!deviceRegistration) {
    deviceRegistration = (async () => {
      try {
        const existing = getStoredDeviceCredentials();
        const payload = existing || mintDeviceCredentials();
        if (!existing) storeDeviceCredentials(payload.publicId, payload.secret);
        const registered = await registerCustomerDevice(payload);
        storeDeviceCredentials(registered.publicId, registered.secret);
        return registered;
      } catch (err) {
        deviceRegistration = null;
        throw err;
      }
    })();
  }
  return deviceRegistration;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function syncGrantedSubscription() {
  const config = await loadPushConfig();
  if (!config?.enabled || !config.vapidPublicKey) return false;
  const registration = await navigator.serviceWorker.register('/push-sw.js');
  const ready = await navigator.serviceWorker.ready;
  const active = ready || registration;
  let subscription = await active.pushManager.getSubscription();
  if (!subscription) {
    subscription = await active.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
    });
  }
  const json = subscription.toJSON();
  if (!json?.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
  await savePushSubscription({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  });
  return true;
}

export function CustomerDeviceProvider({ children }) {
  const location = useLocation();
  const customerFacing = isCustomerFacingPath(location.pathname);
  const [ready, setReady] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushPromptOpen, setPushPromptOpen] = useState(false);
  const [pushDeniedHint, setPushDeniedHint] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const syncedRef = useRef(false);

  const refreshUnread = useCallback(async () => {
    try {
      const data = await getUnreadNotificationCount();
      setUnreadCount(Number(data.unreadCount || 0));
    } catch {
      /* device may not be registered yet */
    }
  }, []);

  useEffect(() => {
    if (!customerFacing) {
      setReady(true);
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        await ensureDeviceRegistered();
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
  }, [customerFacing, refreshUnread]);

  const syncPushIfGranted = useCallback(async () => {
    if (!isPushApiSupported() || Notification.permission !== 'granted') return false;
    if (!getStoredDeviceCredentials()) return false;
    if (syncedRef.current) return true;
    try {
      const ok = await syncGrantedSubscription();
      if (ok) syncedRef.current = true;
      return ok;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    if (!isCustomerFacingPath(location.pathname) || !isPushApiSupported()) {
      setPushPromptOpen(false);
      setPushDeniedHint(false);
      return undefined;
    }

    let cancelled = false;
    let timer = 0;

    (async () => {
      if (Notification.permission === 'granted') {
        setPushPromptOpen(false);
        setPushDeniedHint(false);
        await syncPushIfGranted();
        return;
      }
      if (Notification.permission === 'denied') {
        setPushPromptOpen(false);
        if (!wasDeniedHintDismissed()) setPushDeniedHint(true);
        return;
      }
      if (wasPushPromptDismissed()) return;
      try {
        const config = await loadPushConfig();
        if (cancelled || !config?.enabled || !config.vapidPublicKey) return;
      } catch {
        return;
      }
      timer = window.setTimeout(() => {
        if (!cancelled && Notification.permission === 'default' && !wasPushPromptDismissed()) {
          setPushDeniedHint(false);
          setPushPromptOpen(true);
        }
      }, PROMPT_DELAY_MS);
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready, location.pathname, syncPushIfGranted]);

  const maybeAskPush = useCallback(() => {
    if (!isCustomerFacingPath(location.pathname) || !isPushApiSupported()) return;
    if (Notification.permission === 'granted') {
      syncPushIfGranted();
      return;
    }
    if (Notification.permission === 'denied') {
      if (!wasDeniedHintDismissed()) setPushDeniedHint(true);
      return;
    }
    if (wasPushPromptDismissed()) return;
    setPushPromptOpen(true);
  }, [location.pathname, syncPushIfGranted]);

  const enablePush = useCallback(async () => {
    if (pushBusy) return false;
    if (!isPushApiSupported()) {
      setPushPromptOpen(false);
      return false;
    }
    if (Notification.permission === 'denied') {
      setPushPromptOpen(false);
      setPushDeniedHint(true);
      return false;
    }
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushPromptOpen(false);
        if (permission === 'denied') {
          setPushDeniedHint(true);
        } else {
          dismissPushPrompt();
        }
        return false;
      }
      setPushPromptOpen(false);
      setPushDeniedHint(false);
      syncedRef.current = false;
      return await syncPushIfGranted();
    } catch {
      setPushPromptOpen(false);
      return false;
    } finally {
      setPushBusy(false);
    }
  }, [pushBusy, syncPushIfGranted]);

  const skipPush = useCallback(() => {
    dismissPushPrompt();
    setPushPromptOpen(false);
  }, []);

  const dismissDeniedHint = useCallback(() => {
    rememberDeniedHint();
    setPushDeniedHint(false);
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
      dismissDeniedHint,
      pushPromptOpen,
      pushDeniedHint,
      pushBusy,
    }),
    [
      ready,
      unreadCount,
      refreshUnread,
      maybeAskPush,
      enablePush,
      skipPush,
      dismissDeniedHint,
      pushPromptOpen,
      pushDeniedHint,
      pushBusy,
    ],
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
    dismissDeniedHint: () => {},
    pushPromptOpen: false,
    pushDeniedHint: false,
    pushBusy: false,
  };
}
