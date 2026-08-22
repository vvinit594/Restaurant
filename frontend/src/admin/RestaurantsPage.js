import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  activateRestaurant,
  deleteRestaurant,
  getRestaurants,
  suspendRestaurant,
} from '../services/restaurantsApi';
import ConfirmDialog from './components/ConfirmDialog';
import StatusBadge from './components/StatusBadge';
import { useToast } from './components/Toast';

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

function confirmCopy(confirm) {
  if (!confirm) return { title: '', message: '', confirmLabel: 'Confirm', danger: false };
  if (confirm.action === 'delete') {
    return {
      title: 'Delete Restaurant?',
      message: `Are you sure you want to delete "${confirm.name}"? This action will remove the restaurant from the platform and its associated data.`,
      confirmLabel: 'Delete Restaurant',
      danger: true,
    };
  }
  if (confirm.action === 'suspend') {
    return {
      title: 'Suspend restaurant?',
      message: `${confirm.name} will be suspended and customer access can be blocked later via API.`,
      confirmLabel: 'Suspend',
      danger: true,
    };
  }
  return {
    title: 'Activate restaurant?',
    message: `${confirm.name} will be set back to active.`,
    confirmLabel: 'Activate',
    danger: false,
  };
}

export default function RestaurantsPage() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getRestaurants({ search, status });
      setRows(data);
    } catch (err) {
      setError(err.message || 'Failed to load restaurants.');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const runConfirmAction = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.action === 'delete') {
        await deleteRestaurant(confirm.id);
        push('Restaurant deleted.');
      } else if (confirm.action === 'suspend') {
        await suspendRestaurant(confirm.id);
        push('Restaurant suspended.');
      } else {
        await activateRestaurant(confirm.id);
        push('Restaurant activated.');
      }
      setConfirm(null);
      await load();
    } catch (err) {
      push(err.message || 'Action failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const dialog = confirmCopy(confirm);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Restaurants</h1>
          <p className="admin-muted">All restaurants on the DILYUM platform.</p>
        </div>
        <Link to="/admin/restaurants/new" className="admin-btn admin-btn-primary">
          + Add Restaurant
        </Link>
      </div>

      <div className="admin-toolbar">
        <input
          className="admin-input"
          type="search"
          placeholder="Search restaurants, city, owner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="admin-input admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Restaurant Name</th>
              <th>Location</th>
              <th>Owner / Admin</th>
              <th>Subscription</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7}><div className="admin-skeleton" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="admin-empty admin-empty-inline">
                    <h3>No restaurants found</h3>
                    <p>Create the first restaurant to start onboarding.</p>
                    <Link to="/admin/restaurants/new" className="admin-btn admin-btn-primary">
                      + Add Restaurant
                    </Link>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                    <div className="admin-cell-sub">/{r.slug}</div>
                  </td>
                  <td>
                    {r.city}
                    {r.state ? `, ${r.state}` : ''}
                  </td>
                  <td>
                    {r.admin?.name || '—'}
                    <div className="admin-cell-sub">{r.admin?.email}</div>
                  </td>
                  <td>{r.subscriptionPlan?.name || '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td>
                    <div className="admin-row-actions">
                      <button type="button" className="admin-link-btn" onClick={() => navigate(`/admin/restaurants/${r.id}`)}>
                        View
                      </button>
                      <button type="button" className="admin-link-btn" onClick={() => navigate(`/admin/restaurants/${r.id}?edit=1`)}>
                        Edit
                      </button>
                      <button type="button" className="admin-link-btn" onClick={() => navigate(`/admin/restaurants/${r.id}`)}>
                        Manage
                      </button>
                      {r.status === 'active' ? (
                        <button
                          type="button"
                          className="admin-link-btn"
                          onClick={() => setConfirm({ id: r.id, name: r.name, action: 'suspend' })}
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="admin-link-btn"
                          onClick={() => setConfirm({ id: r.id, name: r.name, action: 'activate' })}
                        >
                          Activate
                        </button>
                      )}
                      <button
                        type="button"
                        className="admin-link-btn danger"
                        onClick={() => setConfirm({ id: r.id, name: r.name, action: 'delete' })}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={dialog.title}
        message={dialog.message}
        confirmLabel={dialog.confirmLabel}
        danger={dialog.danger}
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirmAction}
      />
    </div>
  );
}
