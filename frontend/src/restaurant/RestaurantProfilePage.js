import React, { useEffect, useState } from 'react';
import ImageUploadField from '../components/ImageUploadField';
import { resolveImageUrl } from '../services/mediaApi';
import {
  getRestaurantProfile,
  updateRestaurantProfile,
} from '../services/restaurantMenuApi';
import { useToast } from '../admin/components/Toast';
import { useRestaurantAuth } from './auth/RestaurantAuthContext';

const EMPTY = {
  name: '',
  slug: '',
  description: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  logoUrl: '',
  coverUrl: '',
};

export default function RestaurantProfilePage() {
  const { permissions, user } = useRestaurantAuth();
  const { push } = useToast();
  const canEdit = Boolean(permissions?.manageProfile);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const profile = await getRestaurantProfile();
        if (!alive) return;
        setForm({
          name: profile.name || '',
          slug: profile.slug || '',
          description: profile.description || '',
          phone: profile.phone || '',
          email: profile.email || '',
          address: profile.address || '',
          city: profile.city || '',
          state: profile.state || '',
          pincode: profile.pincode || '',
          logoUrl: profile.logoUrl || '',
          coverUrl: profile.coverUrl || profile.coverImageUrl || '',
        });
        setLogoFile(null);
        setCoverFile(null);
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

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const [logoUrl, coverImageUrl] = await Promise.all([
        resolveImageUrl(
          { url: form.logoUrl, file: logoFile },
          { folder: 'restaurants/logos' },
        ),
        resolveImageUrl(
          { url: form.coverUrl, file: coverFile },
          { folder: 'restaurants/covers' },
        ),
      ]);
      const updated = await updateRestaurantProfile({
        name: form.name,
        description: form.description,
        phone: form.phone,
        email: form.email,
        address: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        logoUrl,
        coverImageUrl,
      });
      setForm((prev) => ({
        ...prev,
        ...updated,
        coverUrl: updated.coverUrl || updated.coverImageUrl || '',
      }));
      setLogoFile(null);
      setCoverFile(null);
      push('Restaurant profile updated.');
    } catch (err) {
      push(err.message || 'Could not save profile.', 'error');
    } finally {
      setSaving(false);
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

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Restaurant Profile</h1>
          <p className="admin-muted">
            Profile for <strong>{user?.restaurantName || form.name}</strong> only.
          </p>
        </div>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}

      <form className="admin-form" onSubmit={onSubmit}>
        <div className="admin-form-grid">
          <label className="admin-field">
            <span>Restaurant Name *</span>
            <input
              className="admin-input"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              disabled={!canEdit || saving}
              required
            />
          </label>
          <label className="admin-field">
            <span>Slug (read-only)</span>
            <input className="admin-input" value={form.slug} disabled />
          </label>
          <label className="admin-field admin-field-full">
            <span>Description</span>
            <textarea
              className="admin-input"
              rows={3}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              disabled={!canEdit || saving}
            />
          </label>
          <label className="admin-field">
            <span>Phone *</span>
            <input
              className="admin-input"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              disabled={!canEdit || saving}
              required
            />
          </label>
          <label className="admin-field">
            <span>Email *</span>
            <input
              className="admin-input"
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              disabled={!canEdit || saving}
              required
            />
          </label>
          <label className="admin-field admin-field-full">
            <span>Address *</span>
            <input
              className="admin-input"
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              disabled={!canEdit || saving}
              required
            />
          </label>
          <label className="admin-field">
            <span>City *</span>
            <input
              className="admin-input"
              value={form.city}
              onChange={(e) => setField('city', e.target.value)}
              disabled={!canEdit || saving}
              required
            />
          </label>
          <label className="admin-field">
            <span>State</span>
            <input
              className="admin-input"
              value={form.state}
              onChange={(e) => setField('state', e.target.value)}
              disabled={!canEdit || saving}
            />
          </label>
          <label className="admin-field">
            <span>Pincode</span>
            <input
              className="admin-input"
              value={form.pincode}
              onChange={(e) => setField('pincode', e.target.value)}
              disabled={!canEdit || saving}
            />
          </label>
        </div>

        <div className="admin-form-grid admin-mt">
          <div className="admin-field">
            <ImageUploadField
              label="Logo"
              url={form.logoUrl}
              file={logoFile}
              onUrlChange={(url) => setField('logoUrl', url)}
              onFileChange={setLogoFile}
              disabled={!canEdit || saving}
            />
          </div>
          <div className="admin-field">
            <ImageUploadField
              label="Cover Image"
              url={form.coverUrl}
              file={coverFile}
              onUrlChange={(url) => setField('coverUrl', url)}
              onFileChange={setCoverFile}
              disabled={!canEdit || saving}
            />
          </div>
        </div>

        {canEdit ? (
          <div className="admin-modal-actions admin-mt">
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        ) : (
          <p className="admin-muted admin-mt">Only the restaurant owner can edit this profile.</p>
        )}
      </form>
    </div>
  );
}
