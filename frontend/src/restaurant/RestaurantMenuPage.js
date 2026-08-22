import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteMenuItem,
  getCategories,
  getRestaurantMenu,
  updateMenuItem,
} from '../services/restaurantMenuApi';
import ConfirmDialog from '../admin/components/ConfirmDialog';
import { useToast } from '../admin/components/Toast';
import { useRestaurantAuth } from './auth/RestaurantAuthContext';

export default function RestaurantMenuPage() {
  const { permissions } = useRestaurantAuth();
  const { push } = useToast();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dishes, cats] = await Promise.all([
        getRestaurantMenu({ search, category }),
        getCategories(),
      ]);
      setRows(dishes);
      setCategories(cats);
    } catch (err) {
      setError(err.message || 'Failed to load menu.');
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    const t = setTimeout(load, 180);
    return () => clearTimeout(t);
  }, [load]);

  const toggleAvailability = async (dish) => {
    try {
      await updateMenuItem(dish.id, { available: !dish.available });
      push(dish.available ? 'Marked unavailable.' : 'Marked available.');
      await load();
    } catch (err) {
      push(err.message || 'Update failed.', 'error');
    }
  };

  const onDelete = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await deleteMenuItem(confirm.id);
      push('Dish removed.');
      setConfirm(null);
      await load();
    } catch (err) {
      push(err.message || 'Delete failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Menu</h1>
          <p className="admin-muted">Manage dishes for your restaurant only.</p>
        </div>
        {permissions?.addDish ? (
          <Link to="/restaurant/menu/add" className="admin-btn admin-btn-primary">
            + Add Dish
          </Link>
        ) : null}
      </div>

      <div className="admin-toolbar">
        <input
          className="admin-input"
          type="search"
          placeholder="Search dishes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="admin-input admin-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Dish</th>
              <th>Category</th>
              <th>Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}><td colSpan={5}><div className="admin-skeleton" /></td></tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="admin-empty admin-empty-inline">
                    <h3>No dishes yet</h3>
                    <p>Add your first dish to build the restaurant menu.</p>
                    {permissions?.addDish ? (
                      <Link to="/restaurant/menu/add" className="admin-btn admin-btn-primary">+ Add Dish</Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((dish) => (
                <tr key={dish.id}>
                  <td>
                    <strong>{dish.name}</strong>
                    <div className="admin-cell-sub">{dish.description || '—'}</div>
                  </td>
                  <td>{dish.category}</td>
                  <td>₹{dish.price}</td>
                  <td>
                    <span className={`admin-badge ${dish.available ? 'admin-badge-active' : 'admin-badge-suspended'}`}>
                      {dish.available ? 'Active' : 'Unavailable'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      {permissions?.editDish ? (
                        <Link className="admin-link-btn" to={`/restaurant/menu/${dish.id}/edit`}>
                          Edit
                        </Link>
                      ) : null}
                      {permissions?.manageAvailability ? (
                        <button type="button" className="admin-link-btn" onClick={() => toggleAvailability(dish)}>
                          {dish.available ? 'Make Unavailable' : 'Make Available'}
                        </button>
                      ) : null}
                      {permissions?.deleteDish ? (
                        <button
                          type="button"
                          className="admin-link-btn danger"
                          onClick={() => setConfirm({ id: dish.id, name: dish.name })}
                        >
                          Delete
                        </button>
                      ) : null}
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
        title="Delete dish?"
        message={confirm ? `Remove “${confirm.name}” from your restaurant menu?` : ''}
        confirmLabel="Delete"
        danger
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={onDelete}
      />
    </div>
  );
}
