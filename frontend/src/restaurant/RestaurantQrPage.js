import React, { useCallback, useEffect, useState } from 'react';
import QrCodeImage, { downloadQrPng } from '../components/QrCodeImage';
import { getMyRestaurantQr, regenerateMyRestaurantQr } from '../services/qrApi';
import ConfirmDialog from '../admin/components/ConfirmDialog';
import { useToast } from '../admin/components/Toast';

export default function RestaurantQrPage() {
  const { push } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await getMyRestaurantQr();
      setData(payload);
    } catch (err) {
      setError(err.message || 'Failed to load QR code.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRegenerate = async () => {
    setBusy(true);
    try {
      const payload = await regenerateMyRestaurantQr();
      setData(payload);
      setConfirmRegen(false);
      push('QR regenerated. Print the new code for customers.');
    } catch (err) {
      push(err.message || 'Could not regenerate QR.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-skeleton admin-skeleton-lg" />
        <div className="admin-skeleton admin-mt" />
      </div>
    );
  }

  if (error || !data?.qr) {
    return (
      <div className="admin-page">
        <h1>QR Codes</h1>
        <div className="admin-alert admin-alert-error">{error || 'QR not available.'}</div>
      </div>
    );
  }

  const { restaurant, qr } = data;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>QR Codes</h1>
          <p className="admin-muted">
            Customers scan this code to open your public menu.
          </p>
        </div>
      </div>

      <div className="admin-card" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ marginTop: 0 }}>{restaurant.name}</h2>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
          <QrCodeImage value={qr.targetUrl} size={260} alt={`${restaurant.name} QR`} />
        </div>
        <p className="admin-muted">
          Scan this QR code to open your restaurant menu.
        </p>
        <p className="admin-cell-sub" style={{ wordBreak: 'break-all', marginBottom: 20 }}>
          {qr.targetUrl}
        </p>
        <div className="admin-modal-actions" style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => downloadQrPng(qr.targetUrl, `${restaurant.slug}-qr.png`)}
          >
            Download QR
          </button>
          <a
            className="admin-btn admin-btn-primary"
            href={qr.targetUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open Menu
          </a>
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => setConfirmRegen(true)}
          >
            Regenerate
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRegen}
        title="Regenerate QR?"
        message="The previous QR will stop working. Download and reprint the new code."
        confirmLabel="Regenerate"
        danger
        loading={busy}
        onCancel={() => setConfirmRegen(false)}
        onConfirm={onRegenerate}
      />
    </div>
  );
}
