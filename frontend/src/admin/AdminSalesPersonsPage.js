import React, { useCallback, useEffect, useState } from 'react';
import Loader from '../components/Loader';
import { validatePasswordStrength } from '../services/passwordHash';
import {
  createAdminSalesPerson,
  getAdminSalesPerson,
  getAdminSalesPersons,
  setAdminSalesPersonStatus,
} from '../services/adminSalesApi';
import ConfirmDialog from './components/ConfirmDialog';
import { useToast } from './components/Toast';

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  password: '',
};

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function statusLabel(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'ACTIVE') return 'Active';
  if (s === 'INACTIVE') return 'Inactive';
  return status || '—';
}

export default function AdminSalesPersonsPage() {
  const { push } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminSalesPersons();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load Sales Persons.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const next = {};
    if (!String(form.name || '').trim()) next.name = 'Full name is required.';
    if (!String(form.phone || '').trim()) next.phone = 'Phone number is required.';
    if (!String(form.email || '').trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    const passwordError = validatePasswordStrength(form.password);
    if (passwordError) next.password = passwordError;
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const onCreate = async (e) => {
    e.preventDefault();
    if (!validate()) {
      push('Please check the highlighted fields.', 'error');
      return;
    }
    setSaving(true);
    try {
      const created = await createAdminSalesPerson(form);
      push(
        `Sales Person created successfully — ${created.name} (${created.salesCode}).`,
      );
      setFormOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      push(err.message || 'Unable to create Sales Person. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await getAdminSalesPerson(id);
      setDetail(data);
    } catch (err) {
      push(err.message || 'Could not load Sales Person details.', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const onConfirmStatus = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await setAdminSalesPersonStatus(confirm.id, confirm.nextStatus);
      push(
        confirm.nextStatus === 'INACTIVE'
          ? 'Sales Person deactivated.'
          : 'Sales Person activated.',
      );
      setConfirm(null);
      if (detail?.id === confirm.id) {
        const refreshed = await getAdminSalesPerson(confirm.id);
        setDetail(refreshed);
      }
      await load();
    } catch (err) {
      push(err.message || 'Could not update status.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Sales Persons</h1>
          <p className="admin-muted">
            Manage sales persons who onboard restaurants to the DilYum platform.
          </p>
        </div>
        <button type="button" className="admin-btn admin-btn-primary" onClick={openCreate}>
          + Add Sales Person
        </button>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
      {loading ? <Loader label="Loading Sales Persons…" /> : null}

      {!loading && rows.length === 0 ? (
        <div className="admin-empty">
          <h3>No Sales Persons yet.</h3>
          <p>
            Create a Sales Person to start onboarding restaurants through the sales team.
          </p>
          <button type="button" className="admin-btn admin-btn-primary" onClick={openCreate}>
            + Add Sales Person
          </button>
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Sales ID</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Restaurants Added</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const active = String(row.status).toUpperCase() === 'ACTIVE';
                return (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className="admin-link-btn"
                        onClick={() => openDetail(row.id)}
                      >
                        <strong>{row.name}</strong>
                      </button>
                    </td>
                    <td>{row.salesCode}</td>
                    <td>{row.email}</td>
                    <td>{row.phone || '—'}</td>
                    <td>{row.restaurantsAdded ?? 0}</td>
                    <td>
                      <span
                        className={`admin-badge ${
                          active ? 'admin-badge-active' : 'admin-badge-suspended'
                        }`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="admin-link-btn"
                          onClick={() => openDetail(row.id)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="admin-link-btn"
                          onClick={() =>
                            setConfirm({
                              id: row.id,
                              name: row.name,
                              nextStatus: active ? 'INACTIVE' : 'ACTIVE',
                            })
                          }
                        >
                          {active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {formOpen ? (
        <div className="admin-modal-overlay" role="presentation" onClick={() => !saving && setFormOpen(false)}>
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-sales-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="create-sales-title">Create Sales Person</h3>
            <p className="admin-muted">They will sign in at /sales-login with the credentials you set.</p>
            <form onSubmit={onCreate}>
              <label className="admin-field">
                <span>Full Name *</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  disabled={saving}
                  autoComplete="name"
                />
                {formErrors.name ? <em className="admin-field-error">{formErrors.name}</em> : null}
              </label>
              <label className="admin-field">
                <span>Phone Number *</span>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  disabled={saving}
                  autoComplete="tel"
                />
                {formErrors.phone ? <em className="admin-field-error">{formErrors.phone}</em> : null}
              </label>
              <label className="admin-field">
                <span>Email Address *</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  disabled={saving}
                  autoComplete="email"
                />
                {formErrors.email ? <em className="admin-field-error">{formErrors.email}</em> : null}
              </label>
              <label className="admin-field">
                <span>Password *</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  disabled={saving}
                  autoComplete="new-password"
                />
                {formErrors.password ? (
                  <em className="admin-field-error">{formErrors.password}</em>
                ) : null}
              </label>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                  {saving ? 'Creating…' : 'Create Sales Person'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {detailLoading ? (
        <div className="admin-modal-overlay" role="presentation">
          <div className="admin-modal admin-modal-sm">
            <Loader label="Loading details…" />
          </div>
        </div>
      ) : null}

      {detail && !detailLoading ? (
        <div className="admin-modal-overlay" role="presentation" onClick={() => setDetail(null)}>
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-page-header" style={{ marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>{detail.name}</h3>
                <p className="admin-muted" style={{ margin: '4px 0 0' }}>
                  {detail.salesCode}
                </p>
              </div>
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
            <dl className="admin-dl">
              <div>
                <dt>Email</dt>
                <dd>{detail.email}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{detail.phone || '—'}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{statusLabel(detail.status)}</dd>
              </div>
              <div>
                <dt>Restaurants Added</dt>
                <dd>{detail.restaurantsAdded ?? 0}</dd>
              </div>
              <div>
                <dt>Active Restaurants</dt>
                <dd>{detail.activeRestaurants ?? 0}</dd>
              </div>
              <div>
                <dt>Joined</dt>
                <dd>{formatDate(detail.createdAt)}</dd>
              </div>
            </dl>
            {(detail.restaurants || []).length > 0 ? (
              <>
                <h4 style={{ marginTop: 16 }}>Restaurants</h4>
                <ul className="sales-plan-list">
                  {detail.restaurants.map((r) => (
                    <li key={r.id}>
                      <span>{r.name}</span>
                      <strong>{r.status}</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="admin-muted" style={{ marginTop: 12 }}>
                No restaurants onboarded yet.
              </p>
            )}
            <div className="admin-modal-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className={`admin-btn ${
                  String(detail.status).toUpperCase() === 'ACTIVE'
                    ? 'admin-btn-danger'
                    : 'admin-btn-primary'
                }`}
                onClick={() =>
                  setConfirm({
                    id: detail.id,
                    name: detail.name,
                    nextStatus:
                      String(detail.status).toUpperCase() === 'ACTIVE'
                        ? 'INACTIVE'
                        : 'ACTIVE',
                  })
                }
              >
                {String(detail.status).toUpperCase() === 'ACTIVE'
                  ? 'Deactivate'
                  : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={
          confirm?.nextStatus === 'INACTIVE'
            ? 'Deactivate Sales Person?'
            : 'Activate Sales Person?'
        }
        message={
          confirm?.nextStatus === 'INACTIVE'
            ? `${confirm?.name || 'This Sales Person'} will no longer be able to log in.`
            : `${confirm?.name || 'This Sales Person'} will be able to log in again.`
        }
        confirmLabel={confirm?.nextStatus === 'INACTIVE' ? 'Deactivate' : 'Activate'}
        danger={confirm?.nextStatus === 'INACTIVE'}
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={onConfirmStatus}
      />
    </div>
  );
}
