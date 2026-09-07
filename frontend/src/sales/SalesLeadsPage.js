import React, { useEffect, useState } from 'react';
import Loader from '../components/Loader';
import { useToast } from '../admin/components/Toast';
import {
  createSalesLead,
  getSalesLeads,
  updateSalesLead,
} from '../services/salesApi';

const STATUSES = ['NEW', 'CONTACTED', 'INTERESTED', 'DEMO', 'CONVERTED', 'LOST'];

const EMPTY = {
  contactName: '',
  restaurantName: '',
  phone: '',
  email: '',
  notes: '',
  status: 'NEW',
};

export default function SalesLeadsPage() {
  const { push } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getSalesLeads();
      setRows(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load leads.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createSalesLead(form);
      setForm(EMPTY);
      push('Lead created.');
      await load();
    } catch (err) {
      push(err.message || 'Could not create lead.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onStatus = async (id, status) => {
    try {
      await updateSalesLead(id, { status });
      await load();
    } catch (err) {
      push(err.message || 'Update failed.', 'error');
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Restaurant Leads</h1>
          <p className="admin-muted">Track prospects before they become DilYum restaurants.</p>
        </div>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}

      <form className="admin-form-card" onSubmit={onCreate} style={{ marginBottom: 16 }}>
        <h2>Add lead</h2>
        <div className="admin-form-grid">
          {[
            ['contactName', 'Contact name'],
            ['restaurantName', 'Restaurant name'],
            ['phone', 'Phone'],
            ['email', 'Email'],
          ].map(([key, label]) => (
            <label key={key} className="admin-field">
              <span>{label}</span>
              <input
                value={form[key]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                disabled={saving}
                required={key === 'contactName' || key === 'restaurantName'}
                placeholder={label}
              />
            </label>
          ))}
        </div>
        <label className="admin-field" style={{ marginTop: 12 }}>
          <span>Notes</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            disabled={saving}
            placeholder="Optional notes"
          />
        </label>
        <div className="order-checkout-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Add Lead'}
          </button>
        </div>
      </form>

      {loading ? <Loader label="Loading leads…" /> : null}

      {!loading && rows.length === 0 ? (
        <div className="admin-empty">
          <h3>No leads yet</h3>
          <p>Add a lead to start tracking conversations.</p>
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Restaurant</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.contactName}</strong>
                    <div className="admin-muted">{l.email}</div>
                  </td>
                  <td>{l.restaurantName}</td>
                  <td>{l.phone || '—'}</td>
                  <td>
                    <select
                      value={l.status}
                      onChange={(e) => onStatus(l.id, e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{new Date(l.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
