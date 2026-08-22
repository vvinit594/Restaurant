import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useRestaurantAuth } from './auth/RestaurantAuthContext';

export default function RestaurantLogin() {
  const { login, isAuthenticated, bootstrapping } = useRestaurantAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');

  const from = location.state?.from || '/restaurant/dashboard';

  if (!bootstrapping && isAuthenticated) {
    return <Navigate to="/restaurant/dashboard" replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setForgotMsg('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await login({ email: trimmedEmail, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <span className="admin-pill">DilYum</span>
          <h1>Restaurant Login</h1>
          <p>Owner, Manager, and Staff sign in to manage their restaurant.</p>
        </div>

        <form className="admin-form" onSubmit={onSubmit} noValidate>
          <label className="admin-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@example.com"
              required
            />
          </label>

          <label className="admin-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
          {forgotMsg ? <div className="admin-alert admin-alert-info">{forgotMsg}</div> : null}

          <button type="submit" className="admin-btn admin-btn-primary admin-btn-block" disabled={loading}>
            {loading ? 'Signing in…' : 'Next'}
          </button>
        </form>

        <button
          type="button"
          className="rest-forgot-btn"
          onClick={() =>
            setForgotMsg('Contact your Super Admin or restaurant owner to reset your password.')
          }
        >
          Forgot Password?
        </button>

        <p className="admin-login-hint">
          <Link to="/">← Back to DilYum</Link>
          {' · '}
          <Link to="/admin-login">Super Admin</Link>
        </p>
      </div>
    </div>
  );
}
