import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../components/Loader';
import { getCustomerLiveOrders, getCustomerProfile, updateCustomerProfile } from '../services/customerApi';

export default function CustomerOverviewPage() {
  const [profile, setProfile] = useState(null);
  const [live, setLive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ displayName: '', phone: '', email: '' });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [p, orders] = await Promise.all([
          getCustomerProfile(),
          getCustomerLiveOrders({ limit: 3 }),
        ]);
        if (!alive) return;
        setProfile(p);
        setForm({
          displayName: p.displayName || '',
          phone: p.phone || '',
          email: p.email || '',
        });
        setLive(orders.items || []);
      } catch (err) {
        if (alive) setError(err.message || 'Could not load your account.');
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
    setError('');
    try {
      const updated = await updateCustomerProfile(form);
      setProfile(updated);
    } catch (err) {
      setError(err.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader variant="inline" label="Loading your account…" />;

  return (
    <div className="customer-page">
      <header className="customer-page-head">
        <h1>Your account</h1>
        <p>No login needed. This device keeps your DilYum orders, offers, and notifications.</p>
      </header>

      {error ? <p className="customer-error">{error}</p> : null}

      <section className="customer-card">
        <h2>Profile</h2>
        {profile && !profile.hasProfileDetails ? (
          <p className="customer-empty">
            No name or contact details yet. Add them if you would like restaurants to personalize offers.
          </p>
        ) : null}
        <form className="customer-form" onSubmit={onSave}>
          <label>
            Name
            <input
              value={form.displayName}
              onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
              placeholder="Optional"
            />
          </label>
          <label>
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="Optional"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="Optional"
            />
          </label>
          <button type="submit" className="customer-btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </section>

      <section className="customer-card">
        <div className="customer-card-head">
          <h2>Live orders</h2>
          <Link to="/account/orders/live">View all</Link>
        </div>
        {live.length === 0 ? (
          <p className="customer-empty">No active orders</p>
        ) : (
          <ul className="customer-list">
            {live.map((order) => (
              <li key={order.id}>
                <Link to={`/account/orders/${order.id}`}>
                  <strong>{order.restaurantName}</strong>
                  <span>{order.orderNumber} · {order.statusLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
