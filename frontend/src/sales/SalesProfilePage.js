import React, { useEffect, useState } from 'react';
import Loader from '../components/Loader';
import { useToast } from '../admin/components/Toast';
import { getSalesProfile, updateSalesProfile } from '../services/salesApi';

export default function SalesProfilePage() {
  const { push } = useToast();
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [upiId, setUpiId] = useState('');
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
          setUpiId(p.upiId || '');
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
      const trimmedUpi = upiId.trim();
      if (trimmedUpi && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/.test(trimmedUpi)) {
        push('Enter a valid UPI ID such as name@upi.', 'error');
        setSaving(false);
        return;
      }
      const updated = await updateSalesProfile({ name, phone, upiId: trimmedUpi });
      setProfile(updated);
      setUpiId(updated.upiId || '');
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
        <form className="admin-form-card" onSubmit={onSave}>
          <h2>Account details</h2>
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
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                placeholder="Your full name"
              />
            </label>
            <label className="admin-field">
              <span>Phone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={saving}
                placeholder="Phone number"
              />
            </label>
            <label className="admin-field">
              <span>UPI ID</span>
              <input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                disabled={saving}
                placeholder="name@upi"
                autoComplete="off"
                inputMode="email"
                spellCheck={false}
              />
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
          <div className="order-checkout-actions" style={{ marginTop: 16 }}>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
