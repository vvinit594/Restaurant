import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ImageUploadField from '../components/ImageUploadField';
import { resolveImageUrl } from '../services/mediaApi';
import {
  activateRestaurant,
  getRestaurant,
  suspendRestaurant,
  updateRestaurant,
} from '../services/restaurantsApi';
import { slugify } from '../services/adminStorage';
import ConfirmDialog from './components/ConfirmDialog';
import StatusBadge from './components/StatusBadge';
import { useToast } from './components/Toast';

export default function RestaurantDetailPage() {
  const { restaurantId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const editing = searchParams.get('edit') === '1';
  const navigate = useNavigate();
  const { push } = useToast();

  const [restaurant, setRestaurant] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getRestaurant(restaurantId);
      setRestaurant(data);
      setForm({
        name: data.name,
        slug: data.slug,
        description: data.description || '',
        logoUrl: data.logoUrl || '',
        coverUrl: data.coverUrl || '',
        phone: data.phone,
        email: data.email,
        address: data.address,
        city: data.city,
        state: data.state || '',
        pincode: data.pincode || '',
        adminName: data.admin?.name || '',
        adminEmail: data.admin?.email || '',
        adminPhone: data.admin?.phone || '',
      });
      setLogoFile(null);
      setCoverFile(null);
    } catch (err) {
      setError(err.message || 'Failed to load restaurant.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const [logoUrl, coverUrl] = await Promise.all([
        resolveImageUrl({ url: form.logoUrl, file: logoFile }, { folder: 'restaurants/logos' }),
        resolveImageUrl({ url: form.coverUrl, file: coverFile }, { folder: 'restaurants/covers' }),
      ]);
      const updated = await updateRestaurant(restaurantId, {
        name: form.name,
        slug: slugify(form.slug),
        description: form.description,
        logoUrl,
        coverUrl,
        phone: form.phone,
        email: form.email,
        address: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        admin: {
          name: form.adminName,
          email: form.adminEmail,
          phone: form.adminPhone,
        },
      });
      setRestaurant(updated);
      push('Restaurant updated.');
      setSearchParams({});
    } catch (err) {
      push(err.message || 'Update failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const runStatus = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      const updated =
        confirm.action === 'suspend'
          ? await suspendRestaurant(restaurantId)
          : await activateRestaurant(restaurantId);
      setRestaurant(updated);
      push(confirm.action === 'suspend' ? 'Restaurant suspended.' : 'Restaurant activated.');
      setConfirm(null);
    } catch (err) {
      push(err.message || 'Action failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-skeleton admin-skeleton-lg" />
        <div className="admin-skeleton admin-mt" />
        <div className="admin-skeleton admin-mt" />
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="admin-page">
        <div className="admin-alert admin-alert-error">{error || 'Not found'}</div>
        <Link to="/admin/restaurants" className="admin-btn admin-btn-secondary">
          Back to restaurants
        </Link>
      </div>
    );
  }

  const s = restaurant.stats || {};

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-breadcrumb">
            <Link to="/admin/restaurants">Restaurants</Link> / {restaurant.name}
          </p>
          <h1>{restaurant.name}</h1>
          <div className="admin-inline-meta">
            <StatusBadge status={restaurant.status} />
            <span className="admin-muted">/{restaurant.slug}</span>
            <span className="admin-muted">{restaurant.subscriptionPlan?.name} plan</span>
          </div>
        </div>
        <div className="admin-header-actions">
          {!editing ? (
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setSearchParams({ edit: '1' })}>
              Edit Restaurant
            </button>
          ) : null}
          {restaurant.status === 'active' ? (
            <button
              type="button"
              className="admin-btn admin-btn-danger"
              onClick={() => setConfirm({ action: 'suspend' })}
            >
              Suspend Restaurant
            </button>
          ) : (
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => setConfirm({ action: 'activate' })}
            >
              Activate Restaurant
            </button>
          )}
          <button type="button" className="admin-btn admin-btn-ghost" onClick={() => navigate('/admin/qr')}>
            Manage QR
          </button>
        </div>
      </div>

      {editing && form ? (
        <form className="admin-form admin-form-card" onSubmit={onSave}>
          <h2>Edit Restaurant</h2>
          <div className="admin-form-grid">
            <label className="admin-field"><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="admin-field"><span>Slug</span><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></label>
            <label className="admin-field span-2"><span>Description</span><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <ImageUploadField
              className="span-2"
              label="Restaurant Logo"
              url={form.logoUrl}
              file={logoFile}
              onUrlChange={(v) => setForm({ ...form, logoUrl: v })}
              onFileChange={setLogoFile}
            />
            <ImageUploadField
              className="span-2"
              label="Cover Image"
              url={form.coverUrl}
              file={coverFile}
              onUrlChange={(v) => setForm({ ...form, coverUrl: v })}
              onFileChange={setCoverFile}
            />
            <label className="admin-field"><span>Phone</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="admin-field"><span>Email</span><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="admin-field span-2"><span>Address</span><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <label className="admin-field"><span>City</span><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
            <label className="admin-field"><span>State</span><input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>
            <label className="admin-field"><span>Pincode</span><input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} /></label>
            <label className="admin-field"><span>Admin Name</span><input value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} /></label>
            <label className="admin-field"><span>Admin Email</span><input value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} /></label>
            <label className="admin-field"><span>Admin Phone</span><input value={form.adminPhone} onChange={(e) => setForm({ ...form, adminPhone: e.target.value })} /></label>
          </div>
          <div className="admin-form-actions">
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setSearchParams({})}>Cancel</button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      ) : (
        <div className="admin-detail-grid">
          <section className="admin-panel">
            <h2>Restaurant Information</h2>
            <dl className="admin-dl">
              <div><dt>Name</dt><dd>{restaurant.name}</dd></div>
              <div><dt>Slug</dt><dd>/{restaurant.slug}</dd></div>
              <div><dt>Address</dt><dd>{restaurant.address}, {restaurant.city}{restaurant.state ? `, ${restaurant.state}` : ''} {restaurant.pincode}</dd></div>
              <div><dt>Phone</dt><dd>{restaurant.phone}</dd></div>
              <div><dt>Email</dt><dd>{restaurant.email}</dd></div>
              <div><dt>Status</dt><dd><StatusBadge status={restaurant.status} /></dd></div>
              <div><dt>Subscription</dt><dd>{restaurant.subscriptionPlan?.name} ({restaurant.subscriptionPlan?.priceLabel})</dd></div>
              <div><dt>Description</dt><dd>{restaurant.description || '—'}</dd></div>
            </dl>
          </section>

          <section className="admin-panel">
            <h2>Restaurant Admin</h2>
            <dl className="admin-dl">
              <div><dt>Name</dt><dd>{restaurant.admin?.name || '—'}</dd></div>
              <div><dt>Email</dt><dd>{restaurant.admin?.email || '—'}</dd></div>
              <div><dt>Phone</dt><dd>{restaurant.admin?.phone || '—'}</dd></div>
              <div><dt>Account status</dt><dd><StatusBadge status={restaurant.admin?.status || 'active'} /></dd></div>
              <div><dt>Role</dt><dd>{restaurant.admin?.role || 'RESTAURANT_ADMIN'}</dd></div>
            </dl>
            <p className="admin-muted admin-mt">
              Restaurant Admin can only access this restaurant. They cannot create or view other restaurants.
            </p>
          </section>

          <section className="admin-panel">
            <h2>Menu Overview</h2>
            <div className="admin-mini-stats">
              <div><strong>{s.categories ?? 0}</strong><span>Categories</span></div>
              <div><strong>{s.dishes ?? 0}</strong><span>Dishes</span></div>
              <div><strong>{s.publishedDishes ?? 0}</strong><span>Published</span></div>
              <div><strong>{s.unavailableDishes ?? 0}</strong><span>Unavailable</span></div>
            </div>
          </section>

          <section className="admin-panel">
            <h2>QR Overview</h2>
            <div className="admin-mini-stats">
              <div><strong>{s.tables ?? 0}</strong><span>Tables</span></div>
              <div><strong>{s.activeQrCodes ?? 0}</strong><span>Active QR</span></div>
              <div><strong>{s.revokedQrCodes ?? 0}</strong><span>Revoked QR</span></div>
            </div>
            <p className="admin-muted admin-mt">
              Future QR format: <code>/r/{restaurant.slug}/t/{'{qrToken}'}</code>
            </p>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.action === 'suspend' ? 'Suspend restaurant?' : 'Activate restaurant?'}
        message={
          confirm?.action === 'suspend'
            ? `${restaurant.name} will be suspended.`
            : `${restaurant.name} will be activated.`
        }
        confirmLabel={confirm?.action === 'suspend' ? 'Suspend' : 'Activate'}
        danger={confirm?.action === 'suspend'}
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={runStatus}
      />
    </div>
  );
}
