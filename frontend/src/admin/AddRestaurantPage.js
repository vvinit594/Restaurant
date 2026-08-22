import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ImageUploadField from '../components/ImageUploadField';
import { resolveImageUrl } from '../services/mediaApi';
import { validatePasswordStrength } from '../services/passwordHash';
import { createRestaurant, getSubscriptionPlans } from '../services/restaurantsApi';
import { slugify } from '../services/adminStorage';
import { useToast } from './components/Toast';

const INITIAL = {
  name: '',
  slug: '',
  description: '',
  logoUrl: '',
  coverUrl: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  adminName: '',
  adminEmail: '',
  adminPhone: '',
  adminPassword: '',
  confirmPassword: '',
  subscriptionPlanId: 'free',
};

export default function AddRestaurantPage() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [form, setForm] = useState(INITIAL);
  const [plans, setPlans] = useState([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

  useEffect(() => {
    getSubscriptionPlans().then(setPlans).catch(() => setPlans([]));
  }, []);

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'name' && !slugTouched) {
        next.slug = slugify(value);
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const next = {};
    const required = [
      ['name', 'Restaurant name is required'],
      ['slug', 'Slug is required'],
      ['phone', 'Phone is required'],
      ['email', 'Email is required'],
      ['address', 'Address is required'],
      ['city', 'City is required'],
      ['adminName', 'Admin name is required'],
      ['adminEmail', 'Admin email is required'],
    ];
    required.forEach(([key, msg]) => {
      if (!String(form[key] || '').trim()) next[key] = msg;
    });
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = 'Enter a valid email';
    }
    if (form.adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail)) {
      next.adminEmail = 'Enter a valid admin email';
    }
    const passwordError = validatePasswordStrength(form.adminPassword);
    if (passwordError) next.adminPassword = passwordError;
    if (!form.confirmPassword) {
      next.confirmPassword = 'Confirm password is required';
    } else if (form.adminPassword !== form.confirmPassword) {
      next.confirmPassword = 'Passwords do not match.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const [logoUrl, coverUrl] = await Promise.all([
        resolveImageUrl({ url: form.logoUrl, file: logoFile }, { folder: 'restaurants/logos' }),
        resolveImageUrl({ url: form.coverUrl, file: coverFile }, { folder: 'restaurants/covers' }),
      ]);

      // Keep payloads under Nest body limit; prefer URL until cloud upload exists
      const maxImageChars = 12 * 1024 * 1024;
      if ((logoUrl && logoUrl.length > maxImageChars) || (coverUrl && coverUrl.length > maxImageChars)) {
        throw new Error('Image is too large. Use a smaller image (under ~8 MB) or paste an image URL.');
      }

      const created = await createRestaurant({
        restaurant: {
          name: form.name,
          slug: slugify(form.slug || form.name),
          description: form.description,
          logoUrl,
          coverUrl,
          phone: form.phone,
          email: form.email,
          address: form.address,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
        },
        owner: {
          name: form.adminName,
          email: form.adminEmail,
          phone: form.adminPhone,
          password: form.adminPassword,
        },
        subscription: {
          plan: form.subscriptionPlanId,
        },
      });
      push(`Restaurant “${created.name}” created successfully.`);
      navigate(`/admin/restaurants/${created.id}`);
    } catch (err) {
      const detail = err.message || 'Could not create restaurant.';
      push(
        detail.toLowerCase().includes('must be') || err.code === 'VALIDATION'
          ? `Unable to create restaurant. ${detail}`
          : detail,
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === form.subscriptionPlanId),
    [plans, form.subscriptionPlanId]
  );

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Add Restaurant</h1>
          <p className="admin-muted">
            Only Super Admin can create restaurants. No public signup.
          </p>
        </div>
        <Link to="/admin/restaurants" className="admin-btn admin-btn-ghost">
          Cancel
        </Link>
      </div>

      <form className="admin-form admin-form-card" onSubmit={onSubmit} noValidate>
        <section className="admin-form-section">
          <h2>Restaurant Information</h2>
          <div className="admin-form-grid">
            <Field label="Restaurant Name *" error={errors.name}>
              <input value={form.name} onChange={(e) => setField('name', e.target.value)} />
            </Field>
            <Field label="Restaurant Slug *" error={errors.slug}>
              <input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setField('slug', slugify(e.target.value));
                }}
              />
            </Field>
            <Field label="Description" className="span-2">
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
              />
            </Field>
            <ImageUploadField
              className="span-2"
              label="Restaurant Logo"
              url={form.logoUrl}
              file={logoFile}
              onUrlChange={(v) => setField('logoUrl', v)}
              onFileChange={setLogoFile}
            />
            <ImageUploadField
              className="span-2"
              label="Cover Image"
              url={form.coverUrl}
              file={coverFile}
              onUrlChange={(v) => setField('coverUrl', v)}
              onFileChange={setCoverFile}
            />
            <Field label="Phone Number *" error={errors.phone}>
              <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
            </Field>
            <Field label="Email *" error={errors.email}>
              <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
            </Field>
            <Field label="Address *" error={errors.address} className="span-2">
              <input value={form.address} onChange={(e) => setField('address', e.target.value)} />
            </Field>
            <Field label="City *" error={errors.city}>
              <input value={form.city} onChange={(e) => setField('city', e.target.value)} />
            </Field>
            <Field label="State">
              <input value={form.state} onChange={(e) => setField('state', e.target.value)} />
            </Field>
            <Field label="Pincode">
              <input value={form.pincode} onChange={(e) => setField('pincode', e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="admin-form-section">
          <h2>Restaurant Admin</h2>
          <p className="admin-muted">
            Creates the initial <strong>RESTAURANT_OWNER</strong> account for restaurant login (cannot create other restaurants).
          </p>
          <div className="admin-form-grid">
            <Field label="Admin Name *" error={errors.adminName}>
              <input value={form.adminName} onChange={(e) => setField('adminName', e.target.value)} />
            </Field>
            <Field label="Admin Email *" error={errors.adminEmail}>
              <input type="email" value={form.adminEmail} onChange={(e) => setField('adminEmail', e.target.value)} />
            </Field>
            <Field label="Admin Phone">
              <input value={form.adminPhone} onChange={(e) => setField('adminPhone', e.target.value)} />
            </Field>
            <PasswordField
              label="Admin Password *"
              error={errors.adminPassword}
              value={form.adminPassword}
              onChange={(v) => setField('adminPassword', v)}
              autoComplete="new-password"
            />
            <PasswordField
              label="Confirm Password *"
              error={errors.confirmPassword}
              value={form.confirmPassword}
              onChange={(v) => setField('confirmPassword', v)}
              className="span-2"
              autoComplete="new-password"
            />
          </div>
        </section>

        <section className="admin-form-section">
          <h2>Subscription</h2>
          <div className="admin-plan-grid">
            {plans.map((plan) => (
              <label
                key={plan.id}
                className={`admin-plan-card ${form.subscriptionPlanId === plan.id ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="plan"
                  checked={form.subscriptionPlanId === plan.id}
                  onChange={() => setField('subscriptionPlanId', plan.id)}
                />
                <strong>{plan.name}</strong>
                <span>{plan.priceLabel}</span>
                <ul>
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </label>
            ))}
          </div>
          {selectedPlan ? (
            <p className="admin-muted admin-mt">
              Selected: {selectedPlan.name} — QR path will be `/r/{'{slug}'}/t/{'{qrToken}'}`
            </p>
          ) : null}
        </section>

        <div className="admin-form-actions">
          <Link to="/admin/restaurants" className="admin-btn admin-btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Restaurant'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, error, children, className = '' }) {
  return (
    <label className={`admin-field ${className}`}>
      <span>{label}</span>
      {children}
      {error ? <em className="admin-field-error">{error}</em> : null}
    </label>
  );
}

function PasswordField({ label, error, value, onChange, className = '', autoComplete = 'new-password' }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className={`admin-field ${className}`}>
      <span>{label}</span>
      <div className="admin-password-wrap">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="admin-password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {error ? <em className="admin-field-error">{error}</em> : null}
    </label>
  );
}
