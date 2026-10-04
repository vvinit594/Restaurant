import React, { useEffect, useState } from 'react';
import ListPagination, { readPage } from '../components/ListPagination';
import Loader from '../components/Loader';
import QrCodeImage, { downloadQrPng } from '../components/QrCodeImage';
import { getSalesQr } from '../services/salesApi';
import { useToast } from '../admin/components/Toast';

export default function SalesQrManagementPage() {
  const { push } = useToast();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getSalesQr({ page });
        if (alive) {
          const parsed = readPage(data);
          setRows(parsed.items);
          setMeta(parsed);
          setError('');
        }
      } catch (err) {
        if (alive) setError(err.message || 'Failed to load QR codes.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [page]);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>QR Management</h1>
          <p className="admin-muted">QR codes for restaurants you added. View and download only.</p>
        </div>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
      {loading ? <Loader label="Loading QR codes…" /> : null}

      {!loading && rows.length === 0 ? (
        <div className="admin-empty">
          <h3>No QR codes yet</h3>
          <p>QR codes appear after you add a restaurant.</p>
        </div>
      ) : null}

      <div className="sales-qr-grid">
        {rows.map((qr) => (
          <article key={qr.id || `${qr.restaurantId}-${qr.token}`} className="sales-panel-card">
            <h3>{qr.restaurantName}</h3>
            <p className="admin-muted">{qr.targetUrl || qr.path}</p>
            <p className="admin-muted">
              Status: {qr.status} · Generated{' '}
              {qr.createdAt ? new Date(qr.createdAt).toLocaleDateString() : '—'}
            </p>
            <div className="order-checkout-actions">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setPreview(qr)}
              >
                View QR
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => {
                  try {
                    downloadQrPng(
                      qr.targetUrl || qr.path,
                      `qr-${qr.restaurantSlug || qr.restaurantId}.png`,
                    );
                  } catch (err) {
                    push(err.message || 'Download failed.', 'error');
                  }
                }}
              >
                Download QR
              </button>
            </div>
          </article>
        ))}
      </div>

      <ListPagination
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        noun="QR codes"
        disabled={loading}
        onPage={setPage}
      />

      {preview ? (
        <div className="order-cart-overlay" onClick={() => setPreview(null)} role="presentation">
          <div
            className="order-checkout-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button type="button" className="dish-modal-close" onClick={() => setPreview(null)}>
              ×
            </button>
            <h3>{preview.restaurantName}</h3>
            <QrCodeImage value={preview.targetUrl || preview.path} size={220} />
            <p className="admin-muted">{preview.targetUrl}</p>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setPreview(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
