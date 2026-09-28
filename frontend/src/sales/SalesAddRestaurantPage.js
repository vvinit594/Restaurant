import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ImageUploadField from '../components/ImageUploadField';
import SubscriptionPlanCards from '../components/SubscriptionPlanCards';
import { resolveImageUrlForSave } from '../services/mediaApi';
import { validatePasswordStrength } from '../services/passwordHash';
import { slugify } from '../services/adminStorage';
import {
  createSalesRestaurant,
  getSalesPlans,
  startSalesRestaurantCheckout,
} from '../services/salesApi';
import { openRazorpaySubscriptionCheckout } from '../services/razorpayCheckout';
import { useToast } from '../admin/components/Toast';

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
  subscriptionPlanId: 'trial_10_days',
};

export default function SalesAddRestaurantPage() {
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
    getSalesPlans().then(setPlans).catch(() => setPlans([]));
  }, []);

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'name' && !slugTouched) next.slug = slugify(value);
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
      ['adminName', 'Owner name is required'],
      ['adminEmail', 'Owner email is required'],
    ];
    required.forEach(([key, msg]) => {
      if (!String(form[key] || '').trim()) next[key] = msg;
    });
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = 'Enter a valid email';
    }
    if (form.adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail)) {
      next.adminEmail = 'Enter a valid owner email';
    }
    const passwordError = validatePasswordStrength(form.adminPassword);
    if (passwordError) next.adminPassword = passwordError;
    if (!form.confirmPassword) next.confirmPassword = 'Confirm password is required';
    else if (form.adminPassword !== form.confirmPassword) {
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
        resolveImageUrlForSave({ url: form.logoUrl, file: logoFile }, { kind: 'logo' }),
        resolveImageUrlForSave({ url: form.coverUrl, file: coverFile }, { kind: 'cover' }),
      ]);

      const result = await createSalesRestaurant({
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
        subscriptionPlanId: form.subscriptionPlanId,
      });

      const paid = result.subscription?.paymentRequired === true;
      if (paid) {
        if (!result.checkout?.keyId || !result.checkout?.subscriptionId) {
          const missing = new Error(
            result.message || 'Razorpay Checkout details were not returned for this paid plan.',
          );
          missing.data = { restaurantId: result.id, paymentRequired: true };
          throw missing;
        }
        push('Restaurant added. Opening Razorpay Checkout…');
        const payResult = await openRazorpaySubscriptionCheckout(result.checkout);
        if (payResult.success) {
          push('Payment authorized. Subscription activates after Razorpay confirmation.');
        } else {
          push(
            payResult.error ||
              'Checkout was closed. The subscription stays pending until payment is completed.',
            'error',
          );
        }
      } else {
        push(result.message || 'Restaurant added successfully.');
      }
      navigate('/sales/restaurants');
    } catch (err) {
      const restaurantId = err.data?.restaurantId;
      if (restaurantId && err.data?.paymentRequired) {
        try {
          const checkout = await startSalesRestaurantCheckout(restaurantId);
          push('Opening Razorpay Checkout…');
          const payResult = await openRazorpaySubscriptionCheckout(checkout);
          if (payResult.success) {
            push('Payment authorized. Subscription activates after Razorpay confirmation.');
          } else {
            push(
              payResult.error ||
                'Checkout was closed. The subscription stays pending until payment is completed.',
              'error',
            );
          }
        } catch (retryErr) {
          push(retryErr.message || err.message || 'Razorpay Checkout could not start.', 'error');
        }
        navigate('/sales/restaurants');
        return;
      }
      push(err.message || 'Could not add restaurant.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Add Restaurant</h1>
          <p className="admin-muted">
            Create a restaurant on DilYum. It will be attributed to your Sales ID automatically.
          </p>
        </div>
      </div>

      <form className="admin-form-card" onSubmit={onSubmit}>
        <h2>Restaurant details</h2>
        <div className="admin-form-grid">
          {[
            ['name', 'Restaurant name'],
            ['slug', 'Slug'],
            ['phone', 'Phone'],
            ['email', 'Email'],
            ['address', 'Address'],
            ['city', 'City'],
            ['state', 'State'],
            ['pincode', 'Pincode'],
          ].map(([key, label]) => (
            <label key={key} className="admin-field">
              <span>{label}</span>
              <input
                value={form[key]}
                onChange={(e) => {
                  if (key === 'slug') setSlugTouched(true);
                  setField(key, e.target.value);
                }}
                disabled={submitting}
              />
              {errors[key] ? <em className="admin-field-error">{errors[key]}</em> : null}
            </label>
          ))}
        </div>

        <label className="admin-field">
          <span>Description</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            disabled={submitting}
          />
        </label>

        <div className="admin-form-grid">
          <ImageUploadField
            label="Logo"
            url={form.logoUrl}
            onUrlChange={(v) => setField('logoUrl', v)}
            onFileChange={setLogoFile}
          />
          <ImageUploadField
            label="Cover"
            url={form.coverUrl}
            onUrlChange={(v) => setField('coverUrl', v)}
            onFileChange={setCoverFile}
          />
        </div>

        <h2>Owner account</h2>
        <div className="admin-form-grid">
          {[
            ['adminName', 'Owner name'],
            ['adminEmail', 'Owner email'],
            ['adminPhone', 'Owner phone'],
            ['adminPassword', 'Password', 'password'],
            ['confirmPassword', 'Confirm password', 'password'],
          ].map(([key, label, type]) => (
            <label key={key} className="admin-field">
              <span>{label}</span>
              <input
                type={type || 'text'}
                value={form[key]}
                onChange={(e) => setField(key, e.target.value)}
                disabled={submitting}
              />
              {errors[key] ? <em className="admin-field-error">{errors[key]}</em> : null}
            </label>
          ))}
        </div>

        <h2>Subscription</h2>
        <SubscriptionPlanCards
          plans={plans}
          selectedId={form.subscriptionPlanId}
          onSelect={(id) => setField('subscriptionPlanId', id)}
          disabled={submitting}
        />

        <div className="order-checkout-actions">
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => navigate('/sales/restaurants')}
            disabled={submitting}
          >
            Cancel
          </button>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Add Restaurant'}
          </button>
        </div>
      </form>
    </div>
  );
}
