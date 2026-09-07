import React, { useEffect, useState } from 'react';
import Loader from '../components/Loader';
import { useToast } from '../admin/components/Toast';
import { getSalesProfile, updateSalesProfile } from '../services/salesApi';

export default function SalesProfilePage() {
  const { push } = useToast();
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const p = await getSalesProfile();
        if (alive) {
          setProfile(p);
          setName(p.name || '');
          setPhone(p.phone || '');
          setError('');
        }
      } catch (err) {
        if (alive) setError(err.message || 'Failed to load profile.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateSalesProfile({ name, phone });
      setProfile(updated);
      push('Profile updated.');
    } catch (err) {
      push(err.message || 'Could not update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Profile</h1>
          <p className="admin-muted">Your Sales Person account details.</p>
        </div>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
      {loading ? <Loader label="Loading profile…" /> : null}

      {!loading && profile ? (
        <form className="sales-panel-card" onSubmit={onSave}>
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Sales ID</span>
              <input value={profile.salesCode} disabled readOnly />
            </label>
            <label className="admin-field">
              <span>Email</span>
              <input value={profile.email} disabled readOnly />
            </label>
            <label className="admin-field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
            </label>
            <label className="admin-field">
              <span>Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={saving} />
            </label>
            <label className="admin-field">
              <span>Status</span>
              <input value={profile.status} disabled readOnly />
            </label>
            <label className="admin-field">
              <span>Joined</span>
              <input
                value={profile.joinedAt ? new Date(profile.joinedAt).toLocaleString() : ''}
                disabled
                readOnly
              />
            </label>
          </div>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
