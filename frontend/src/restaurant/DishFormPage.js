import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ImageUploadField from '../components/ImageUploadField';
import { resolveImageUrl } from '../services/mediaApi';
import {
  createMenuItem,
  getCategories,
  getMenuItem,
  updateMenuItem,
} from '../services/restaurantMenuApi';
import { useToast } from '../admin/components/Toast';
import { useRestaurantAuth } from './auth/RestaurantAuthContext';

const EMPTY = {
  name: '',
  description: '',
  price: '',
  category: '',
  imageUrl: '',
  calories: '',
  protein: '',
  carbohydrates: '',
  fat: '',
  ingredients: '',
  allergens: '',
  isVeg: true,
  isVegan: false,
  isJain: false,
  available: true,
  published: true,
};

export default function DishFormPage({ mode = 'create' }) {
  const isEdit = mode === 'edit';
  const { dishId } = useParams();
  const navigate = useNavigate();
  const { user } = useRestaurantAuth();
  const { push } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => {
    getCategories().then((cats) => {
      setCategories(cats);
      setForm((prev) => ({ ...prev, category: prev.category || cats[0] || '' }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit || !dishId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const dish = await getMenuItem(dishId);
        if (!alive) return;
        setForm({
          name: dish.name,
          description: dish.description || '',
          price: String(dish.price ?? ''),
          category: dish.category,
          imageUrl: dish.imageUrl || '',
          calories: dish.calories ?? '',
          protein: dish.protein ?? '',
          carbohydrates: dish.carbohydrates ?? '',
          fat: dish.fat ?? '',
          ingredients: (dish.ingredients || []).join(', '),
          allergens: (dish.allergens || []).join(', '),
          isVeg: Boolean(dish.isVeg),
          isVegan: Boolean(dish.isVegan),
          isJain: Boolean(dish.isJain),
          available: Boolean(dish.available),
          published: Boolean(dish.published),
        });
        setImageFile(null);
      } catch (err) {
        push(err.message || 'Dish not found.', 'error');
        navigate('/restaurant/menu');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isEdit, dishId, navigate, push]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const next = {};
    if (!String(form.name).trim()) next.name = 'Dish name is required';
    if (form.price === '' || Number.isNaN(Number(form.price)) || Number(form.price) <= 0) {
      next.price = 'Enter a valid price greater than 0';
    }
    if (!String(form.category).trim()) next.category = 'Category is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const imageUrl = await resolveImageUrl(
        { url: form.imageUrl, file: imageFile },
        { folder: 'restaurants/dishes' }
      );
      const payload = {
        ...form,
        imageUrl,
        price: Number(form.price),
      };
      if (isEdit) {
        await updateMenuItem(dishId, payload);
        push('Dish updated.');
      } else {
        await createMenuItem(payload);
        push('Dish added successfully.');
      }
      navigate('/restaurant/menu');
    } catch (err) {
      push(err.message || 'Could not save dish.', 'error');
    } finally {
      setSubmitting(false);
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
          <h1>{isEdit ? 'Edit Dish' : 'Add Dish'}</h1>
          <p className="admin-muted">
            Saving to <strong>{user?.restaurantName}</strong> only.
          </p>
        </div>
        <Link to="/restaurant/menu" className="admin-btn admin-btn-ghost">Cancel</Link>
      </div>

      <form className="admin-form admin-form-card" onSubmit={onSubmit} noValidate>
        <div className="admin-form-grid">
          <Field label="Dish Name *" error={errors.name}>
            <input value={form.name} onChange={(e) => setField('name', e.target.value)} />
          </Field>
          <Field label="Price (₹) *" error={errors.price}>
            <input type="number" min="0" step="1" value={form.price} onChange={(e) => setField('price', e.target.value)} />
          </Field>
          <Field label="Category *" error={errors.category}>
            <select value={form.category} onChange={(e) => setField('category', e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <ImageUploadField
            className="span-2"
            label="Dish Image"
            url={form.imageUrl}
            file={imageFile}
            onUrlChange={(v) => setField('imageUrl', v)}
            onFileChange={setImageFile}
          />
          <Field label="Description" className="span-2">
            <textarea rows={3} value={form.description} onChange={(e) => setField('description', e.target.value)} />
          </Field>
          <Field label="Calories">
            <input type="number" value={form.calories} onChange={(e) => setField('calories', e.target.value)} />
          </Field>
          <Field label="Protein (g)">
            <input type="number" value={form.protein} onChange={(e) => setField('protein', e.target.value)} />
          </Field>
          <Field label="Carbohydrates (g)">
            <input type="number" value={form.carbohydrates} onChange={(e) => setField('carbohydrates', e.target.value)} />
          </Field>
          <Field label="Fat (g)">
            <input type="number" value={form.fat} onChange={(e) => setField('fat', e.target.value)} />
          </Field>
          <Field label="Ingredients (comma separated)" className="span-2">
            <input value={form.ingredients} onChange={(e) => setField('ingredients', e.target.value)} />
          </Field>
          <Field label="Allergens (comma separated)" className="span-2">
            <input value={form.allergens} onChange={(e) => setField('allergens', e.target.value)} />
          </Field>
        </div>

        <div className="rest-check-grid">
          <Check label="Veg" checked={form.isVeg} onChange={(v) => setField('isVeg', v)} />
          <Check label="Vegan" checked={form.isVegan} onChange={(v) => setField('isVegan', v)} />
          <Check label="Jain" checked={form.isJain} onChange={(v) => setField('isJain', v)} />
          <Check label="Available" checked={form.available} onChange={(v) => setField('available', v)} />
          <Check label="Published" checked={form.published} onChange={(v) => setField('published', v)} />
        </div>

        <div className="admin-form-actions">
          <Link to="/restaurant/menu" className="admin-btn admin-btn-ghost">Cancel</Link>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Dish'}
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

function Check({ label, checked, onChange }) {
  return (
    <label className="rest-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
