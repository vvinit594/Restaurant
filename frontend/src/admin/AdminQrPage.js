import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../components/Loader';
import QrCodeImage, { downloadQrPng } from '../components/QrCodeImage';
import {
  backfillAdminQr,
  getAdminQrList,
  regenerateAdminRestaurantQr,
} from '../services/qrApi';
import { resolveQrScanUrl } from '../services/qrUrl';
import ConfirmDialog from './components/ConfirmDialog';
import { useToast } from './components/Toast';

export default function AdminQrPage() {
  const { push } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** Mutually exclusive: null | { type: 'preview', ... } | { type: 'confirm', restaurantId, name } */
  const [activeModal, setActiveModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminQrList();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load QR codes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onBackfill = async () => {
    setBusy(true);
    try {
      const result = await backfillAdminQr();
      push(
        result.created
          ? `Generated ${result.created} missing QR code(s).`
          : 'All restaurants already have QR codes.',
      );
      await load();
    } catch (err) {
      push(err.message || 'Backfill failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const onRegenerate = async () => {
    if (activeModal?.type !== 'confirm') return;
    setBusy(true);
    try {
      await regenerateAdminRestaurantQr(activeModal.restaurantId);
      push('QR regenerated. Old token is disabled.');
      setActiveModal(null);
      await load();
    } catch (err) {
      push(err.message || 'Regenerate failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>QR Management</h1>
          <p className="admin-muted">
            Platform QR codes for public restaurant menus (`/r/{'{slug}'}/t/{'{token}'}`).
          </p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={onBackfill}
          disabled={busy || loading}
        >
          Generate Missing QR
        </button>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Restaurant</th>
              <th>QR Status</th>
              <th>Path</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>
                  <Loader variant="inline" label="Loading QR codes…" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="admin-empty admin-empty-inline">
                    <h3>No restaurants yet</h3>
                    <p>Create a restaurant to auto-generate its QR code.</p>
                    <Link to="/admin/restaurants/new" className="admin-btn admin-btn-primary">
                      + Add Restaurant
                    </Link>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const qr = row.qr;
                const scanUrl = qr ? resolveQrScanUrl(qr, row.slug) : '';
                return (
                  <tr key={row.restaurantId}>
                    <td>
                      <strong>{row.name}</strong>
                      <div className="admin-cell-sub">/{row.slug}</div>
                    </td>
                    <td>
                      {qr ? (
                        <span className="admin-badge admin-badge-active">Active</span>
                      ) : (
                        <span className="admin-badge admin-badge-suspended">Missing</span>
                      )}
                    </td>
                    <td>
                      <code className="admin-cell-sub">
                        {qr?.path || '—'}
                      </code>
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        {qr ? (
                          <>
                            <button
                              type="button"
                              className="admin-link-btn"
                              onClick={() =>
                                setActiveModal({ type: 'preview', ...row, scanUrl })
                              }
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              className="admin-link-btn"
                              onClick={() =>
                                downloadQrPng(scanUrl, `${row.slug}-qr.png`)
                              }
                            >
                              Download
                            </button>
                            <a
                              className="admin-link-btn"
                              href={scanUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open Menu
                            </a>
                            <button
                              type="button"
                              className="admin-link-btn danger"
                              onClick={() =>
                                setActiveModal({
                                  type: 'confirm',
                                  restaurantId: row.restaurantId,
                                  name: row.name,
                                })
                              }
                            >
                              Regenerate
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="admin-link-btn"
                            onClick={onBackfill}
                          >
                            Generate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {activeModal?.type === 'preview' && activeModal.qr ? (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{activeModal.name}</h3>
            <p className="admin-muted">Scan to open the public menu.</p>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
              <QrCodeImage
                value={
                  activeModal.scanUrl ||
                  resolveQrScanUrl(activeModal.qr, activeModal.slug)
                }
                size={240}
                alt={`${activeModal.name} QR`}
              />
            </div>
            <p className="admin-cell-sub" style={{ wordBreak: 'break-all' }}>
              {activeModal.scanUrl ||
                resolveQrScanUrl(activeModal.qr, activeModal.slug)}
            </p>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => setActiveModal(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() =>
                  downloadQrPng(
                    activeModal.scanUrl ||
                      resolveQrScanUrl(activeModal.qr, activeModal.slug),
                    `${activeModal.slug}-qr.png`,
                  )
                }
              >
                Download PNG
              </button>
              <a
                className="admin-btn admin-btn-primary"
                href={
                  activeModal.scanUrl ||
                  resolveQrScanUrl(activeModal.qr, activeModal.slug)
                }
                target="_blank"
                rel="noreferrer"
              >
                Open Menu
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={activeModal?.type === 'confirm'}
        title="Regenerate QR?"
        message={
          activeModal?.type === 'confirm'
            ? `A new QR will be created for "${activeModal.name}". The old token will stop working.`
            : ''
        }
        confirmLabel="Regenerate"
        danger
        loading={busy}
        onCancel={() => setActiveModal(null)}
        onConfirm={onRegenerate}
      />
    </div>
  );
}
